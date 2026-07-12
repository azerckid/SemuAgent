import { z } from 'zod'
import {
  vatTaxTreatmentAiRuntimeStatusSchema,
  vatTaxTreatmentAiTraceSchema,
  vatTaxTreatmentConfidenceSchema,
  vatTaxTreatmentHometaxActionSchema,
  vatTaxTreatmentJudgmentWorkflowStatusSchema,
  vatTaxTreatmentProvisionalJudgmentSchema,
  vatTaxTreatmentRecommendationValueSchema,
  vatTaxTreatmentSourceSchema,
} from './vat-tax-treatment'

export const VAT_TAX_TREATMENT_AI_PROMPT_VERSION = 'vat-tax-treatment-v2' as const
export const VAT_TAX_TREATMENT_AI_RESULT_PAYLOAD_VERSION = 2 as const

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
  source: vatTaxTreatmentSourceSchema,
  confidence: vatTaxTreatmentConfidenceSchema,
  basisLabel: z.string().min(1).max(500),
  ruleReference: z.string().max(200).nullable(),
  missingFacts: z.array(z.string().min(1).max(200)).max(12),
  hometaxAction: vatTaxTreatmentHometaxActionSchema,
  aiTrace: vatTaxTreatmentAiTraceSchema.nullable(),
  aiRuntimeStatus: vatTaxTreatmentAiRuntimeStatusSchema,
}).superRefine((value, context) => {
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
      || value.judgmentWorkflowStatus !== 'user_confirmation_pending'
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['provisionalJudgment'],
      message: '완료된 AI 결과는 잠정 세무 결론과 사용자 확인 대기 상태를 저장해야 합니다.',
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
