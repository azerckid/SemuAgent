import { z } from 'zod'

export const reconciliationSourceSchema = z.enum([
  'bank',
  'card',
  'tax_invoice',
  'receipt',
  'cash_receipt',
  'other',
])

export const reconciliationPeriodModeSchema = z.enum([
  'month',
  'quarter',
  'half_year',
  'year',
  'custom',
])

export const reconciliationMatchStateSchema = z.enum([
  'matched',
  'candidate',
  'ambiguous',
  'missing_evidence',
  'duplicate_candidate',
  'excluded',
  'confirmed',
])

export const reconciliationEvidenceActionStateSchema = z.enum([
  'linked',
  'candidate',
  'evidence_required',
  'explanation_required',
  'explained_no_evidence',
  'evidence_exception',
  'excluded',
])

export const reconciliationBlockerCodeSchema = z.enum([
  'missing_evidence',
  'ambiguous_match',
  'account_unconfirmed',
  'explanation_required',
  'exclude_reason_required',
  'tax_specific_review_required',
])

export const reconciliationExclusionReasonSchema = z.enum([
  'personal_private',
  'business_unrelated',
  'duplicate_evidence',
  'wrong_period',
  'reference_only',
  'non_deductible_vat',
  'internal_transfer',
  'refund_or_cancellation',
  'unsupported_needs_review',
])

export const reconciliationNextActionPrioritySchema = z.enum([
  'filing_blocker',
  'high_amount',
  'due_date',
  'manual_review',
])

export const reconciliationNextActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  reason: z.string().min(1),
  priority: reconciliationNextActionPrioritySchema,
  targetRowId: z.string().min(1).nullable(),
  targetRoute: z.string().min(1),
})

export const reconciliationTaxTrackSchema = z.enum([
  'vat',
  'business_status',
  'withholding',
  'local_income',
  'payment_statement',
])

export const reconciliationTaxBlockerSummarySchema = z.object({
  taxTrack: reconciliationTaxTrackSchema,
  label: z.string().min(1),
  blockerCount: z.number().int().nonnegative(),
  topReasons: z.array(
    z.object({
      code: reconciliationBlockerCodeSchema,
      label: z.string().min(1),
      count: z.number().int().nonnegative(),
    }),
  ),
  canGeneratePath1File: z.boolean(),
})

export const reconciliationBatchSuggestionActionSchema = z.enum([
  'apply_account',
  'connect_evidence',
  'exclude',
  'mark_exception',
])

export const reconciliationBatchSuggestionEligibilitySchema = z.enum([
  'safe_to_offer',
  'mixed_reasons_blocked',
])

export const reconciliationBatchSuggestionGroupSchema = z.object({
  id: z.string().min(1),
  rowIds: z.array(z.string().min(1)).min(1),
  suggestedAction: reconciliationBatchSuggestionActionSchema,
  basisLabel: z.string().min(1),
  eligibility: reconciliationBatchSuggestionEligibilitySchema,
  requiresUserConfirmation: z.literal(true),
})

export const reconciliationClosingChecklistSchema = z.object({
  evidenceRequiredCount: z.number().int().nonnegative(),
  explanationRequiredCount: z.number().int().nonnegative(),
  accountUnconfirmedCount: z.number().int().nonnegative(),
  exclusionReasonRequiredCount: z.number().int().nonnegative(),
  taxBlockerCount: z.number().int().nonnegative(),
  isReadyForPath1: z.boolean(),
})

export const reconciliationWorkPanelPrimaryActionSchema = z.enum([
  'connect_evidence',
  'confirm_account',
  'write_explanation',
  'exclude',
  'mark_exception',
  'open_source_collection',
  'review_only',
])

export const reconciliationWorkPanelConclusionSchema = z.object({
  headline: z.string().min(1),
  basisLabel: z.string().min(1),
  primaryAction: reconciliationWorkPanelPrimaryActionSchema,
  actionEnabled: z.boolean(),
  disabledReason: z.string().nullable(),
})

export const reconciliationMatchCandidateReasonSchema = z.enum([
  'same_amount_same_day',
  'same_amount_near_day',
  'same_counterparty_amount',
  'partial_amount',
  'many_to_one',
  'manual_reference',
])

export const reconciliationConfidenceSchema = z.enum(['high', 'medium', 'low'])

export const reconciliationMatchCandidateSchema = z.object({
  id: z.string().min(1),
  source: reconciliationSourceSchema,
  rowId: z.string().min(1),
  date: z.string().nullable(),
  counterparty: z.string().nullable(),
  amountKrw: z.number().nullable(),
  taxAmountKrw: z.number().nullable().optional(),
  confidence: reconciliationConfidenceSchema,
  reason: reconciliationMatchCandidateReasonSchema,
})

export const reconciliationPatternSuggestionReasonSchema = z.enum([
  'same_counterparty_prior_account',
  'same_counterparty_prior_evidence',
  'same_memo_amount_pattern',
  'prior_exclusion_pattern',
  'recurring_internal_transfer',
])

export const reconciliationPatternSuggestionSchema = z.object({
  suggestedAccount: z.string().nullable(),
  suggestedEvidenceSource: reconciliationSourceSchema.nullable(),
  suggestedExclusionReason: reconciliationExclusionReasonSchema.nullable(),
  confidence: reconciliationConfidenceSchema,
  basisLabel: z.string().min(1),
  matchedCount: z.number().int().nonnegative(),
  lastSeenPeriod: z.string().nullable(),
  reason: reconciliationPatternSuggestionReasonSchema,
})

export const reconciliationLedgerRowActionsSchema = z.object({
  canConfirmAccount: z.boolean(),
  canExplain: z.boolean(),
  canExclude: z.boolean(),
  canConfirmMatch: z.boolean(),
})

export const reconciliationLedgerRowSchema = z.object({
  id: z.string().min(1),
  periodMode: reconciliationPeriodModeSchema,
  periodLabel: z.string().min(1),
  source: reconciliationSourceSchema,
  transactionDate: z.string().nullable(),
  counterparty: z.string().nullable(),
  description: z.string(),
  direction: z.enum(['income', 'expense', 'unknown']),
  amountKrw: z.number().nullable(),
  taxAmountKrw: z.number().nullable(),
  recommendedAccount: z.string().nullable(),
  finalAccount: z.string().nullable(),
  explanationMemo: z.string().nullable(),
  exclusionReason: reconciliationExclusionReasonSchema.nullable(),
  matchState: reconciliationMatchStateSchema,
  evidenceActionState: reconciliationEvidenceActionStateSchema,
  candidates: z.array(reconciliationMatchCandidateSchema),
  patternSuggestion: reconciliationPatternSuggestionSchema.nullable(),
  workPanelConclusion: reconciliationWorkPanelConclusionSchema,
  blockers: z.array(
    z.object({
      code: reconciliationBlockerCodeSchema,
      label: z.string().min(1),
    }),
  ),
  actions: reconciliationLedgerRowActionsSchema,
})

export const reconciliationLedgerDisplayModelSchema = z.object({
  rows: z.array(reconciliationLedgerRowSchema),
  nextActions: z.array(reconciliationNextActionSchema),
  taxBlockerSummaries: z.array(reconciliationTaxBlockerSummarySchema),
  closingChecklist: reconciliationClosingChecklistSchema,
  batchSuggestionGroups: z.array(reconciliationBatchSuggestionGroupSchema),
})

export type ReconciliationSource = z.infer<typeof reconciliationSourceSchema>
export type ReconciliationPeriodMode = z.infer<typeof reconciliationPeriodModeSchema>
export type ReconciliationMatchState = z.infer<typeof reconciliationMatchStateSchema>
export type ReconciliationEvidenceActionState = z.infer<typeof reconciliationEvidenceActionStateSchema>
export type ReconciliationBlockerCode = z.infer<typeof reconciliationBlockerCodeSchema>
export type ReconciliationExclusionReason = z.infer<typeof reconciliationExclusionReasonSchema>
export type ReconciliationNextAction = z.infer<typeof reconciliationNextActionSchema>
export type ReconciliationTaxBlockerSummary = z.infer<typeof reconciliationTaxBlockerSummarySchema>
export type ReconciliationBatchSuggestionGroup = z.infer<typeof reconciliationBatchSuggestionGroupSchema>
export type ReconciliationClosingChecklist = z.infer<typeof reconciliationClosingChecklistSchema>
export type ReconciliationWorkPanelConclusion = z.infer<typeof reconciliationWorkPanelConclusionSchema>
export type ReconciliationMatchCandidate = z.infer<typeof reconciliationMatchCandidateSchema>
export type ReconciliationPatternSuggestion = z.infer<typeof reconciliationPatternSuggestionSchema>
export type ReconciliationLedgerRow = z.infer<typeof reconciliationLedgerRowSchema>
export type ReconciliationLedgerDisplayModel = z.infer<typeof reconciliationLedgerDisplayModelSchema>

export function parseReconciliationLedgerDisplayModel(
  input: unknown,
): ReconciliationLedgerDisplayModel {
  return reconciliationLedgerDisplayModelSchema.parse(input)
}
