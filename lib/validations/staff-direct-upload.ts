import { z } from 'zod'

export const staffDirectUploadWorkTypes = ['bookkeeping', 'vat', 'payroll', 'general'] as const
export const bookkeepingPeriodTypes = ['monthly', 'quarterly', 'yearly'] as const

const periodSchema = z.string()
  .trim()
  .min(1, '요청 기간을 입력해 주세요')
  .max(32)
  .regex(
    /^20\d{2}$|^20\d{2}-(0[1-9]|1[0-2])(~20\d{2}-(0[1-9]|1[0-2]))?$|^20\d{2}-Q[1-4]$/,
    'YYYY, YYYY-MM, YYYY-MM~YYYY-MM, YYYY-Qn 형식으로 입력해 주세요',
  )

export const createStaffDirectUploadSchema = z.object({
  clientId: z.string().min(1),
  displayLabel: z.string().trim().min(1, '표시 이름을 입력해 주세요').max(80, '표시 이름은 80자 이하로 입력해 주세요'),
  workType: z.enum(staffDirectUploadWorkTypes),
  accountingPeriod: periodSchema,
  bookkeepingPeriodType: z.enum(bookkeepingPeriodTypes).nullable().optional(),
  analysisNotes: z.string().trim().max(5000).optional(),
})

export type CreateStaffDirectUploadInput = z.infer<typeof createStaffDirectUploadSchema>
