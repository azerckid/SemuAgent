import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  getBillingProfileStatus,
  getTenantBillingProfile,
  upsertTenantBillingProfile,
} from '@/lib/billing/profile'

function errorResponse(err: unknown) {
  if (err instanceof Error && err.message === 'Unauthorized') {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }
  if (err instanceof Error && err.message === 'Forbidden') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.flatten() }, { status: 400 })
  }

  console.error('[api/billing/profile]', err instanceof Error ? err.message : 'unknown error')
  return NextResponse.json({ error: '서버 오류' }, { status: 500 })
}

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession()
    const profile = await getTenantBillingProfile(tenantId)
    return NextResponse.json({
      status: getBillingProfileStatus(profile),
      profile: profile
        ? {
            ...profile,
            businessRegistrationNumber: profile.maskedBusinessRegistrationNumber,
          }
        : null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PUT(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const profile = await upsertTenantBillingProfile({
      tenantId,
      userId: user.id,
      input: await req.json(),
    })

    // Admin just saved editable fields; return full formatted BRN so the client can re-edit
    // without re-fetching. GET keeps masked responses for read-only consumers.
    return NextResponse.json({
      status: getBillingProfileStatus(profile),
      profile,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
