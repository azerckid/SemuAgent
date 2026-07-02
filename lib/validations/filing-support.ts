import { z } from 'zod'

export const filingPeriodKeySchema = z
  .string()
  .regex(/^20\d{2}-H[12]$/, '신고 기간은 YYYY-H1 또는 YYYY-H2 형식이어야 합니다.')

export const filingItemTypeSchema = z.enum(['vat', 'withholding', 'social_insurance'])
export const filingReceiptTypeSchema = z.enum(['hometax_receipt', 'payment_receipt', 'insurance_receipt'])

export const filingReceiptCreateSchema = z.object({
  filingPeriodKey: filingPeriodKeySchema,
  itemType: filingItemTypeSchema,
  receiptType: filingReceiptTypeSchema,
  originalFilename: z.string().trim().min(1).max(255),
  fileHash: z.string().trim().max(128).nullable().optional(),
})

export const filingChecklistPatchSchema = z.object({
  filingPeriodKey: filingPeriodKeySchema,
  code: z.string().trim().min(1).max(100),
  completed: z.boolean(),
})

export type FilingReceiptCreateInput = z.infer<typeof filingReceiptCreateSchema>
export type FilingChecklistPatchInput = z.infer<typeof filingChecklistPatchSchema>
