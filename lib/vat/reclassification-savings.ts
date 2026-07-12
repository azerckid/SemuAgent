import { z } from 'zod'
import {
  RECLASSIFICATION_CONFIDENCE_TIERS,
  RECLASSIFICATION_FACTOR_TYPES,
  RECLASSIFICATION_TARGET_CATEGORIES,
  type ReclassificationEvaluation,
} from './reclassification-evidence'

export const reclassificationUserDecisionSchema = z.enum([
  'pending',
  'reclassified',
  'kept_as_is',
])

const reclassificationEvaluationSchema = z.object({
  confidence: z.enum(RECLASSIFICATION_CONFIDENCE_TIERS),
  suggestedCategory: z.enum(RECLASSIFICATION_TARGET_CATEGORIES).nullable(),
  factors: z.array(z.object({
    type: z.enum(RECLASSIFICATION_FACTOR_TYPES),
    direction: z.enum(['supports', 'weakens']),
    summary: z.string().min(1),
  })),
  missingToConfirm: z.array(z.string().min(1)),
})

export const reclassificationSavingsCandidateSchema = z.object({
  reviewRowId: z.string().min(1),
  description: z.string(),
  counterparty: z.string().nullable(),
  supplyAmountKrw: z.number().int().nonnegative(),
  inputTaxKrw: z.number().int().nonnegative(),
  currentCategory: z.literal('entertainment_expense'),
  evaluation: reclassificationEvaluationSchema,
  potentialSavingsKrw: z.number().int().nonnegative(),
  savingsBasis: z.literal('maximum_additional_input_tax_if_fully_reclassified'),
  userDecision: reclassificationUserDecisionSchema,
  decisionRowId: z.string().min(1).nullable(),
}).superRefine((value, ctx) => {
  if (value.potentialSavingsKrw !== value.inputTaxKrw) {
    ctx.addIssue({
      code: 'custom',
      path: ['potentialSavingsKrw'],
      message: '최대 추가 공제 가능액은 원장에 저장된 매입세액과 같아야 합니다.',
    })
  }
})

export type ReclassificationSavingsCandidate = z.infer<typeof reclassificationSavingsCandidateSchema>

export function buildReclassificationSavingsCandidate(params: {
  reviewRowId: string
  description: string
  counterparty: string | null
  supplyAmountKrw: number
  inputTaxKrw: number
  evaluation: ReclassificationEvaluation
}): ReclassificationSavingsCandidate {
  return reclassificationSavingsCandidateSchema.parse({
    ...params,
    currentCategory: 'entertainment_expense',
    potentialSavingsKrw: params.inputTaxKrw,
    savingsBasis: 'maximum_additional_input_tax_if_fully_reclassified',
    userDecision: 'pending',
    decisionRowId: null,
  })
}
