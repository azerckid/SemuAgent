import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { uploadSession } from '@/lib/db/schema'
import { safeSecretEqual } from '@/lib/security/constant-time'

export const maxDuration = 60

const bodySchema = z.object({
  sessionId: z.string().min(1),
  tenantId: z.string().min(1),
})

export async function POST(req: Request): Promise<Response> {
  const internalSecret = process.env.INTERNAL_API_SECRET
  if (!internalSecret || !safeSecretEqual(req.headers.get('authorization'), `Bearer ${internalSecret}`)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return new Response('Invalid request body', { status: 400 })
  }

  const { sessionId, tenantId } = parsed.data

  try {
    const { runSessionEvaluationPipeline } = await import('@/lib/ai/run-session-evaluation')
    const outcome = await runSessionEvaluationPipeline(sessionId, tenantId)
    if (!outcome.ok) {
      console.error(`[POST /api/sessions/evaluate] 세션 평가 실패 (${sessionId}):`, outcome)
      return new Response(outcome.message, { status: 500 })
    }
    const [session] = await db
      .select({
        requestKind: uploadSession.requestKind,
        createdByStaffId: uploadSession.createdByStaffId,
      })
      .from(uploadSession)
      .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
      .limit(1)

    if (session?.requestKind === 'general') {
      const { runBookkeepingDraftPipelineAfterEvaluation } = await import('@/lib/bookkeeping/automatic-review-progression')
      await runBookkeepingDraftPipelineAfterEvaluation({
        sessionId,
        tenantId,
        staffId: session.createdByStaffId,
        logSource: 'sessions-evaluate',
      })
    }
  } catch (err) {
    console.error('[POST /api/sessions/evaluate]', err)
    return new Response('Evaluation failed', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}
