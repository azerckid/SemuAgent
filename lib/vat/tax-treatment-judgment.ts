import type {
  VatTaxTreatmentAiRuntimeStatus,
  VatTaxTreatmentFinalDecision,
  VatTaxTreatmentJudgmentWorkflowStatus,
  VatTaxTreatmentProvisionalJudgment,
  VatTaxTreatmentRecommendationValue,
} from '@/lib/validations/vat-tax-treatment'

const recommendationToJudgment: Record<
  Exclude<VatTaxTreatmentRecommendationValue, 'needs_review'>,
  VatTaxTreatmentProvisionalJudgment
> = {
  likely_taxable: 'taxable',
  likely_zero_rated: 'zero_rated',
  likely_exempt: 'exempt',
  likely_deductible: 'deductible',
  likely_non_deductible: 'non_deductible',
  proration_required: 'proration_required',
}

const judgmentToRecommendation: Record<
  Exclude<VatTaxTreatmentProvisionalJudgment, 'non_taxable'>,
  Exclude<VatTaxTreatmentRecommendationValue, 'needs_review'>
> = {
  taxable: 'likely_taxable',
  zero_rated: 'likely_zero_rated',
  exempt: 'likely_exempt',
  deductible: 'likely_deductible',
  non_deductible: 'likely_non_deductible',
  proration_required: 'proration_required',
}

export function provisionalJudgmentForRecommendation(
  recommendation: VatTaxTreatmentRecommendationValue,
): VatTaxTreatmentProvisionalJudgment | null {
  if (recommendation === 'needs_review') return null
  return recommendationToJudgment[recommendation]
}

export function recommendationForProvisionalJudgment(
  judgment: Exclude<VatTaxTreatmentProvisionalJudgment, 'non_taxable'>,
): Exclude<VatTaxTreatmentRecommendationValue, 'needs_review'> {
  return judgmentToRecommendation[judgment]
}

export function provisionalJudgmentForFinalDecision(
  decision: VatTaxTreatmentFinalDecision,
): VatTaxTreatmentProvisionalJudgment {
  return decision === 'prorated' ? 'proration_required' : decision
}

export function deriveVatTaxTreatmentJudgmentContract(params: {
  recommendation: VatTaxTreatmentRecommendationValue
  aiRuntimeStatus: VatTaxTreatmentAiRuntimeStatus
  finalDecision: VatTaxTreatmentFinalDecision | null
}): {
  provisionalJudgment: VatTaxTreatmentProvisionalJudgment | null
  judgmentWorkflowStatus: VatTaxTreatmentJudgmentWorkflowStatus
} {
  if (params.finalDecision) {
    return {
      provisionalJudgment: provisionalJudgmentForFinalDecision(params.finalDecision),
      judgmentWorkflowStatus: 'user_confirmed',
    }
  }
  if (params.aiRuntimeStatus === 'manual_fallback' || params.aiRuntimeStatus === 'deferred') {
    return { provisionalJudgment: null, judgmentWorkflowStatus: 'ai_temporary_error' }
  }
  const provisionalJudgment = provisionalJudgmentForRecommendation(params.recommendation)
  return provisionalJudgment
    ? { provisionalJudgment, judgmentWorkflowStatus: 'user_confirmation_pending' }
    : { provisionalJudgment: null, judgmentWorkflowStatus: 'judgment_pending' }
}
