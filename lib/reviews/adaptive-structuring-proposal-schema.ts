import { z } from 'zod'

// spec: docs/03_Technical_Specs/29_ADAPTIVE_DATA_STRUCTURING_SPEC.md #3.3
export const REVIEW_ADAPTIVE_TARGET_FIELDS = [
  'transactionDate',
  'evidenceDate',
  'counterparty',
  'description',
  'amountKrw',
  // incomeAmountKrw/expenseAmountKrw: Slice 5 apply path 결정. 입금/지출 컬럼이 분리된
  // 워크북에서는 이 둘로 매핑해 direction(income/expense)을 모델이 추측하지 않고
  // 구조적으로 판단하게 한다. 단일 금액 컬럼만 있으면 amountKrw로 매핑되고, apply
  // 단계에서 direction은 'unknown'으로 남는다(계정항목 정리에서 사람이/규칙이 판단).
  'incomeAmountKrw',
  'expenseAmountKrw',
  'memo',
  'policyCandidate',
  'metadataCandidate',
  'resultOnlyCandidate',
] as const

export type ReviewAdaptiveTargetField = typeof REVIEW_ADAPTIVE_TARGET_FIELDS[number]

// 거래 row로 merge 가능하려면 거래일(또는 증빙일) + 금액 중 최소 하나의 날짜와 금액이
// 인식되어야 한다. payroll의 identity/period 요구사항에 대응한다.
export const REVIEW_ADAPTIVE_DATE_TARGET_FIELDS: ReviewAdaptiveTargetField[] = [
  'transactionDate',
  'evidenceDate',
]

export const REVIEW_ADAPTIVE_AMOUNT_TARGET_FIELDS: ReviewAdaptiveTargetField[] = [
  'amountKrw',
  'incomeAmountKrw',
  'expenseAmountKrw',
]

export const REVIEW_ADAPTIVE_MODEL_TYPES = ['transaction_detail', 'mixed_workbook'] as const

export type ReviewAdaptiveModelType = typeof REVIEW_ADAPTIVE_MODEL_TYPES[number]

export const REVIEW_ADAPTIVE_IGNORED_REGION_REASONS = [
  'metadata',
  'company_policy',
  'result_only',
  'footer_or_total',
  'sample_or_instruction',
  'unsupported',
  'uncertain',
] as const

export type ReviewAdaptiveIgnoredRegionReason = typeof REVIEW_ADAPTIVE_IGNORED_REGION_REASONS[number]

export const reviewAdaptiveCandidateSheetSchema = z.object({
  sheetName: z.string().min(1),
  role: z.enum(REVIEW_ADAPTIVE_MODEL_TYPES),
  confidence: z.number().min(0).max(1),
})

export const reviewAdaptiveFieldMappingSchema = z.object({
  sheetName: z.string().min(1),
  sourceColumn: z.string().min(1),
  targetField: z.enum(REVIEW_ADAPTIVE_TARGET_FIELDS),
  required: z.boolean().default(false),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().optional(),
})

export const reviewAdaptiveIgnoredRegionSchema = z.object({
  sheetName: z.string().min(1),
  sourceColumnOrRegion: z.string().min(1),
  reason: z.enum(REVIEW_ADAPTIVE_IGNORED_REGION_REASONS),
})

export const reviewAdaptiveSampleRowSchema = z.object({
  sheetName: z.string().min(1),
  sourceRowRef: z.string().min(1),
  values: z.record(z.string(), z.string()).default({}),
})

// spec #3.3 AdaptiveStructureProposal
export const reviewAdaptiveStructuringProposalResponseSchema = z.object({
  status: z.enum(['proposal_ready', 'not_eligible', 'needs_more_information']),
  reason: z.string().min(1),
  candidateSheets: z.array(reviewAdaptiveCandidateSheetSchema).default([]),
  proposedMappings: z.array(reviewAdaptiveFieldMappingSchema).default([]),
  sampleRows: z.array(reviewAdaptiveSampleRowSchema).default([]),
  ignoredRegions: z.array(reviewAdaptiveIgnoredRegionSchema).default([]),
  missingRequiredFields: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
})

export type ReviewAdaptiveCandidateSheet = z.infer<typeof reviewAdaptiveCandidateSheetSchema>
export type ReviewAdaptiveFieldMapping = z.infer<typeof reviewAdaptiveFieldMappingSchema>
export type ReviewAdaptiveIgnoredRegion = z.infer<typeof reviewAdaptiveIgnoredRegionSchema>
export type ReviewAdaptiveSampleRow = z.infer<typeof reviewAdaptiveSampleRowSchema>
export type ReviewAdaptiveStructuringProposalResponse = z.infer<
  typeof reviewAdaptiveStructuringProposalResponseSchema
>
