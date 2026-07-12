import { z } from 'zod'
import {
  vatTaxTreatmentAiRuntimeStatusSchema,
  vatTaxTreatmentAiTraceSchema,
  vatTaxTreatmentConfidenceSchema,
  vatTaxTreatmentEvidenceSearchSchema,
  vatTaxTreatmentHometaxActionSchema,
  vatTaxTreatmentHumanHandoffSchema,
  vatTaxTreatmentJudgmentWorkflowStatusSchema,
  vatTaxTreatmentProvisionalJudgmentSchema,
  vatTaxTreatmentRecommendationValueSchema,
  vatTaxTreatmentSourceSchema,
} from './vat-tax-treatment'

export const VAT_TAX_TREATMENT_AI_PROMPT_VERSION = 'vat-tax-treatment-v5' as const
export const VAT_TAX_TREATMENT_AI_RESULT_PAYLOAD_VERSION = 5 as const

export const vatTaxTreatmentAiResultStatusSchema = z.enum([
  'queued',
  'running',
  'ready',
  'manual_fallback',
  'stale',
])

export const vatTaxTreatmentAiResultPayloadSchema = z.object({
  version: z.literal(VAT_TAX_TREATMENT_AI_RESULT_PAYLOAD_VERSION),
  recommendation: vatTaxTreatmentRecommendationValueSchema,
  provisionalJudgment: vatTaxTreatmentProvisionalJudgmentSchema.nullable(),
  judgmentWorkflowStatus: vatTaxTreatmentJudgmentWorkflowStatusSchema,
  evidenceTrace: vatTaxTreatmentEvidenceSearchSchema.shape.evidenceTrace,
  searchedSources: vatTaxTreatmentEvidenceSearchSchema.shape.searchedSources,
  source: vatTaxTreatmentSourceSchema,
  confidence: vatTaxTreatmentConfidenceSchema,
  basisLabel: z.string().min(1).max(500),
  ruleReference: z.string().max(200).nullable(),
  missingFacts: z.array(z.string().min(1).max(200)).max(12),
  hometaxAction: vatTaxTreatmentHometaxActionSchema,
  aiTrace: vatTaxTreatmentAiTraceSchema.nullable(),
  aiRuntimeStatus: vatTaxTreatmentAiRuntimeStatusSchema,
  humanHandoff: vatTaxTreatmentHumanHandoffSchema.nullable(),
}).superRefine((value, context) => {
  const evidenceSearch = vatTaxTreatmentEvidenceSearchSchema.safeParse({
    evidenceTrace: value.evidenceTrace,
    searchedSources: value.searchedSources,
  })
  if (!evidenceSearch.success) {
    for (const issue of evidenceSearch.error.issues) {
      context.addIssue({ ...issue, path: ['evidenceSearch', ...issue.path] })
    }
  }
  const isAiResult = value.source === 'ai_single' || value.source === 'ai_consensus'
  if (isAiResult !== Boolean(value.aiTrace)) {
    context.addIssue({
      code: 'custom',
      path: ['aiTrace'],
      message: '저장 AI 출처와 provider trace가 일치해야 합니다.',
    })
  }
  if (isAiResult && value.aiRuntimeStatus !== 'completed') {
    context.addIssue({
      code: 'custom',
      path: ['aiRuntimeStatus'],
      message: '완료된 AI 결과는 completed 상태여야 합니다.',
    })
  }
  if (
    isAiResult
    && (
      value.recommendation === 'needs_review'
      ||
      value.provisionalJudgment === null
      || (
        value.judgmentWorkflowStatus !== 'user_confirmation_pending'
        && value.judgmentWorkflowStatus !== 'no_evidence_defaulted'
      )
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['provisionalJudgment'],
      message: '완료된 AI 결과는 잠정 세무 결론과 사용자 확인 대기 상태를 저장해야 합니다.',
    })
  }
  const requiresHumanResolution = value.judgmentWorkflowStatus === 'human_resolution_required'
  if (requiresHumanResolution !== Boolean(value.humanHandoff)) {
    context.addIssue({
      code: 'custom',
      path: ['humanHandoff'],
      message: '저장 담당자 이관 결과에는 구조화된 handoff payload가 필요합니다.',
    })
  }
  if (
    value.humanHandoff
    && value.humanHandoff.provisionalJudgment !== value.provisionalJudgment
  ) {
    context.addIssue({
      code: 'custom',
      path: ['humanHandoff', 'provisionalJudgment'],
      message: '저장 handoff의 잠정 결론은 결과 잠정 결론과 같아야 합니다.',
    })
  }
  if (
    value.aiRuntimeStatus === 'no_consensus'
    && value.humanHandoff?.reason !== 'no_consensus'
  ) {
    context.addIssue({
      code: 'custom',
      path: ['aiRuntimeStatus'],
      message: '저장 no_consensus 결과에는 해당 handoff payload가 필요합니다.',
    })
  }
  if (
    value.humanHandoff?.reason === 'no_consensus'
    && value.aiRuntimeStatus !== 'no_consensus'
  ) {
    context.addIssue({
      code: 'custom',
      path: ['humanHandoff', 'reason'],
      message: '저장 no_consensus handoff는 실제 다중 AI 불합의 상태에서만 허용합니다.',
    })
  }
  if (
    (value.aiRuntimeStatus === 'manual_fallback' || value.aiRuntimeStatus === 'deferred')
    && (
      value.recommendation !== 'needs_review'
      || value.provisionalJudgment !== null
      || value.judgmentWorkflowStatus !== 'ai_temporary_error'
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['judgmentWorkflowStatus'],
      message: 'AI fallback은 세무 결론이 아니라 일시 오류 workflow로 저장해야 합니다.',
    })
  }
  if (
    value.judgmentWorkflowStatus === 'no_evidence_defaulted'
    && value.missingFacts.length === 0
  ) {
    context.addIssue({
      code: 'custom',
      path: ['missingFacts'],
      message: '근거 없음 기본처리 결과에는 찾지 못한 특례·공제 근거가 필요합니다.',
    })
  }
})

export const vatTaxTreatmentAiProviderTraceSchema = z.object({
  provider: z.enum(['gemini', 'openai', 'claude']),
  modelName: z.string().min(1).max(100),
  status: z.enum(['completed', 'failed', 'timeout']),
})

export const vatTaxTreatmentAiProviderTraceListSchema = z
  .array(vatTaxTreatmentAiProviderTraceSchema)
  .max(3)

export type VatTaxTreatmentAiResultStatus = z.infer<typeof vatTaxTreatmentAiResultStatusSchema>
export type VatTaxTreatmentAiResultPayload = z.infer<typeof vatTaxTreatmentAiResultPayloadSchema>
export type VatTaxTreatmentAiProviderTrace = z.infer<typeof vatTaxTreatmentAiProviderTraceSchema>
