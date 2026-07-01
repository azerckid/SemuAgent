import { z } from 'zod'

/**
 * 고객사별 급여기준 프로필(ClientPayrollRuleProfileV1)의 Zod 계약.
 *
 * AI가 사내규칙/매핑표를 구조화한 초안과 담당자가 승인한 기준 모두 이 스키마로
 * 검증한다. enum은 알 수 없는 값에서 fail closed 한다(Spec 4). profile_json에는
 * 직원 원자료(이름·금액·주민번호)를 담지 않는다 — 규칙/매핑/근거만 담는다.
 */

export const PAYROLL_RULE_PROFILE_SCHEMA_VERSION = 'client_payroll_rule_profile.v1' as const

/**
 * 급여 유효기간은 yyyy-MM(월)로 고정한다. 월 단위 문자열은 사전순 비교가
 * 시간순과 일치하므로 active profile 해석(기간 비교)이 안전해진다. 단일 자리
 * 월(2026-6)·잘못된 월(2026-13)·임의 문자열은 거부한다(fail closed).
 */
export const payrollPeriodMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'YYYY-MM 형식이어야 합니다')

export const PAYROLL_RULE_SOURCE_TYPES = [
  'natural_language',
  'mapping_table',
  'rule_document',
  'excel_embedded',
  'statutory_default',
] as const
export const payrollRuleSourceTypeSchema = z.enum(PAYROLL_RULE_SOURCE_TYPES)
export type PayrollRuleSourceType = z.infer<typeof payrollRuleSourceTypeSchema>

export const PAYROLL_RULE_SECURITY_LANES = ['normal', 'redacted', 'tee_required'] as const
export const payrollRuleSecurityLaneSchema = z.enum(PAYROLL_RULE_SECURITY_LANES)
export type PayrollRuleSecurityLane = z.infer<typeof payrollRuleSecurityLaneSchema>

export const PAYROLL_RULE_PROFILE_STATUSES = [
  'draft',
  'active',
  'superseded',
  'retired',
  'rejected',
] as const
export const payrollRuleProfileStatusSchema = z.enum(PAYROLL_RULE_PROFILE_STATUSES)
export type PayrollRuleProfileStatus = z.infer<typeof payrollRuleProfileStatusSchema>

export const PAYROLL_RULE_FORMULA_KINDS = [
  'fixed_amount',
  'unit_rate',
  'rate',
  'hours_multiplier',
  'table_lookup',
  'manual_input',
  'not_applicable',
] as const
export const payrollRuleFormulaKindSchema = z.enum(PAYROLL_RULE_FORMULA_KINDS)
export type PayrollRuleFormulaKind = z.infer<typeof payrollRuleFormulaKindSchema>

export const PAYROLL_RULE_BASIS_TYPES = [
  'company_rule',
  'statutory_default',
  'source_amount',
  'tax_treatment',
  'unknown',
] as const
export const payrollRuleBasisTypeSchema = z.enum(PAYROLL_RULE_BASIS_TYPES)
export type PayrollRuleBasisType = z.infer<typeof payrollRuleBasisTypeSchema>

export const payrollRuleLawBasisSchema = z.object({
  lawName: z.string().min(1),
  article: z.string().min(1),
  summary: z.string().optional(),
  url: z.string().url().optional(),
})
export type PayrollRuleLawBasis = z.infer<typeof payrollRuleLawBasisSchema>

export const payrollRuleCalculationSchema = z.object({
  expression: z.string().nullable().optional(),
  unitAmount: z.number().nonnegative().nullable().optional(),
  unit: z.string().nullable().optional(),
  quantityInputKey: z.string().nullable().optional(),
  multiplier: z.number().nonnegative().nullable().optional(),
  resultField: z.string().nullable().optional(),
})
export type PayrollRuleCalculation = z.infer<typeof payrollRuleCalculationSchema>

export const payrollRuleFormulaJsonSchema = z
  .object({
    summary: z.string().optional(),
    basisType: payrollRuleBasisTypeSchema.optional(),
    lawBasis: z.array(payrollRuleLawBasisSchema).optional(),
    calculation: payrollRuleCalculationSchema.nullable().optional(),
    nonTaxableLimit: z.number().int().nonnegative().nullable().optional(),
    // 실행 가능한 정액 지급액. fixed_amount 외 계산식에는 보통 null이다.
    amount: z.number().int().nonnegative().nullable().optional(),
  })
  .passthrough()
export type PayrollRuleFormulaJson = z.infer<typeof payrollRuleFormulaJsonSchema>

const sourceCitationSchema = z.object({
  sourceType: payrollRuleSourceTypeSchema,
  reference: z.string().min(1),
  locator: z.string().optional(),
})

export const payrollRuleItemSchema = z.object({
  sourceRuleId: z.string().min(1),
  displayName: z.string().min(1),
  category: z.enum(['allowance', 'deduction', 'tax', 'insurance', 'other']),
  targetField: z.string().min(1),
  formulaKind: payrollRuleFormulaKindSchema,
  formulaJson: payrollRuleFormulaJsonSchema,
  taxableTreatment: z.enum(['taxable', 'non_taxable', 'partially_non_taxable', 'unknown']),
  requiredInputs: z.array(z.string()),
  sourceCitations: z.array(sourceCitationSchema),
  status: z.enum(['ready', 'needs_review', 'conflict', 'excluded']),
})
export type PayrollRuleItem = z.infer<typeof payrollRuleItemSchema>

const payrollTaxabilityRuleSchema = z.object({
  targetField: z.string().min(1),
  treatment: z.enum(['taxable', 'non_taxable', 'partially_non_taxable', 'unknown']),
  nonTaxableLimit: z.number().int().nonnegative().nullable().optional(),
  note: z.string().optional(),
})

const payrollStatutoryFallbackSchema = z.object({
  key: z.string().min(1),
  basis: z.string().min(1),
  note: z.string().optional(),
})

const payrollRequiredInputSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
})

const payrollRuleConflictSchema = z.object({
  ruleId: z.string().min(1),
  kind: z.enum([
    'taxability_mismatch',
    'newer_effective_date',
    'embedded_note_contradiction',
    'missing_effective_period',
    'missing_required_input',
    'other',
  ]),
  detail: z.string().min(1),
})

const payrollApprovalChecklistSchema = z.object({
  sourcesReviewed: z.boolean(),
  mappingReviewed: z.boolean(),
  formulasReviewed: z.boolean(),
  statutoryReviewed: z.boolean(),
})

export const clientPayrollRuleProfileV1Schema = z
  .object({
    schemaVersion: z.literal(PAYROLL_RULE_PROFILE_SCHEMA_VERSION),
    clientId: z.string().min(1),
    effectiveFrom: payrollPeriodMonthSchema,
    effectiveTo: payrollPeriodMonthSchema.optional(),
    sourcePriority: z.array(payrollRuleSourceTypeSchema),
    allowanceRules: z.array(payrollRuleItemSchema),
    deductionRules: z.array(payrollRuleItemSchema),
    taxabilityRules: z.array(payrollTaxabilityRuleSchema),
    statutoryFallbacks: z.array(payrollStatutoryFallbackSchema),
    requiredInputs: z.array(payrollRequiredInputSchema),
    conflictItems: z.array(payrollRuleConflictSchema),
    approvalChecklist: payrollApprovalChecklistSchema,
  })
  // 유효기간 정합성: 종료월이 있으면 시작월 이상이어야 한다(yyyy-MM 사전순 비교).
  .refine((profile) => !profile.effectiveTo || profile.effectiveTo >= profile.effectiveFrom, {
    message: 'effectiveTo는 effectiveFrom 이상이어야 합니다',
    path: ['effectiveTo'],
  })
export type ClientPayrollRuleProfileV1 = z.infer<typeof clientPayrollRuleProfileV1Schema>

/** source_summary_json 계약: 어떤 출처에서 이 프로필이 만들어졌는지. */
export const payrollRuleSourceSummarySchema = z.object({
  sources: z.array(
    z.object({
      sourceType: payrollRuleSourceTypeSchema,
      sourceHash: z.string().min(1),
      sourceFileId: z.string().nullable().optional(),
      securityLane: payrollRuleSecurityLaneSchema,
      // 생성 provenance(예: 단일 AI provider·합의 여부). 감사·승인 판단 근거.
      aiProviderMetadata: z.string().optional(),
    }),
  ),
})
export type PayrollRuleSourceSummary = z.infer<typeof payrollRuleSourceSummarySchema>

/** profile_json 문자열을 파싱·검증한다. 실패 시 null. */
export function parseClientPayrollRuleProfile(json: string): ClientPayrollRuleProfileV1 | null {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  const result = clientPayrollRuleProfileV1Schema.safeParse(raw)
  return result.success ? result.data : null
}
