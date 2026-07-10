import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  getActiveStaffForUser,
  updateBookkeepingClassificationRow,
} from '@/lib/bookkeeping/classification-service'
import { updateClassificationRowSchema } from '@/lib/bookkeeping/schemas'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId, rowId } = await params
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const input = updateClassificationRowSchema.safeParse(await req.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.message }, { status: 400 })
    }

    const result = await updateBookkeepingClassificationRow({
      rowId,
      sessionId,
      tenantId,
      staffRecord,
      finalAccount: input.data.finalAccount,
      staffMemo: input.data.staffMemo,
      status: input.data.status,
      purposeRequestRowId: input.data.purposeRequestRowId,
      linkedEvidenceRowId: input.data.linkedEvidenceRowId,
      vatFact: input.data.vatFact,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true, previous: result.previous })
  } catch (err) {
    console.error('[PATCH /api/sessions/[id]/account-classification/rows/[rowId]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
