import { z } from 'zod'
import {
  REVIEW_ADAPTIVE_IGNORED_REGION_REASONS,
  REVIEW_ADAPTIVE_MODEL_TYPES,
  REVIEW_ADAPTIVE_TARGET_FIELDS,
} from './adaptive-structuring-proposal-schema'

const REVIEW_ADAPTIVE_FIELD_DATA_TYPES = ['date', 'amount', 'text', 'memo'] as const
export type ReviewAdaptiveFieldDataType = typeof REVIEW_ADAPTIVE_FIELD_DATA_TYPES[number]

const REVIEW_ADAPTIVE_VALIDATION_RULE_TYPES = [
  'required_field',
  'date_parse',
  'amount_parse',
  'at_least_one_of',
  'row_count_min',
] as const

// spec: docs/03_Technical_Specs/29_ADAPTIVE_DATA_STRUCTURING_SPEC.md #5.1
export const reviewAdaptiveWorkbookSignatureSchema = z.object({
  sheetNamePatterns: z.array(z.string().min(1)).default([]),
  requiredHeaderLabels: z.array(z.string().min(1)).min(1),
  optionalHeaderLabels: z.array(z.string()).default([]),
  headerRowCandidates: z.array(z.number().int().min(1)).default([]),
})

export const reviewAdaptiveFieldMappingRuleSchema = z.object({
  sheetName: z.string().min(1),
  sourceColumn: z.string().min(1),
  targetField: z.enum(REVIEW_ADAPTIVE_TARGET_FIELDS),
  required: z.boolean().default(false),
  dataType: z.enum(REVIEW_ADAPTIVE_FIELD_DATA_TYPES),
})

export const reviewAdaptiveIgnoredRegionRuleSchema = z.object({
  sheetName: z.string().min(1),
  sourceColumnOrRegion: z.string().min(1),
  reason: z.enum(REVIEW_ADAPTIVE_IGNORED_REGION_REASONS),
})

export const reviewAdaptiveValidationRuleSchema = z.object({
  type: z.enum(REVIEW_ADAPTIVE_VALIDATION_RULE_TYPES),
  fields: z.array(z.string()).default([]),
  message: z.string().min(1),
})

export const reviewAdaptiveModelContractSchema = z.object({
  // 이번 Slice 3는 기장 거래자료 구조화를 목표로 한다. workType이 vat/unknown인
  // 세션에서도 후보가 보일 수 있지만(Slice 1/2가 workType으로 거르지 않음), contract
  // 자체는 거래(transaction) 단위 row를 다루므로 bookkeeping으로 고정한다. DB 저장이
  // 없는 PoC라 워크플로 게이팅에 실질 영향은 없다.
  targetWorkflow: z.literal('bookkeeping'),
  reviewModelType: z.enum(REVIEW_ADAPTIVE_MODEL_TYPES),
  workbookSignature: reviewAdaptiveWorkbookSignatureSchema,
  fieldMappings: z.array(reviewAdaptiveFieldMappingRuleSchema).min(1),
  ignoredRegions: z.array(reviewAdaptiveIgnoredRegionRuleSchema).default([]),
  validationRules: z.array(reviewAdaptiveValidationRuleSchema).default([]),
  outputMode: z.enum(['preview_only', 'draft_rows_needs_review']),
})

export type ReviewAdaptiveWorkbookSignature = z.infer<typeof reviewAdaptiveWorkbookSignatureSchema>
export type ReviewAdaptiveFieldMappingRule = z.infer<typeof reviewAdaptiveFieldMappingRuleSchema>
export type ReviewAdaptiveIgnoredRegionRule = z.infer<typeof reviewAdaptiveIgnoredRegionRuleSchema>
export type ReviewAdaptiveValidationRule = z.infer<typeof reviewAdaptiveValidationRuleSchema>
export type ReviewAdaptiveModelContract = z.infer<typeof reviewAdaptiveModelContractSchema>
