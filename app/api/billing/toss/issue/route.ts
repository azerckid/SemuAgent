import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { completeTossBillingAuth } from '@/lib/billing/subscription'
import { TossPaymentsError } from '@/lib/billing/toss'

const issueSchema = z.object({
  authKey: z.string().min(1),
  customerKey: z.string().min(1),
})

function errorResponse(err: unknown) {
  if (err instanceof Error && err.message === 'Unauthorized') {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }
  if (err instanceof Error && err.message === 'Forbidden') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }
  if (err instanceof Error && err.message === 'TossBillingUnavailable') {
    return NextResponse.json({ error: 'Toss 결제 테스트 환경이 아직 설정되지 않았습니다' }, { status: 503 })
  }
  if (
    err instanceof Error &&
    (err.message === 'BillingCustomerNotFound' || err.message === 'SubscriptionNotFound')
  ) {
    return NextResponse.json({ error: '결제 등록 세션을 찾을 수 없습니다' }, { status: 404 })
  }
  if (err instanceof TossPaymentsError) {
    return NextResponse.json(
      { error: err.message, code: err.code ?? null },
      { status: err.status >= 400 && err.status < 500 ? 400 : 502 },
    )
  }

  console.error('[POST /api/billing/toss/issue]', err)
  return NextResponse.json({ error: '서버 오류' }, { status: 500 })
}

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const parsed = issueSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await completeTossBillingAuth({
      tenantId,
      user,
      authKey: parsed.data.authKey,
      customerKey: parsed.data.customerKey,
    })

    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
