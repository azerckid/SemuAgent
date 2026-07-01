import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  cancelRunningBookkeepingClassification,
  getActiveStaffForUser,
} from '@/lib/bookkeeping/classification-service'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const result = await cancelRunningBookkeepingClassification({ sessionId, tenantId, staffRecord })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/sessions/[id]/account-classification/cancel]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
