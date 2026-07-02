import { z } from 'zod'

export const vatDeductionReviewPatchSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('deductible'),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    decision: z.literal('non_deductible'),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    decision: z.literal('prorated'),
    reason: z.string().trim().max(500).optional(),
    prorationRateBps: z.number().int().min(1).max(10_000),
  }),
])

export const vatPeriodKeySchema = z.string().regex(/^\d{4}-H[12]$/, '부가세 기간 형식이 올바르지 않습니다.')

export type VatDeductionReviewPatchInput = z.infer<typeof vatDeductionReviewPatchSchema>
