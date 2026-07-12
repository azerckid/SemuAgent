import type { VatTaxTreatmentDisplayRow } from '@/lib/validations/vat-tax-treatment'

export const VAT_TAX_TREATMENT_HIGH_AMOUNT_KRW = 10_000_000

export function isHighRiskVatTaxTreatmentRow(row: VatTaxTreatmentDisplayRow) {
  if (row.finalDecision || row.userActionStatus !== 'pending') return false
  if (row.judgmentWorkflowStatus === 'human_resolution_required') return false
  if (row.judgmentWorkflowStatus === 'no_evidence_defaulted') return false
  if (row.source === 'ai_consensus') return false
  if (
    row.aiRuntimeStatus === 'manual_fallback'
    || row.aiRuntimeStatus === 'deferred'
    || row.aiRuntimeStatus === 'no_consensus'
  ) return false

  return row.recommendation === 'likely_zero_rated'
    || row.recommendation === 'likely_exempt'
    || row.currentVatFact.taxType === 'zero_rated'
    || row.currentVatFact.taxType === 'exempt'
    || row.currentVatFact.grossAmountKrw >= VAT_TAX_TREATMENT_HIGH_AMOUNT_KRW
    || row.confidence === 'low'
}

export function shouldEvaluateVatTaxTreatmentRowWithAi(row: VatTaxTreatmentDisplayRow) {
  if (row.finalDecision || row.userActionStatus !== 'pending') return false
  return isHighRiskVatTaxTreatmentRow(row)
    || (
      row.recommendation === 'needs_review'
      && row.aiRuntimeStatus === 'not_requested'
    )
}
