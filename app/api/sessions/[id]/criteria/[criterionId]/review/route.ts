import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import {
  getActiveStaffForCriterionReview,
  reviewSessionCriterion,
} from '@/lib/sessions/criterion-review-service'
import { criterionReviewPatchSchema } from '@/lib/validations/criterion-review'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; criterionId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId, criterionId } = await params
    const staffRecord = await getActiveStaffForCriterionReview({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const parsed = criterionReviewPatchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다.', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const result = await reviewSessionCriterion({
      sessionId,
      criterionId,
      tenantId,
      staffRecord,
      input: parsed.data,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      validation: {
        id: result.validation.id,
        reviewStatus: result.validation.reviewStatus,
        staffNote: result.validation.staffNote,
        reviewedByStaffId: result.validation.reviewedByStaffId,
        reviewedAt: result.validation.reviewedAt,
        validationStatus: result.validation.validationStatus,
        itemName: result.validation.itemName,
      },
      completionEligibility: result.completionEligibility,
      sessionStatus: result.sessionStatus,
    })
  } catch (err) {
    console.error('[PATCH /api/sessions/[id]/criteria/[criterionId]/review]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
