import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { createPurposeRequestDraft } from '@/lib/bookkeeping/transaction-purpose-service'
import { staffDraftCreateSchema } from '@/lib/validations/transaction-purpose-request'

// 거래 용도 확인 요청 draft 생성. 발송은 하지 않는다(spec §6.1).
// 발송은 POST /api/transaction-purpose-requests/[id]/send (Slice 3).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId } = await params

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = staffDraftCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await createPurposeRequestDraft({
      sessionId,
      tenantId,
      staffRecord,
      input: parsed.data,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(
      { id: result.id, status: result.status, rowCount: result.rowCount },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /api/sessions/[id]/transaction-purpose-requests]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
