import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import { db } from '@/lib/db'
import { vatDeductionReview, vatPeriodSummary } from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import { buildVatPeriodRecalculation } from '@/lib/vat/summary'
import { findUnresolvedVatTaxTreatmentHandoff } from '@/lib/vat/tax-treatment-handoff'
import { loadVatTaxTreatmentDisplayRows } from '@/lib/vat/tax-treatment-summary'
import { vatDeductionReviewPatchSchema } from '@/lib/validations/vat'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { reviewId } = await params
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })

    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const input = vatDeductionReviewPatchSchema.safeParse(await req.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.message }, { status: 400 })
    }

    const [review] = await db
      .select({
        id: vatDeductionReview.id,
        clientId: vatDeductionReview.clientId,
        periodKey: vatDeductionReview.periodKey,
        classificationRowId: vatDeductionReview.classificationRowId,
        reason: vatDeductionReview.reason,
      })
      .from(vatDeductionReview)
      .where(and(eq(vatDeductionReview.id, reviewId), eq(vatDeductionReview.tenantId, tenantId)))
      .limit(1)

    if (!review) {
      return NextResponse.json({ error: '공제 검토 항목을 찾을 수 없습니다.' }, { status: 404 })
    }

    const treatmentRows = review.classificationRowId
      ? await loadVatTaxTreatmentDisplayRows({
        tenantId,
        businessEntityId: review.clientId,
        period: buildCompanyHomePeriod({ periodKey: review.periodKey }),
        includeStoredAi: true,
      })
      : []
    const handoff = findUnresolvedVatTaxTreatmentHandoff(
      treatmentRows,
      review.classificationRowId,
    )
    if (handoff) {
      return NextResponse.json({
        error: `담당자 확인 질문에 답한 뒤 판단을 확정해 주세요: ${handoff.question}`,
      }, { status: 409 })
    }

    const ts = toDBString(now())
    const reason = input.data.reason ?? (input.data.decision === 'deductible' ? review.reason : '')
    const prorationRateBps = input.data.decision === 'prorated' ? input.data.prorationRateBps : null

    await db
      .update(vatDeductionReview)
      .set({
        decision: input.data.decision,
        reason,
        prorationRateBps,
        confirmedByStaffId: staffRecord.id,
        confirmedAt: ts,
        updatedAt: ts,
      })
      .where(and(eq(vatDeductionReview.id, review.id), eq(vatDeductionReview.tenantId, tenantId)))

    const [summary, reviewRows] = await Promise.all([
      db
        .select({
          id: vatPeriodSummary.id,
          outputTaxKrw: vatPeriodSummary.outputTaxKrw,
          inputTaxKrw: vatPeriodSummary.inputTaxKrw,
        })
        .from(vatPeriodSummary)
        .where(and(
          eq(vatPeriodSummary.tenantId, tenantId),
          eq(vatPeriodSummary.clientId, review.clientId),
          eq(vatPeriodSummary.periodKey, review.periodKey),
          eq(vatPeriodSummary.filingType, 'final'),
        ))
        .limit(1),
      db
        .select({
          decision: vatDeductionReview.decision,
          inputTaxKrw: vatDeductionReview.inputTaxKrw,
          prorationRateBps: vatDeductionReview.prorationRateBps,
        })
        .from(vatDeductionReview)
        .where(and(
          eq(vatDeductionReview.tenantId, tenantId),
          eq(vatDeductionReview.clientId, review.clientId),
          eq(vatDeductionReview.periodKey, review.periodKey),
        )),
    ])

    const periodSummary = summary[0]
    const recalculation = buildVatPeriodRecalculation({
      outputTaxKrw: periodSummary?.outputTaxKrw ?? 0,
      inputTaxKrw: periodSummary?.inputTaxKrw ?? 0,
    }, reviewRows)

    if (periodSummary) {
      await db
        .update(vatPeriodSummary)
        .set({
          inputTaxDeductibleKrw: recalculation.inputTaxDeductibleKrw,
          payableTaxKrw: recalculation.payableTaxKrw,
          pendingDeductionCount: recalculation.pendingDeductionCount,
          packageStatus: recalculation.packageStatus,
          updatedAt: ts,
        })
        .where(and(eq(vatPeriodSummary.id, periodSummary.id), eq(vatPeriodSummary.tenantId, tenantId)))
    }

    revalidatePath('/dashboard/vat')
    revalidatePath('/dashboard')

    return NextResponse.json({
      ok: true,
      reviewId: review.id,
      decision: input.data.decision,
      pendingDeductionCount: recalculation.pendingDeductionCount,
      packageStatus: recalculation.packageStatus,
    })
  } catch (err) {
    console.error('[PATCH /api/vat/deduction-reviews/[reviewId]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
