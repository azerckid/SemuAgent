import { z } from 'zod'

export const payrollPeriodKeySchema = z
  .string()
  .regex(/^20\d{2}-(0[1-9]|1[0-2])$/, '급여 귀속월은 YYYY-MM 형식이어야 합니다.')

const amountSchema = z.number().int().min(0).max(999_999_999)

export const payrollEmployeeLinePatchSchema = z.object({
  employeeCode: z.string().trim().max(80).nullable().optional(),
  employeeName: z.string().trim().min(1).max(100).optional(),
  department: z.string().trim().max(100).nullable().optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
  jobType: z.string().trim().max(100).nullable().optional(),
  baseSalaryKrw: amountSchema.optional(),
  allowanceKrw: amountSchema.optional(),
  incomeTaxKrw: amountSchema.optional(),
  localIncomeTaxKrw: amountSchema.optional(),
  nationalPensionKrw: amountSchema.optional(),
  healthInsuranceKrw: amountSchema.optional(),
  longTermCareKrw: amountSchema.optional(),
  employmentInsuranceKrw: amountSchema.optional(),
  otherDeductionKrw: amountSchema.optional(),
  status: z.enum(['ready', 'needs_review']).optional(),
  issueCode: z.string().trim().max(120).nullable().optional(),
  issueMessage: z.string().trim().max(300).nullable().optional(),
})

export const payrollInsuranceNoticeImportSchema = z.object({
  sourceType: z.enum(['nhis_edi', 'social_insurance_portal', 'manual']).default('manual'),
  originalFilename: z.string().trim().max(255).nullable().optional(),
  fileHash: z.string().trim().max(128).nullable().optional(),
  lines: z.array(z.object({
    employeeCode: z.string().trim().max(80).nullable().optional(),
    employeeName: z.string().trim().max(100).nullable().optional(),
    matchKeyHash: z.string().trim().max(128).nullable().optional(),
    nationalPensionKrw: amountSchema.default(0),
    healthInsuranceKrw: amountSchema.default(0),
    longTermCareKrw: amountSchema.default(0),
    employmentInsuranceKrw: amountSchema.default(0),
  })).min(1).max(500),
})

export type PayrollEmployeeLinePatchInput = z.infer<typeof payrollEmployeeLinePatchSchema>
export type PayrollInsuranceNoticeImportInput = z.infer<typeof payrollInsuranceNoticeImportSchema>
