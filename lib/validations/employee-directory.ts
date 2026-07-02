import { z } from 'zod'

// 개인정보 최소 수집: 주민등록번호·계좌번호·전화번호 필드는 스키마에 두지 않는다.
// 이름·사번·부서·직책·업무 이메일만 허용한다.

export const employeeStatusSchema = z.enum(['active', 'leave', 'terminated'])
export const payrollEligibilitySchema = z.enum(['eligible', 'excluded'])
export const insuranceEnrollmentStatusSchema = z.enum([
  'not_checked',
  'enrolled',
  'needs_review',
  'not_applicable',
])

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜는 YYYY-MM-DD 형식이어야 합니다.')
  .nullable()
  .optional()

const workEmailSchema = z
  .string()
  .trim()
  .max(255)
  .email('업무 이메일 형식이 올바르지 않습니다.')
  .nullable()
  .optional()

export const employeeCreateSchema = z.object({
  displayName: z.string().trim().min(1, '이름을 입력해 주세요.').max(100),
  employeeCode: z.string().trim().max(80).nullable().optional(),
  department: z.string().trim().max(100).nullable().optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
  employeeStatus: employeeStatusSchema.default('active'),
  payrollEligibility: payrollEligibilitySchema.default('eligible'),
  insuranceEnrollmentStatus: insuranceEnrollmentStatusSchema.default('not_checked'),
  hireDate: dateSchema,
  terminationDate: dateSchema,
  workEmail: workEmailSchema,
  notificationEnabled: z.boolean().default(true),
})

export const employeeUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  employeeCode: z.string().trim().max(80).nullable().optional(),
  department: z.string().trim().max(100).nullable().optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
  employeeStatus: employeeStatusSchema.optional(),
  payrollEligibility: payrollEligibilitySchema.optional(),
  insuranceEnrollmentStatus: insuranceEnrollmentStatusSchema.optional(),
  hireDate: dateSchema,
  terminationDate: dateSchema,
  workEmail: workEmailSchema,
  notificationEnabled: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: '수정할 항목이 없습니다.',
})

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>
