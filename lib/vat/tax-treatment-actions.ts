import type {
  VatTaxTreatmentDisplayRow,
  VatTaxTreatmentFinalDecision,
} from '@/lib/validations/vat-tax-treatment'

export type VatTaxTreatmentDecisionOption = {
  readonly value: VatTaxTreatmentFinalDecision
  readonly label: string
}

const PURCHASE_DECISIONS: readonly VatTaxTreatmentDecisionOption[] = [
  { value: 'deductible', label: '공제' },
  { value: 'non_deductible', label: '불공제' },
  { value: 'prorated', label: '안분' },
]

const SALE_DECISIONS: readonly VatTaxTreatmentDecisionOption[] = [
  { value: 'taxable', label: '과세' },
  { value: 'zero_rated', label: '영세율' },
  { value: 'exempt', label: '면세' },
  { value: 'non_taxable', label: '비과세' },
]

export function vatTaxTreatmentDecisionOptions(
  direction: VatTaxTreatmentDisplayRow['direction'],
) {
  return direction === 'purchase' ? PURCHASE_DECISIONS : SALE_DECISIONS
}

export function vatTaxTreatmentDecisionLabel(value: VatTaxTreatmentFinalDecision) {
  const direction = ['deductible', 'non_deductible', 'prorated'].includes(value)
    ? 'purchase'
    : 'sale'
  return vatTaxTreatmentDecisionOptions(direction)
    .find((option) => option.value === value)?.label ?? value
}

export function finalDecisionForVatRecommendation(
  recommendation: VatTaxTreatmentDisplayRow['recommendation'],
): VatTaxTreatmentFinalDecision | null {
  if (recommendation === 'likely_deductible') return 'deductible'
  if (recommendation === 'likely_non_deductible') return 'non_deductible'
  if (recommendation === 'likely_taxable') return 'taxable'
  if (recommendation === 'likely_zero_rated') return 'zero_rated'
  if (recommendation === 'likely_exempt') return 'exempt'
  return null
}

export function finalDecisionForVatProvisionalJudgment(
  judgment: VatTaxTreatmentDisplayRow['provisionalJudgment'],
): VatTaxTreatmentFinalDecision | null {
  if (judgment === 'proration_required') return 'prorated'
  return judgment
}

export function missingRequiredEvidenceForVatDecision(
  row: Pick<VatTaxTreatmentDisplayRow, 'requiredEvidence'>,
  decision: VatTaxTreatmentFinalDecision,
) {
  const requiredCode = decision === 'zero_rated'
    ? 'export_or_zero_rate_documents'
    : decision === 'exempt'
      ? 'exemption_qualification'
      : null
  if (!requiredCode) return false
  return !row.requiredEvidence.some((item) => item.code === requiredCode && item.status === 'present')
}

export function canApplyVatTaxTreatmentRecommendation(
  row: Pick<VatTaxTreatmentDisplayRow, 'recommendation' | 'requiredEvidence'>
    & Partial<Pick<VatTaxTreatmentDisplayRow, 'humanHandoff'>>,
) {
  if (row.humanHandoff) return false
  const decision = finalDecisionForVatRecommendation(row.recommendation)
  return decision !== null && !missingRequiredEvidenceForVatDecision(row, decision)
}

export function defaultDifferentVatDecision(row: Pick<
  VatTaxTreatmentDisplayRow,
  'direction' | 'recommendation' | 'finalDecision'
>) {
  const options = vatTaxTreatmentDecisionOptions(row.direction)
  if (row.recommendation === 'proration_required') return 'prorated' as const
  const current = row.finalDecision ?? finalDecisionForVatRecommendation(row.recommendation)
  return options.find((option) => option.value !== current)?.value ?? options[0]!.value
}
