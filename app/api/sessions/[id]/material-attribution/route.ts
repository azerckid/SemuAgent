import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  getActiveStaffForPeriodAttribution,
  getBookkeepingMaterialAttribution,
} from '@/lib/bookkeeping/period-attribution-service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params
    const staffRecord = await getActiveStaffForPeriodAttribution({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const result = await getBookkeepingMaterialAttribution({ sessionId, tenantId, staffRecord })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/sessions/[id]/material-attribution]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
