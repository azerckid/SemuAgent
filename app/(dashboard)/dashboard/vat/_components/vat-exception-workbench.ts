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
    if (!deductionReview && !isVatTaxTreatmentException(row)) return []
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

export function isVatTaxTreatmentException(row: VatTaxTreatmentDisplayRow) {
  const evidenceComplete = row.requiredEvidence.every((item) => item.status === 'present')
  const isUserResolved = row.userActionStatus === 'confirmed'
    && row.finalDecision !== null
    && evidenceComplete
  if (isUserResolved) return false

  const isDeterministicNormal = row.finalDecision === null
    && row.userActionStatus === 'pending'
    && row.source === 'deterministic_rule'
    && row.confidence === 'high'
    && row.currentVatFact.status === 'confirmed'
    && (row.recommendation === 'likely_taxable' || row.recommendation === 'likely_deductible')
    && row.hometaxAction === 'expected_no_change'
    && row.missingFacts.length === 0
    && evidenceComplete

  return !isDeterministicNormal
}
