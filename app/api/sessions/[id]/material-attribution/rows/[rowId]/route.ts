import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { updateMaterialAttributionRowSchema } from '@/lib/bookkeeping/schemas'
import {
  getActiveStaffForPeriodAttribution,
  updateBookkeepingMaterialAttributionRow,
} from '@/lib/bookkeeping/period-attribution-service'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId, rowId } = await params
    const staffRecord = await getActiveStaffForPeriodAttribution({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const parsed = updateMaterialAttributionRowSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
    }

    const result = await updateBookkeepingMaterialAttributionRow({
      sessionId,
      rowId,
      tenantId,
      staffRecord,
      ...parsed.data,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[PATCH /api/sessions/[id]/material-attribution/rows/[rowId]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
