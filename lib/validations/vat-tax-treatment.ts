import { z } from 'zod'
import { vatPeriodKeySchema } from './vat'

export const VAT_TAX_TREATMENT_RULE_VERSION = 'vat-kr-2026.07-v1' as const

export const vatTaxTreatmentDirectionSchema = z.enum(['sale', 'purchase'])
export const vatTaxTreatmentRecommendationValueSchema = z.enum([
  'likely_taxable',
  'likely_zero_rated',
  'likely_exempt',
  'likely_deductible',
  'likely_non_deductible',
  'proration_required',
  'needs_review',
])
export const vatTaxTreatmentSourceSchema = z.enum([
  'deterministic_rule',
  'prior_confirmed_pattern',
  'ai_single',
  'ai_consensus',
])
export const vatTaxTreatmentConfidenceSchema = z.enum(['high', 'medium', 'low'])
export const vatTaxTreatmentAiRuntimeStatusSchema = z.enum([
  'not_requested',
  'completed',
  'manual_fallback',
  'deferred',
])
export const vatTaxTreatmentEvidenceStatusSchema = z.enum(['present', 'missing', 'needs_review'])
export const vatTaxTreatmentHometaxActionSchema = z.enum([
  'expected_no_change',
  'review_deduction',
  'review_sales_tax_type',
  'add_or_correct_amount',
  'review_proration',
  'compare_in_hometax',
])
export const vatTaxTreatmentFinalDecisionSchema = z.enum([
  'deductible',
  'non_deductible',
  'prorated',
  'taxable',
  'zero_rated',
  'exempt',
  'non_taxable',
])
export const vatTaxTreatmentUserActionStatusSchema = z.enum([
  'pending',
  'confirmed',
  'held',
  'expert_review',
])

export const vatTaxTreatmentRequiredEvidenceSchema = z.object({
  code: z.string().min(1).max(100),
  label: z.string().min(1).max(120),
  status: vatTaxTreatmentEvidenceStatusSchema,
})

export const vatTaxTreatmentAiTraceSchema = z.object({
  provider: z.enum(['gemini', 'openai', 'claude']),
  modelName: z.string().min(1).max(100),
  promptVersion: z.string().min(1).max(100),
  consensusProviders: z.array(z.enum(['gemini', 'openai', 'claude'])).max(3),
})

export const vatTaxTreatmentRecommendationSchema = z.object({
  rowId: z.string().min(1),
  classificationRowId: z.string().min(1),
  tenantId: z.string().min(1),
  businessEntityId: z.string().min(1),
  periodKey: z.string().min(1),
  direction: vatTaxTreatmentDirectionSchema,
  currentVatFact: z.object({
    taxType: z.enum(['taxable', 'zero_rated', 'exempt', 'non_taxable', 'needs_review']),
    supplyAmountKrw: z.number().int().nonnegative(),
    taxAmountKrw: z.number().int().nonnegative(),
    grossAmountKrw: z.number().int().nonnegative(),
    source: z.enum(['parser', 'manual']),
    status: z.enum(['derived', 'confirmed']),
  }),
  recommendation: vatTaxTreatmentRecommendationValueSchema,
  source: vatTaxTreatmentSourceSchema,
  confidence: vatTaxTreatmentConfidenceSchema,
  basisLabel: z.string().min(1).max(500),
  ruleReference: z.string().max(200).nullable(),
  ruleVersion: z.literal(VAT_TAX_TREATMENT_RULE_VERSION),
  requiredEvidence: z.array(vatTaxTreatmentRequiredEvidenceSchema).max(12),
  missingFacts: z.array(z.string().min(1).max(200)).max(12),
  hometaxComparisonMode: z.literal('expected_prefill'),
  hometaxAction: vatTaxTreatmentHometaxActionSchema,
  aiTrace: vatTaxTreatmentAiTraceSchema.nullable(),
  aiRuntimeStatus: vatTaxTreatmentAiRuntimeStatusSchema,
  finalDecision: vatTaxTreatmentFinalDecisionSchema.nullable(),
  confirmedByStaffId: z.string().min(1).nullable(),
  confirmedAt: z.string().min(1).nullable(),
}).superRefine((value, context) => {
  const purchaseDecisions = new Set(['deductible', 'non_deductible', 'prorated'])
  const saleDecisions = new Set(['taxable', 'zero_rated', 'exempt', 'non_taxable'])

  if (
    value.finalDecision
    && value.direction === 'purchase'
    && !purchaseDecisions.has(value.finalDecision)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['finalDecision'],
      message: '매입 행은 공제·불공제·안분 결정만 가질 수 있습니다.',
    })
  }
  if (
    value.finalDecision
    && value.direction === 'sale'
    && !saleDecisions.has(value.finalDecision)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['finalDecision'],
      message: '매출 행은 과세·영세율·면세·비과세 결정만 가질 수 있습니다.',
    })
  }

  const isAiSource = value.source === 'ai_single' || value.source === 'ai_consensus'
  if (isAiSource !== Boolean(value.aiTrace)) {
    context.addIssue({
      code: 'custom',
      path: ['aiTrace'],
      message: 'AI 판단 출처와 AI trace가 일치해야 합니다.',
    })
  }
  if ((value.aiRuntimeStatus === 'completed') !== isAiSource) {
    context.addIssue({
      code: 'custom',
      path: ['aiRuntimeStatus'],
      message: 'AI 완료 상태와 AI 판단 출처가 일치해야 합니다.',
    })
  }
  if (
    (value.aiRuntimeStatus === 'manual_fallback' || value.aiRuntimeStatus === 'deferred')
    && value.recommendation !== 'needs_review'
  ) {
    context.addIssue({
      code: 'custom',
      path: ['aiRuntimeStatus'],
      message: 'AI fallback·deferred 행은 수동 확인 상태여야 합니다.',
    })
  }

  const hasConfirmationAudit = Boolean(value.confirmedByStaffId && value.confirmedAt)
  if (Boolean(value.finalDecision) !== hasConfirmationAudit) {
    context.addIssue({
      code: 'custom',
      path: ['confirmedAt'],
      message: '최종 결정과 확정자·확정시각은 함께 있어야 합니다.',
    })
  }
})

export const vatTaxTreatmentDisplayRowSchema = vatTaxTreatmentRecommendationSchema.and(z.object({
  recommendationFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  transactionDate: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),
  counterparty: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  sourceType: z.enum(['tax_invoice', 'card', 'receipt']),
  accountLabel: z.string().min(1).max(120).nullable(),
  userActionStatus: vatTaxTreatmentUserActionStatusSchema.default('pending'),
  userActionReason: z.string().max(500).nullable().default(null),
})).superRefine((value, context) => {
  if (value.userActionStatus === 'confirmed' && !value.finalDecision) {
    context.addIssue({
      code: 'custom',
      path: ['userActionStatus'],
      message: '사용자 확정 상태에는 최종 결정이 필요합니다.',
    })
  }
  if (
    (value.userActionStatus === 'held' || value.userActionStatus === 'expert_review')
    && value.finalDecision
  ) {
    context.addIssue({
      code: 'custom',
      path: ['userActionStatus'],
      message: '보류·전문가 확인 상태에는 최종 결정이 없어야 합니다.',
    })
  }
})

const vatTaxTreatmentMutationBase = {
  periodKey: vatPeriodKeySchema,
  recommendationFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
}

export const vatTaxTreatmentMutationSchema = z.discriminatedUnion('action', [
  z.object({
    ...vatTaxTreatmentMutationBase,
    action: z.literal('apply_recommendation'),
  }),
  z.object({
    ...vatTaxTreatmentMutationBase,
    action: z.literal('confirm_different'),
    finalDecision: vatTaxTreatmentFinalDecisionSchema,
    reason: z.string().trim().min(1).max(500),
    prorationRateBps: z.number().int().min(1).max(10_000).optional(),
  }),
  z.object({
    ...vatTaxTreatmentMutationBase,
    action: z.literal('hold'),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    ...vatTaxTreatmentMutationBase,
    action: z.literal('expert_review'),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    periodKey: vatPeriodKeySchema,
    action: z.literal('undo'),
    undoToken: z.string().uuid(),
  }),
]).superRefine((value, context) => {
  if (value.action !== 'confirm_different') return
  if (value.finalDecision === 'prorated' && value.prorationRateBps === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['prorationRateBps'],
      message: '안분 확정에는 안분율이 필요합니다.',
    })
  }
  if (value.finalDecision !== 'prorated' && value.prorationRateBps !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['prorationRateBps'],
      message: '안분 결정이 아닐 때는 안분율을 저장할 수 없습니다.',
    })
  }
})

export const vatTaxTreatmentMutationSuccessSchema = z.object({
  ok: z.literal(true),
  status: vatTaxTreatmentUserActionStatusSchema,
  finalDecision: vatTaxTreatmentFinalDecisionSchema.nullable(),
  undoToken: z.string().uuid().nullable(),
})

export type VatTaxTreatmentRecommendation = z.infer<typeof vatTaxTreatmentRecommendationSchema>
export type VatTaxTreatmentDisplayRow = z.infer<typeof vatTaxTreatmentDisplayRowSchema>
export type VatTaxTreatmentRequiredEvidence = z.infer<typeof vatTaxTreatmentRequiredEvidenceSchema>
export type VatTaxTreatmentFinalDecision = z.infer<typeof vatTaxTreatmentFinalDecisionSchema>
export type VatTaxTreatmentMutationInput = z.infer<typeof vatTaxTreatmentMutationSchema>
export type VatTaxTreatmentMutationSuccess = z.infer<typeof vatTaxTreatmentMutationSuccessSchema>
