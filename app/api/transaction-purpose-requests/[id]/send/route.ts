import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { sendPurposeRequest } from '@/lib/bookkeeping/transaction-purpose-service'

// 거래 용도 확인 요청 발송(spec §6.3). send 버튼 = 담당자 최종 승인 + Resend 발송.
// 발송 후 outbound_email(type=transaction_purpose_request, sent) 생성 및 request→sent 갱신.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: requestId } = await params

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const result = await sendPurposeRequest({ requestId, tenantId, staffRecord })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(
      { id: result.id, status: result.status, outboundEmailId: result.outboundEmailId },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /api/transaction-purpose-requests/[id]/send]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
