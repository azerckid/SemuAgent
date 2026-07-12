import { z } from 'zod'
import { vatTaxTreatmentProvisionalJudgmentSchema } from './vat-tax-treatment'

export const vatTaxTreatmentAiProvisionalJudgmentSchema =
  vatTaxTreatmentProvisionalJudgmentSchema.exclude(['non_taxable'])

export const vatTaxTreatmentAiCandidateSchema = z.object({
  index: z.number().int().nonnegative(),
  provisionalJudgment: vatTaxTreatmentAiProvisionalJudgmentSchema,
  confidence: z.enum(['medium', 'low']),
  basisLabel: z.string().min(1).max(400),
  missingFacts: z.array(z.string().min(1).max(160)).max(8),
  hometaxAction: z.enum([
    'expected_no_change',
    'review_deduction',
    'review_sales_tax_type',
    'add_or_correct_amount',
    'review_proration',
    'compare_in_hometax',
  ]),
})

export const vatTaxTreatmentAiBatchOutputSchema = z.object({
  candidates: z.array(vatTaxTreatmentAiCandidateSchema).min(1).max(12),
}).superRefine((value, context) => {
  const indexes = new Set<number>()
  for (const candidate of value.candidates) {
    if (indexes.has(candidate.index)) {
      context.addIssue({
        code: 'custom',
        path: ['candidates'],
        message: `중복된 VAT AI candidate index입니다: ${candidate.index}`,
      })
    }
    indexes.add(candidate.index)
  }
})

export type VatTaxTreatmentAiBatchOutput = z.infer<typeof vatTaxTreatmentAiBatchOutputSchema>
export type VatTaxTreatmentAiCandidate = z.infer<typeof vatTaxTreatmentAiCandidateSchema>
