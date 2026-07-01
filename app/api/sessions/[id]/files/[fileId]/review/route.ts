import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForCriterionReview } from '@/lib/sessions/criterion-review-service'
import { reviewUploadFile } from '@/lib/sessions/upload-file-review-service'
import { loadReviewSessionById } from '@/lib/reviews/load-review-session-by-id'
import { uploadFileReviewPatchSchema } from '@/lib/validations/upload-file-review'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: sessionId, fileId } = await params
    const staffRecord = await getActiveStaffForCriterionReview({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const parsed = uploadFileReviewPatchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다.', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const session = await loadReviewSessionById(tenantId, sessionId)
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    const result = await reviewUploadFile({
      sessionId,
      fileId,
      tenantId,
      staffRecord,
      session,
      input: parsed.data,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      file: {
        id: result.file.id,
        staffReviewStatus: result.file.staffReviewStatus,
        staffReviewNote: result.file.staffReviewNote,
        staffReviewedByStaffId: result.file.staffReviewedByStaffId,
        staffReviewedAt: result.file.staffReviewedAt,
      },
    })
  } catch (err) {
    console.error('[PATCH /api/sessions/[id]/files/[fileId]/review]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
