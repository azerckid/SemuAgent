import { z } from 'zod'

// ---------------------------------------------------------------------------
// 엑셀 템플릿 매핑 JSON 구조
// ---------------------------------------------------------------------------
export const payrollExcelMappingFields = [
  'employee_code',
  'employee_name',
  'department',
  'job_title',
  'job_type',
  'base_salary',
  'bonus',
  'meal_allowance',
  'transportation_allowance',
  'holiday_work_allowance',
  'domestic_travel_allowance',
  'annual_leave_allowance',
  'rnd_allowance',
  'other_allowance',
  'performance_incentive',
  'night_work_allowance',
  'vehicle_maintenance_allowance',
  'retroactive_pay',
  'overtime_allowance',
  'childcare_allowance',
  'gross_pay',
] as const

export const payrollExcelMappingColumns = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
  'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
  'Q', 'R', 'S', 'T', 'U',
] as const

/** 업로드용_엑셀파일.xlsx Sheet1 1~2행 헤더 라벨 (A~U) */
export const payrollExcelTemplateColumnLabels: Record<(typeof payrollExcelMappingFields)[number], string> = {
  employee_code: '사원코드',
  employee_name: '사원명',
  department: '부서',
  job_title: '직급',
  job_type: '직종',
  base_salary: '기본급',
  bonus: '상여',
  meal_allowance: '식대(퇴)',
  transportation_allowance: '교통비(퇴불)',
  holiday_work_allowance: '휴일근무(퇴)',
  domestic_travel_allowance: '국내출장(퇴불)',
  annual_leave_allowance: '연차수당(퇴)',
  rnd_allowance: '연구개발비(퇴)',
  other_allowance: '기타수당(퇴)',
  performance_incentive: '일반성과인센티브(퇴불/3월,9월)',
  night_work_allowance: '심야근무',
  vehicle_maintenance_allowance: '차량유지비',
  retroactive_pay: '급여인상분 소급적용(퇴)',
  overtime_allowance: '연장근무',
  childcare_allowance: '보육수당',
  gross_pay: '지급액계',
}

export const payrollExcelTemplateAllowanceGroupLabel = '수당'

export const defaultPayrollExcelMapping = payrollExcelMappingFields.map((field, index) => ({
  field,
  column: payrollExcelMappingColumns[index],
  columnIndex: index,
}))

const defaultMappingByField = Object.fromEntries(
  defaultPayrollExcelMapping.map((item) => [item.field, item]),
) as Record<
  (typeof payrollExcelMappingFields)[number],
  (typeof defaultPayrollExcelMapping)[number]
>

export const mappingItemSchema = z.object({
  field: z.enum(payrollExcelMappingFields),
  column: z.enum(payrollExcelMappingColumns),
  columnIndex: z.number().int().min(0).max(20),
}).superRefine((item, ctx) => {
  const expected = defaultMappingByField[item.field]
  if (item.column !== expected.column || item.columnIndex !== expected.columnIndex) {
    ctx.addIssue({
      code: 'custom',
      message: `${item.field}는 ${expected.column}${expected.columnIndex} 매핑만 허용됩니다`,
      path: ['column'],
    })
  }
})
export type MappingItem = z.infer<typeof mappingItemSchema>

export const mappingJsonSchema = z.array(mappingItemSchema)
  .length(defaultPayrollExcelMapping.length)
  .superRefine((items, ctx) => {
    const seen = new Set<string>()
    for (const item of items) {
      if (seen.has(item.field)) {
        ctx.addIssue({
          code: 'custom',
          message: `중복 매핑 필드입니다: ${item.field}`,
        })
      }
      seen.add(item.field)
    }
    for (const expected of defaultPayrollExcelMapping) {
      if (!seen.has(expected.field)) {
        ctx.addIssue({
          code: 'custom',
          message: `필수 매핑 필드가 없습니다: ${expected.field}`,
        })
      }
    }
  })
export type MappingJson = z.infer<typeof mappingJsonSchema>

// ---------------------------------------------------------------------------
// AI 추출 응답
// ---------------------------------------------------------------------------
export const payrollExtractedRowSchema = z.object({
  employeeCode: z.string().nullable().optional(),
  employeeName: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  jobType: z.string().nullable().optional(),
  baseSalary: z.number().int().nullable().optional(),
  bonus: z.number().int().nullable().optional(),
  mealAllowance: z.number().int().nullable().optional(),
  transportationAllowance: z.number().int().nullable().optional(),
  holidayWorkAllowance: z.number().int().nullable().optional(),
  domesticTravelAllowance: z.number().int().nullable().optional(),
  annualLeaveAllowance: z.number().int().nullable().optional(),
  rndAllowance: z.number().int().nullable().optional(),
  otherAllowance: z.number().int().nullable().optional(),
  performanceIncentive: z.number().int().nullable().optional(),
  nightWorkAllowance: z.number().int().nullable().optional(),
  vehicleMaintenanceAllowance: z.number().int().nullable().optional(),
  retroactivePay: z.number().int().nullable().optional(),
  overtimeAllowance: z.number().int().nullable().optional(),
  childcareAllowance: z.number().int().nullable().optional(),
  nationalPension: z.number().int().nullable().optional(),
  healthInsurance: z.number().int().nullable().optional(),
  longTermCare: z.number().int().nullable().optional(),
  employmentInsurance: z.number().int().nullable().optional(),
  incomeTax: z.number().int().nullable().optional(),
  localIncomeTax: z.number().int().nullable().optional(),
  otherDeduction: z.number().int().nullable().optional(),
  deductionAmount: z.number().int().nullable().optional(),
  memo: z.string().nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low', 'unknown']).default('unknown'),
  aiVerdict: z.enum(['pass', 'fail']).optional(),
  aiVerdictReason: z.string().nullable().optional(),
  // AI가 객체 대신 "급여대장 11행" 같은 문자열로 반환하는 경우가 있어 record로 감싸서 수용한다.
  sourceReference: z
    .union([
      z.record(z.string(), z.unknown()),
      z.string().transform((value): Record<string, unknown> | null => {
        const trimmed = value.trim()
        return trimmed.length > 0 ? { reference: trimmed } : null
      }),
    ])
    .nullable()
    .optional(),
})
export type PayrollExtractedRow = z.infer<typeof payrollExtractedRowSchema>

export const payrollExtractionResponseSchema = z.object({
  payrollPeriod: z.string(),
  rows: z.array(payrollExtractedRowSchema),
  warnings: z.array(z.string()).optional().default([]),
})
export type PayrollExtractionResponse = z.infer<typeof payrollExtractionResponseSchema>

// ---------------------------------------------------------------------------
// row 수정 입력
// ---------------------------------------------------------------------------
export const patchPayrollRowSchema = z.object({
  employeeCode: z.string().nullable().optional(),
  employeeName: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  jobType: z.string().nullable().optional(),
  baseSalary: z.number().int().nullable().optional(),
  bonus: z.number().int().nullable().optional(),
  mealAllowance: z.number().int().nullable().optional(),
  transportationAllowance: z.number().int().nullable().optional(),
  holidayWorkAllowance: z.number().int().nullable().optional(),
  domesticTravelAllowance: z.number().int().nullable().optional(),
  annualLeaveAllowance: z.number().int().nullable().optional(),
  rndAllowance: z.number().int().nullable().optional(),
  otherAllowance: z.number().int().nullable().optional(),
  performanceIncentive: z.number().int().nullable().optional(),
  nightWorkAllowance: z.number().int().nullable().optional(),
  vehicleMaintenanceAllowance: z.number().int().nullable().optional(),
  retroactivePay: z.number().int().nullable().optional(),
  overtimeAllowance: z.number().int().nullable().optional(),
  childcareAllowance: z.number().int().nullable().optional(),
  deductionAmount: z.number().int().nullable().optional(),
  memo: z.string().nullable().optional(),
  aiVerdict: z.enum(['pass', 'fail']).optional(),
  aiVerdictReason: z.string().nullable().optional(),
  // Deprecated: payroll 출력 조건에는 사용하지 않는다. 기존 DB/구 UI 호환 입력만 허용.
  reviewStatus: z.enum(['needs_review', 'confirmed', 'excluded']).optional(),
})
export type PatchPayrollRowInput = z.infer<typeof patchPayrollRowSchema>
