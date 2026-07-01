import { z } from 'zod'
import {
  PAYROLL_ADAPTIVE_IGNORED_REGION_REASONS,
  PAYROLL_ADAPTIVE_MODEL_TYPES,
  PAYROLL_ADAPTIVE_TARGET_FIELDS,
} from './adaptive-structuring-proposal-schema'

const PAYROLL_ADAPTIVE_FIELD_DATA_TYPES = ['date', 'amount', 'text', 'identifier', 'memo'] as const
export type PayrollAdaptiveFieldDataType = typeof PAYROLL_ADAPTIVE_FIELD_DATA_TYPES[number]

const PAYROLL_ADAPTIVE_VALIDATION_RULE_TYPES = [
  'required_field',
  'date_parse',
  'amount_parse',
  'at_least_one_of',
  'row_count_min',
] as const

// spec: docs/03_Technical_Specs/31_PAYROLL_ADAPTIVE_STRUCTURING_SPEC.md #3
export const payrollAdaptiveWorkbookSignatureSchema = z.object({
  sheetNamePatterns: z.array(z.string().min(1)).default([]),
  requiredHeaderLabels: z.array(z.string().min(1)).min(1),
  optionalHeaderLabels: z.array(z.string()).default([]),
  headerRowCandidates: z.array(z.number().int().min(1)).default([]),
  payrollPeriodSignals: z.array(z.string()).default([]),
})

export const payrollAdaptiveFieldMappingRuleSchema = z.object({
  sheetName: z.string().min(1),
  sourceColumn: z.string().min(1),
  targetField: z.enum(PAYROLL_ADAPTIVE_TARGET_FIELDS),
  required: z.boolean().default(false),
  dataType: z.enum(PAYROLL_ADAPTIVE_FIELD_DATA_TYPES),
})

export const payrollAdaptiveIgnoredRegionRuleSchema = z.object({
  sheetName: z.string().min(1),
  sourceColumnOrRegion: z.string().min(1),
  reason: z.enum(PAYROLL_ADAPTIVE_IGNORED_REGION_REASONS),
})

export const payrollAdaptiveValidationRuleSchema = z.object({
  type: z.enum(PAYROLL_ADAPTIVE_VALIDATION_RULE_TYPES),
  fields: z.array(z.string()).default([]),
  message: z.string().min(1),
})

export const payrollAdaptiveModelContractSchema = z.object({
  targetWorkflow: z.literal('payroll'),
  payrollModelType: z.enum(PAYROLL_ADAPTIVE_MODEL_TYPES),
  workbookSignature: payrollAdaptiveWorkbookSignatureSchema,
  fieldMappings: z.array(payrollAdaptiveFieldMappingRuleSchema).min(1),
  ignoredRegions: z.array(payrollAdaptiveIgnoredRegionRuleSchema).default([]),
  validationRules: z.array(payrollAdaptiveValidationRuleSchema).default([]),
  outputMode: z.enum(['preview_only', 'draft_rows_needs_review']),
})

export type PayrollAdaptiveWorkbookSignature = z.infer<typeof payrollAdaptiveWorkbookSignatureSchema>
export type PayrollAdaptiveFieldMappingRule = z.infer<typeof payrollAdaptiveFieldMappingRuleSchema>
export type PayrollAdaptiveIgnoredRegionRule = z.infer<typeof payrollAdaptiveIgnoredRegionRuleSchema>
export type PayrollAdaptiveValidationRule = z.infer<typeof payrollAdaptiveValidationRuleSchema>
export type PayrollAdaptiveModelContract = z.infer<typeof payrollAdaptiveModelContractSchema>
