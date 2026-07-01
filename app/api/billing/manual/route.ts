import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { upsertManualTenantSubscription } from '@/lib/billing/manual-subscription'

function errorResponse(err: unknown) {
  if (err instanceof Error && err.message === 'Unauthorized') {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }
  if (err instanceof Error && err.message === 'Forbidden') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }
  if (err instanceof Error && err.message === 'BillingProfileIncomplete') {
    return NextResponse.json(
      { error: '청구정보를 먼저 모두 입력해 주세요' },
      { status: 400 },
    )
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.flatten() }, { status: 400 })
  }

  console.error('[POST /api/billing/manual]', err)
  return NextResponse.json({ error: '서버 오류' }, { status: 500 })
}

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const result = await upsertManualTenantSubscription({
      tenantId,
      userId: user.id,
      input: await req.json(),
    })
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
