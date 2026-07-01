import { z } from 'zod'

// spec: docs/03_Technical_Specs/31_PAYROLL_ADAPTIVE_STRUCTURING_SPEC.md #4
export const PAYROLL_ADAPTIVE_TARGET_FIELDS = [
  'employeeCode',
  'employeeName',
  'department',
  'jobTitle',
  'residentOrInternalKey',
  'payrollMonth',
  'periodStart',
  'periodEnd',
  'paymentDate',
  'baseSalary',
  'fixedAllowance',
  'monthlyFixedPay',
  'overtimeHours',
  'nightHours',
  'holidayHours',
  'annualLeaveDays',
  'bonus',
  'retroactivePay',
  'otherAllowance',
  'incomeTaxBasis',
  'localIncomeTaxBasis',
  'nationalPensionBasis',
  'healthInsuranceBasis',
  'employmentInsuranceBasis',
  'otherDeduction',
  'memo',
  'policyCandidate',
  'metadataCandidate',
  'resultOnlyCandidate',
] as const

export type PayrollAdaptiveTargetField = typeof PAYROLL_ADAPTIVE_TARGET_FIELDS[number]

// spec #4: "직원 식별이 안정적으로 merge 가능해야 한다" / "지급 기간이 인식되어야 한다"
export const PAYROLL_ADAPTIVE_IDENTITY_TARGET_FIELDS: PayrollAdaptiveTargetField[] = [
  'employeeCode',
  'employeeName',
  'residentOrInternalKey',
]

export const PAYROLL_ADAPTIVE_PERIOD_TARGET_FIELDS: PayrollAdaptiveTargetField[] = [
  'payrollMonth',
  'periodStart',
  'periodEnd',
  'paymentDate',
]

// spec #9: "세금/공제 기준자료 누락은 자료없음으로 유지" 대상 필드
export const PAYROLL_ADAPTIVE_DEDUCTION_BASIS_TARGET_FIELDS: PayrollAdaptiveTargetField[] = [
  'incomeTaxBasis',
  'localIncomeTaxBasis',
  'nationalPensionBasis',
  'healthInsuranceBasis',
  'employmentInsuranceBasis',
  'otherDeduction',
]

// spec #3 PayrollAdaptiveModelContract['payrollModelType']
export const PAYROLL_ADAPTIVE_MODEL_TYPES = [
  'employee_master',
  'payroll_period_payments',
  'attendance_variable',
  'deduction_basis',
  'mixed_workbook',
] as const

export type PayrollAdaptiveModelType = typeof PAYROLL_ADAPTIVE_MODEL_TYPES[number]

// spec #5 ignored region reasons
export const PAYROLL_ADAPTIVE_IGNORED_REGION_REASONS = [
  'metadata',
  'company_policy',
  'result_only',
  'footer_or_total',
  'sample_or_instruction',
  'unsupported',
  'uncertain',
] as const

export type PayrollAdaptiveIgnoredRegionReason = typeof PAYROLL_ADAPTIVE_IGNORED_REGION_REASONS[number]

export const payrollAdaptiveCandidateSheetSchema = z.object({
  sheetName: z.string().min(1),
  role: z.enum(PAYROLL_ADAPTIVE_MODEL_TYPES),
  confidence: z.number().min(0).max(1),
})

export const payrollAdaptiveFieldMappingSchema = z.object({
  sheetName: z.string().min(1),
  sourceColumn: z.string().min(1),
  targetField: z.enum(PAYROLL_ADAPTIVE_TARGET_FIELDS),
  required: z.boolean().default(false),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().optional(),
})

export const payrollAdaptiveIgnoredRegionSchema = z.object({
  sheetName: z.string().min(1),
  sourceColumnOrRegion: z.string().min(1),
  reason: z.enum(PAYROLL_ADAPTIVE_IGNORED_REGION_REASONS),
})

export const payrollAdaptiveSampleRowSchema = z.object({
  sheetName: z.string().min(1),
  sourceRowRef: z.string().min(1),
  values: z.record(z.string(), z.string()).default({}),
})

// spec #6 PayrollAdaptiveProposal
export const payrollAdaptiveStructuringProposalResponseSchema = z.object({
  status: z.enum(['proposal_ready', 'not_eligible', 'needs_more_information']),
  reason: z.string().min(1),
  candidateSheets: z.array(payrollAdaptiveCandidateSheetSchema).default([]),
  proposedMappings: z.array(payrollAdaptiveFieldMappingSchema).default([]),
  sampleRows: z.array(payrollAdaptiveSampleRowSchema).default([]),
  ignoredRegions: z.array(payrollAdaptiveIgnoredRegionSchema).default([]),
  missingRequiredFields: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
})

export type PayrollAdaptiveCandidateSheet = z.infer<typeof payrollAdaptiveCandidateSheetSchema>
export type PayrollAdaptiveFieldMapping = z.infer<typeof payrollAdaptiveFieldMappingSchema>
export type PayrollAdaptiveIgnoredRegion = z.infer<typeof payrollAdaptiveIgnoredRegionSchema>
export type PayrollAdaptiveSampleRow = z.infer<typeof payrollAdaptiveSampleRowSchema>
export type PayrollAdaptiveStructuringProposalResponse = z.infer<
  typeof payrollAdaptiveStructuringProposalResponseSchema
>
