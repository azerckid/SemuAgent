import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  vatTaxTreatmentFinalDecisionSchema,
  vatTaxTreatmentUserActionStatusSchema,
} from '@/lib/validations/vat-tax-treatment'

const nullableStaffAudit = {
  confirmedByStaffId: z.string().min(1).nullable(),
  confirmedAt: z.string().min(1).nullable(),
}

export const vatTaxTreatmentUndoCanonicalStateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('purchase_missing'),
  }),
  z.object({
    kind: z.literal('purchase_existing'),
    reviewId: z.string().min(1),
    reviewKind: z.enum(['deductible', 'non_deductible_candidate', 'proration_required']),
    decision: z.enum(['pending', 'deductible', 'non_deductible', 'prorated']),
    reason: z.string(),
    prorationRateBps: z.number().int().min(1).max(10_000).nullable(),
    ...nullableStaffAudit,
    updatedAt: z.string().min(1),
  }),
  z.object({
    kind: z.literal('sale'),
    vatTaxType: z.enum(['taxable', 'zero_rated', 'exempt', 'non_taxable']),
    vatFactSource: z.enum(['parser', 'manual']),
    vatFactSourceRef: z.string().min(1),
    vatFactStatus: z.enum(['derived', 'confirmed']),
    ...nullableStaffAudit,
    updatedAt: z.string().min(1),
  }),
])

export const vatTaxTreatmentUndoActionStateSchema = z.object({
  status: vatTaxTreatmentUserActionStatusSchema,
  finalDecision: vatTaxTreatmentFinalDecisionSchema.nullable(),
  finalReason: z.string().max(500).nullable(),
  prorationRateBps: z.number().int().min(1).max(10_000).nullable(),
  ...nullableStaffAudit,
}).superRefine((value, context) => {
  if (value.status === 'confirmed' && !value.finalDecision) {
    context.addIssue({
      code: 'custom',
      path: ['finalDecision'],
      message: '확정 상태 복원에는 최종 결정이 필요합니다.',
    })
  }
  if (value.status !== 'confirmed' && value.finalDecision) {
    context.addIssue({
      code: 'custom',
      path: ['finalDecision'],
      message: '미확정 상태에는 최종 결정을 복원할 수 없습니다.',
    })
  }
})

export type VatTaxTreatmentUndoCanonicalState = z.infer<typeof vatTaxTreatmentUndoCanonicalStateSchema>
export type VatTaxTreatmentUndoActionState = z.infer<typeof vatTaxTreatmentUndoActionStateSchema>

export function hashVatTaxTreatmentUndoToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
