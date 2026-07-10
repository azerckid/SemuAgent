import { z } from 'zod'
import { manualVatFactInputSchema, parsedVatFactSchema } from '@/lib/vat/facts'
import { BOOKKEEPING_ACCOUNT_CATEGORIES } from './account-categories'

const accountCategoryKeys = BOOKKEEPING_ACCOUNT_CATEGORIES.map((category) => category.key) as [
  string,
  ...string[],
]

export const bookkeepingSourceTypeSchema = z.enum(['bank', 'card', 'receipt', 'tax_invoice', 'other'])
export const bookkeepingDirectionSchema = z.enum(['income', 'expense', 'unknown'])
export const bookkeepingConfidenceSchema = z.enum(['high', 'medium', 'low'])
export const bookkeepingRowStatusSchema = z.enum([
  'suggested',
  'needs_decision',
  'confirmed',
  'unclassified',
  'excluded',
])
export const bookkeepingAccountCategorySchema = z.enum(accountCategoryKeys)

export const transactionCandidateSchema = z.object({
  sourceFileId: z.string().min(1),
  sourceFilename: z.string().min(1),
  sourceType: bookkeepingSourceTypeSchema,
  transactionDate: z.string().optional(),
  merchantName: z.string().optional(),
  description: z.string().optional(),
  amountKrw: z.number().int().optional(),
  direction: bookkeepingDirectionSchema,
  sourceRowRef: z.string().min(1).max(500).optional(),
  vatFact: parsedVatFactSchema.optional(),
  rawRow: z.array(z.string()).max(30),
})

export const bookkeepingClassificationAiOutputSchema = z.object({
  transactions: z.array(z.object({
    sourceFileId: z.string().min(1),
    sourceType: bookkeepingSourceTypeSchema,
    transactionDate: z.string().optional(),
    merchantName: z.string().optional(),
    description: z.string().optional(),
    amountKrw: z.number().int().optional(),
    direction: bookkeepingDirectionSchema,
    recommendedAccount: bookkeepingAccountCategorySchema,
    confidence: bookkeepingConfidenceSchema,
    reason: z.string().min(1),
    evidence: z.object({
      fieldsUsed: z.array(z.string()).default([]),
      needsStaffDecision: z.boolean(),
    }),
  })).max(500),
})

export const updateClassificationRowSchema = z.object({
  finalAccount: bookkeepingAccountCategorySchema.nullable().optional(),
  staffMemo: z.string().max(1000).nullable().optional(),
  status: bookkeepingRowStatusSchema.optional(),
  purposeRequestRowId: z.string().min(1).nullable().optional(),
  linkedEvidenceRowId: z.string().min(1).nullable().optional(),
  vatFact: manualVatFactInputSchema.nullable().optional(),
})

export const bulkConfirmClassificationRowsSchema = z.object({
  rowIds: z.array(z.string().min(1)).max(500).optional(),
  mode: z.enum(['explicit', 'high_confidence']).default('explicit'),
})

export const materialAttributionDecisionSchema = z.enum([
  'include',
  'hold',
  'exclude_duplicate',
  'reference_only',
])

export const materialAttributionPeriodRelationSchema = z.enum([
  'requested',
  'prior',
  'future',
  'unknown',
])

export const materialAttributionAiOutputSchema = z.object({
  candidates: z.array(z.object({
    index: z.number().int().min(0),
    evidenceDate: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).nullable(),
    attributedPeriod: z.string().regex(/^20\d{2}-\d{2}$/).nullable(),
    periodRelation: materialAttributionPeriodRelationSchema,
    recommendation: materialAttributionDecisionSchema,
    confidence: bookkeepingConfidenceSchema,
    reason: z.string().min(1).max(120),
  })).max(25),
})

export const updateMaterialAttributionRowSchema = z.object({
  staffDecision: materialAttributionDecisionSchema,
  staffNote: z.string().max(1000).nullable().optional(),
})

export const journalEntryRowStatusSchema = z.enum(['draft', 'needs_decision', 'confirmed', 'excluded'])

export const updateJournalEntryRowSchema = z.object({
  debitAccount: z.string().max(120).nullable().optional(),
  debitAmountKrw: z.number().int().nullable().optional(),
  creditAccount: z.string().max(120).nullable().optional(),
  creditAmountKrw: z.number().int().nullable().optional(),
  memo: z.string().max(1000).nullable().optional(),
  status: journalEntryRowStatusSchema.optional(),
  staffMemo: z.string().max(1000).nullable().optional(),
})

export type TransactionCandidate = z.infer<typeof transactionCandidateSchema>
export type BookkeepingClassificationAiOutput = z.infer<typeof bookkeepingClassificationAiOutputSchema>
export type BookkeepingRowStatus = z.infer<typeof bookkeepingRowStatusSchema>
export type MaterialAttributionDecision = z.infer<typeof materialAttributionDecisionSchema>
export type MaterialAttributionAiOutput = z.infer<typeof materialAttributionAiOutputSchema>
export type JournalEntryRowStatus = z.infer<typeof journalEntryRowStatusSchema>
