import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { submitFilePassword } from '@/lib/upload/file-password'

// 담당자 자료검토 경로: 스태프 인증(tenant 세션 + 활성 담당자).
// 클라이언트가 비밀번호를 포털에 직접 넣지 않고 전화/메일로만 알려주는 실무 케이스를 위해
// 담당자도 입력할 수 있게 한다. 비밀번호는 즉시 소비 후 폐기하며 저장하지 않는다.
const submitPasswordSchema = z.object({
  password: z.string().min(1).max(255),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const parsed = submitPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 })
    }

    const { fileId } = await params
    const result = await submitFilePassword({
      fileId,
      tenantId,
      password: parsed.data.password,
    })

    if (result.ok) {
      const { overrideBuffer } = result
      after(async () => {
        try {
          const { analyzeFileAndMaybeFinalize } = await import('@/lib/ai/process')
          await analyzeFileAndMaybeFinalize(fileId, tenantId, { overrideBuffer })
        } catch (err) {
          console.error(`[review-password] 복호화 후 재분석 실패 (${fileId}):`, err)
        }
      })
      return NextResponse.json({ status: 'consumed' })
    }

    if (result.status === 'invalid') {
      return NextResponse.json(
        { status: 'invalid', error: '비밀번호가 올바르지 않습니다' },
        { status: 400 },
      )
    }

    if (result.reason === 'file_not_found') {
      return NextResponse.json({ error: '대상 파일을 찾을 수 없습니다' }, { status: 404 })
    }
    return NextResponse.json(
      { error: '비밀번호가 필요한 파일이 아닙니다' },
      { status: 409 },
    )
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // 비밀번호가 섞여 나가지 않도록 에러 원문은 흘리지 않는다.
    console.error('[review-password] 처리 실패')
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
