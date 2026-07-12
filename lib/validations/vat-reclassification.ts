import { z } from 'zod'

const expectedFingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/)
const periodKeySchema = z.string().regex(/^\d{4}-H[12]$/)

export const vatReclassificationMutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reclassify'),
    periodKey: periodKeySchema,
    expectedFingerprint: expectedFingerprintSchema,
    targetCategory: z.enum(['welfare_expense', 'meeting_expense']),
    businessContext: z.string().trim().min(2).max(500),
  }),
  z.object({
    action: z.literal('keep_as_is'),
    periodKey: periodKeySchema,
    expectedFingerprint: expectedFingerprintSchema,
    reason: z.string().trim().max(500).optional(),
  }),
])

export type VatReclassificationMutationInput = z.infer<typeof vatReclassificationMutationSchema>
