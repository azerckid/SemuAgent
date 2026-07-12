import type { VatTaxTreatmentDisplayRow } from '@/lib/validations/vat-tax-treatment'
import type { VatDeductionReviewRow } from '@/lib/vat/summary'

export type VatTreatmentExceptionRow = {
  row: VatTaxTreatmentDisplayRow
  deductionReview: VatDeductionReviewRow | null
}

export type VatExceptionWorkbenchModel = {
  treatmentRows: VatTreatmentExceptionRow[]
  standaloneDeductionReviews: VatDeductionReviewRow[]
  exceptionCount: number
}

export type VatWorkbenchDecision =
  | 'deductible'
  | 'non_deductible'
  | 'proration_required'
  | 'taxable'
  | 'zero_rated'
  | 'exempt'
  | 'non_taxable'
  | 'judgment_pending'

export function buildVatExceptionWorkbenchModel(params: {
  treatmentRows: VatTaxTreatmentDisplayRow[]
  deductionReviews: VatDeductionReviewRow[]
}): VatExceptionWorkbenchModel {
  const pendingReviews = params.deductionReviews.filter((review) => review.decision === 'pending')
  const pendingReviewByClassification = new Map(
    pendingReviews.flatMap((review) => (
      review.classificationRowId ? [[review.classificationRowId, review] as const] : []
    )),
  )
  const treatmentRows = params.treatmentRows.flatMap((row) => {
    const deductionReview = pendingReviewByClassification.get(row.classificationRowId) ?? null
    if (!deductionReview && !isVatFilingModificationRequired(row)) return []
    return [{ row, deductionReview }]
  })
  const displayedClassifications = new Set(treatmentRows.map(({ row }) => row.classificationRowId))
  const standaloneDeductionReviews = pendingReviews.filter((review) => (
    !review.classificationRowId || !displayedClassifications.has(review.classificationRowId)
  ))

  return {
    treatmentRows,
    standaloneDeductionReviews,
    exceptionCount: treatmentRows.length + standaloneDeductionReviews.length,
  }
}

export function isVatFilingModificationRequired(row: VatTaxTreatmentDisplayRow) {
  const evidenceComplete = row.requiredEvidence.every((item) => item.status === 'present')
  const isUserResolved = row.userActionStatus === 'confirmed'
    && row.finalDecision !== null
    && evidenceComplete
  if (isUserResolved) return false
  if (row.humanHandoff) return true
  return row.hometaxAction !== 'expected_no_change'
}

export function resolveVatTreatmentWorkbenchDecision(
  row: VatTaxTreatmentDisplayRow,
): VatWorkbenchDecision {
  return row.provisionalJudgment ?? 'judgment_pending'
}

export function resolveVatDeductionReviewWorkbenchDecision(
  review: VatDeductionReviewRow,
): VatWorkbenchDecision {
  if (review.decision === 'deductible' || review.decision === 'prorated') return 'deductible'
  if (review.decision === 'non_deductible') return 'non_deductible'
  if (review.kind === 'non_deductible_candidate') return 'non_deductible'
  return 'deductible'
}
