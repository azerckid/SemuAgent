import { and, eq } from 'drizzle-orm'
import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { uploadFile, uploadSession } from '@/lib/db/schema'
import { verifyToken } from '@/lib/session'

export const maxDuration = 300

const submitSchema = z.object({
  rawToken: z.string().min(1),
})

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json()
  const parsed = submitSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 })
  }

  const session = await verifyToken(parsed.data.rawToken)
  if (!session) {
    return NextResponse.json({ error: '유효하지 않거나 만료된 세션입니다' }, { status: 401 })
  }

  if (session.status === 'completed') {
    return NextResponse.json({ status: 'completed' })
  }

  const files = await db
    .select({ id: uploadFile.id, status: uploadFile.status })
    .from(uploadFile)
    .where(and(eq(uploadFile.uploadSessionId, session.id), eq(uploadFile.tenantId, session.tenantId)))

  if (files.length === 0) {
    return NextResponse.json({ error: '업로드된 파일이 없습니다' }, { status: 400 })
  }

  await db
    .update(uploadSession)
    .set({ status: 'submitted' })
    .where(and(eq(uploadSession.id, session.id), eq(uploadSession.tenantId, session.tenantId)))

  // payroll 세션은 일반 AI 분석·누락메일 생성을 건너뛰고, 최초 업로드 제출 직후 급여정보 추출을 자동 실행한다.
  // 추출 결과는 적합(pass) 또는 부적합(fail) 두 상태로 판정한다.
  if (session.requestKind === 'payroll') {
    after(async () => {
      try {
        const { executePayrollExtraction } = await import('@/lib/services/payroll-extraction-service')
        const result = await executePayrollExtraction({
          sessionId: session.id,
          tenantId: session.tenantId,
          createdByStaffId: session.createdByStaffId,
        })
        if (!result.success) {
          console.error(`[upload-submit] payroll 자동 추출 실패 (${session.id}):`, result.error)
        }
      } catch (err) {
        console.error(`[upload-submit] payroll 자동 추출 트리거 실패 (${session.id}):`, err)
      }
    })

    return NextResponse.json({ status: 'submitted', payrollExtractionQueued: true })
  }

  const pendingFiles = files.filter((file) => file.status === 'uploaded' || file.status === 'analyzing')

  if (pendingFiles.length > 0) {
    after(async () => {
      try {
        const { analyzePendingSessionFiles } = await import('@/lib/ai/process')
        await analyzePendingSessionFiles(session.id, session.tenantId)
      } catch (err) {
        console.error(`[upload-submit] 제출 후 분석 트리거 실패 (${session.id}):`, err)
      }
    })

    return NextResponse.json({ status: 'submitted', pendingAnalysis: true })
  }

  after(async () => {
    try {
      const { runSessionEvaluationPipeline } = await import('@/lib/ai/run-session-evaluation')
      const outcome = await runSessionEvaluationPipeline(session.id, session.tenantId)
      if (!outcome.ok) {
        console.error(`[upload-submit] 세션 평가 실패 (${session.id}):`, outcome)
        return
      }
      if (session.requestKind === 'general') {
        const { runBookkeepingDraftPipelineAfterEvaluation } = await import('@/lib/bookkeeping/automatic-review-progression')
        await runBookkeepingDraftPipelineAfterEvaluation({
          sessionId: session.id,
          tenantId: session.tenantId,
          staffId: session.createdByStaffId,
          logSource: 'upload-submit',
        })
      }
    } catch (err) {
      console.error(`[upload-submit] 평가 실패 (${session.id}):`, err)
    }
  })

  return NextResponse.json({ status: 'submitted' })
}
