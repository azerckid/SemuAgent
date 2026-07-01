import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import {
  getPurposeRequestDraft,
  updatePurposeRequestDraft,
} from '@/lib/bookkeeping/transaction-purpose-service'
import { staffDraftUpdateSchema } from '@/lib/validations/transaction-purpose-request'

// 거래 용도 확인 요청 draft 상세 로드(편집/미리보기용). creator 또는 TENANT_ADMIN.
export async function GET(
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

    const result = await getPurposeRequestDraft({ requestId, tenantId, staffRecord })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/transaction-purpose-requests/[id]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 거래 용도 확인 요청 draft 수정(발송 전). 제목/본문 스냅샷, 답변 기한,
// row 추가·제거, 취소(spec §6.2). draft 상태에서만 가능.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: requestId } = await params

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = staffDraftUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await updatePurposeRequestDraft({
      requestId,
      tenantId,
      staffRecord,
      input: parsed.data,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ id: result.id, status: result.status })
  } catch (err) {
    console.error('[PATCH /api/transaction-purpose-requests/[id]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
