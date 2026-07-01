import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { billingPlanCodeSchema } from '@/lib/billing/plans'
import { startTossBillingSetup } from '@/lib/billing/subscription'

const startSchema = z.object({
  planCode: billingPlanCodeSchema,
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

  console.error('[POST /api/billing/toss/start]', err)
  return NextResponse.json({ error: '서버 오류' }, { status: 500 })
}

export async function POST(req: NextRequest) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const parsed = startSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const setup = await startTossBillingSetup({
      tenantId,
      user,
      planCode: parsed.data.planCode,
      origin: req.nextUrl.origin,
    })

    return NextResponse.json(setup)
  } catch (err) {
    return errorResponse(err)
  }
}
