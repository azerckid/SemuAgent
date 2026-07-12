import { z } from 'zod'
import { vatPeriodKeySchema } from './vat'
import { vatTaxTreatmentAiWorkflowStateSchema } from './vat-tax-treatment-ai-workflow'

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
export const vatTaxTreatmentProvisionalJudgmentSchema = z.enum([
  'taxable',
  'zero_rated',
  'exempt',
  'deductible',
  'non_deductible',
  'proration_required',
  'non_taxable',
])
export const vatTaxTreatmentJudgmentWorkflowStatusSchema = z.enum([
  'judgment_pending',
  'user_confirmation_pending',
  'user_confirmed',
  'no_evidence_defaulted',
  'human_resolution_required',
  'ai_temporary_error',
])
export const VAT_TAX_TREATMENT_EVIDENCE_SOURCES = [
  'current_transaction',
  'linked_evidence',
  'exact_vat_fact',
  'reconciliation_result',
  'prior_confirmed_decision',
  'official_rule',
] as const
export const vatTaxTreatmentEvidenceSourceSchema = z.enum(VAT_TAX_TREATMENT_EVIDENCE_SOURCES)
export const vatTaxTreatmentEvidenceTraceItemSchema = z.object({
  source: vatTaxTreatmentEvidenceSourceSchema,
  status: z.enum(['found', 'not_found', 'not_applicable']),
  reference: z.string().min(1).max(240).nullable(),
  summary: z.string().min(1).max(300),
}).superRefine((value, context) => {
  if (value.status === 'found' && !value.reference) {
    context.addIssue({
      code: 'custom',
      path: ['reference'],
      message: '찾은 근거에는 실제 source reference가 필요합니다.',
    })
  }
  if (value.status !== 'found' && value.reference) {
    context.addIssue({
      code: 'custom',
      path: ['reference'],
      message: '찾지 못했거나 해당 없는 근거에는 reference를 둘 수 없습니다.',
    })
  }
})
export const vatTaxTreatmentEvidenceSearchSchema = z.object({
  evidenceTrace: z.array(vatTaxTreatmentEvidenceTraceItemSchema)
    .length(VAT_TAX_TREATMENT_EVIDENCE_SOURCES.length),
  searchedSources: z.array(vatTaxTreatmentEvidenceSourceSchema)
    .length(VAT_TAX_TREATMENT_EVIDENCE_SOURCES.length),
}).superRefine((value, context) => {
  const traceSources = new Set(value.evidenceTrace.map((item) => item.source))
  const searchedSources = new Set(value.searchedSources)
  for (const source of VAT_TAX_TREATMENT_EVIDENCE_SOURCES) {
    if (!traceSources.has(source)) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceTrace'],
        message: `${source} 탐색 결과가 필요합니다.`,
      })
    }
    if (!searchedSources.has(source)) {
      context.addIssue({
        code: 'custom',
        path: ['searchedSources'],
        message: `${source} 탐색 완료 기록이 필요합니다.`,
      })
    }
  }
  if (traceSources.size !== value.evidenceTrace.length) {
    context.addIssue({ code: 'custom', path: ['evidenceTrace'], message: '근거 source는 중복될 수 없습니다.' })
  }
  if (searchedSources.size !== value.searchedSources.length) {
    context.addIssue({ code: 'custom', path: ['searchedSources'], message: '탐색 source는 중복될 수 없습니다.' })
  }
})
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
export const vatTaxTreatmentAttestableEvidenceCodeSchema = z.enum([
  'export_or_zero_rate_documents',
  'exemption_qualification',
])
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
  attestedAt: z.string().min(1).optional(),
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
  provisionalJudgment: vatTaxTreatmentProvisionalJudgmentSchema.nullable(),
  judgmentWorkflowStatus: vatTaxTreatmentJudgmentWorkflowStatusSchema,
  evidenceTrace: vatTaxTreatmentEvidenceSearchSchema.shape.evidenceTrace,
  searchedSources: vatTaxTreatmentEvidenceSearchSchema.shape.searchedSources,
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

  const evidenceSearch = vatTaxTreatmentEvidenceSearchSchema.safeParse({
    evidenceTrace: value.evidenceTrace,
    searchedSources: value.searchedSources,
  })
  if (!evidenceSearch.success) {
    for (const issue of evidenceSearch.error.issues) {
      context.addIssue({ ...issue, path: ['evidenceSearch', ...issue.path] })
    }
  }

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
      message: 'AI fallback·deferred 행은 legacy 미결정값을 유지해야 합니다.',
    })
  }
  if (
    isAiSource
    && !value.finalDecision
    && (
      value.recommendation === 'needs_review'
      || value.provisionalJudgment === null
      || (
        value.judgmentWorkflowStatus !== 'user_confirmation_pending'
        && value.judgmentWorkflowStatus !== 'no_evidence_defaulted'
      )
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['provisionalJudgment'],
      message: '완료된 AI 판단은 generic 확인 필요가 아닌 명확한 잠정 결론이어야 합니다.',
    })
  }

  if (value.judgmentWorkflowStatus === 'user_confirmed' && !value.finalDecision) {
    context.addIssue({
      code: 'custom',
      path: ['judgmentWorkflowStatus'],
      message: '사용자 확정 workflow에는 최종 결정이 필요합니다.',
    })
  }
  if (value.finalDecision && value.judgmentWorkflowStatus !== 'user_confirmed') {
    context.addIssue({
      code: 'custom',
      path: ['judgmentWorkflowStatus'],
      message: '최종 결정이 있는 행은 사용자 확정 workflow여야 합니다.',
    })
  }
  if (
    value.judgmentWorkflowStatus === 'no_evidence_defaulted'
    && value.missingFacts.length === 0
  ) {
    context.addIssue({
      code: 'custom',
      path: ['missingFacts'],
      message: '근거 없음 기본처리에는 찾지 못한 특례·공제 근거를 명시해야 합니다.',
    })
  }
  if (
    value.judgmentWorkflowStatus === 'ai_temporary_error'
    && value.aiRuntimeStatus !== 'manual_fallback'
    && value.aiRuntimeStatus !== 'deferred'
  ) {
    context.addIssue({
      code: 'custom',
      path: ['judgmentWorkflowStatus'],
      message: 'AI 일시 오류 workflow는 실제 fallback·deferred 실행 상태가 필요합니다.',
    })
  }
  if (
    (value.aiRuntimeStatus === 'manual_fallback' || value.aiRuntimeStatus === 'deferred')
    && value.judgmentWorkflowStatus !== 'ai_temporary_error'
  ) {
    context.addIssue({
      code: 'custom',
      path: ['judgmentWorkflowStatus'],
      message: 'AI fallback·deferred는 세무 결론이 아니라 AI 일시 오류 workflow로 분리해야 합니다.',
    })
  }
  if (
    value.judgmentWorkflowStatus === 'judgment_pending'
    || value.judgmentWorkflowStatus === 'ai_temporary_error'
  ) {
    if (value.provisionalJudgment !== null) {
      context.addIssue({
        code: 'custom',
        path: ['provisionalJudgment'],
        message: '판단 대기·AI 일시 오류 상태는 완료된 잠정 결론을 가질 수 없습니다.',
      })
    }
  } else if (value.provisionalJudgment === null) {
    context.addIssue({
      code: 'custom',
      path: ['provisionalJudgment'],
      message: '완료된 judgment workflow에는 명확한 잠정 결론이 필요합니다.',
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
  aiWorkflow: vatTaxTreatmentAiWorkflowStateSchema.optional(),
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

export const vatTaxTreatmentEvidenceMutationSchema = z.object({
  periodKey: vatPeriodKeySchema,
  recommendationFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  evidenceCode: vatTaxTreatmentAttestableEvidenceCodeSchema,
  action: z.enum(['confirm', 'revoke']),
})

export const vatTaxTreatmentEvidenceMutationSuccessSchema = z.object({
  ok: z.literal(true),
  evidenceCode: vatTaxTreatmentAttestableEvidenceCodeSchema,
  status: z.enum(['present', 'revoked']),
  confirmedAt: z.string().min(1).nullable(),
})

export type VatTaxTreatmentRecommendation = z.infer<typeof vatTaxTreatmentRecommendationSchema>
export type VatTaxTreatmentDisplayRow = z.infer<typeof vatTaxTreatmentDisplayRowSchema>
export type VatTaxTreatmentRecommendationValue = z.infer<typeof vatTaxTreatmentRecommendationValueSchema>
export type VatTaxTreatmentAiRuntimeStatus = z.infer<typeof vatTaxTreatmentAiRuntimeStatusSchema>
export type VatTaxTreatmentProvisionalJudgment = z.infer<typeof vatTaxTreatmentProvisionalJudgmentSchema>
export type VatTaxTreatmentJudgmentWorkflowStatus = z.infer<typeof vatTaxTreatmentJudgmentWorkflowStatusSchema>
export type VatTaxTreatmentEvidenceSource = z.infer<typeof vatTaxTreatmentEvidenceSourceSchema>
export type VatTaxTreatmentEvidenceTraceItem = z.infer<typeof vatTaxTreatmentEvidenceTraceItemSchema>
export type VatTaxTreatmentEvidenceSearch = z.infer<typeof vatTaxTreatmentEvidenceSearchSchema>
export type VatTaxTreatmentRequiredEvidence = z.infer<typeof vatTaxTreatmentRequiredEvidenceSchema>
export type VatTaxTreatmentFinalDecision = z.infer<typeof vatTaxTreatmentFinalDecisionSchema>
export type VatTaxTreatmentMutationInput = z.infer<typeof vatTaxTreatmentMutationSchema>
export type VatTaxTreatmentMutationSuccess = z.infer<typeof vatTaxTreatmentMutationSuccessSchema>
export type VatTaxTreatmentAttestableEvidenceCode = z.infer<typeof vatTaxTreatmentAttestableEvidenceCodeSchema>
export type VatTaxTreatmentEvidenceMutationInput = z.infer<typeof vatTaxTreatmentEvidenceMutationSchema>
export type VatTaxTreatmentEvidenceMutationSuccess = z.infer<typeof vatTaxTreatmentEvidenceMutationSuccessSchema>
