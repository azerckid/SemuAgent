import type { DateTime } from 'luxon'
import { z } from 'zod'
import { buildLiveReconciliationLedgerDisplayModel } from './reconciliation-live-display-model'
import type { ReconciliationClosingChecklist } from './reconciliation-display-model'
import { loadBookkeepingReviewSummary } from './summary'

export const RECONCILIATION_PATH1_GATE_ROUTE = '/dashboard/bookkeeping/reconciliation-ledger' as const

export const reconciliationPath1GateSchema = z.object({
  periodKey: z.string().min(1),
  isReady: z.boolean(),
  blockerCount: z.number().int().nonnegative(),
  evidenceRequiredCount: z.number().int().nonnegative(),
  explanationRequiredCount: z.number().int().nonnegative(),
  accountUnconfirmedCount: z.number().int().nonnegative(),
  exclusionReasonRequiredCount: z.number().int().nonnegative(),
  taxBlockerCount: z.number().int().nonnegative(),
  targetRoute: z.literal(RECONCILIATION_PATH1_GATE_ROUTE),
})

export type ReconciliationPath1Gate = z.infer<typeof reconciliationPath1GateSchema>

export function buildReconciliationPath1Gate(
  periodKey: string,
  checklist: ReconciliationClosingChecklist,
): ReconciliationPath1Gate {
  // This is the number of unresolved actions shown by the closing checklist,
  // not a de-duplicated transaction-row count.
  const blockerCount = checklist.evidenceRequiredCount
    + checklist.explanationRequiredCount
    + checklist.accountUnconfirmedCount
    + checklist.exclusionReasonRequiredCount

  return reconciliationPath1GateSchema.parse({
    periodKey,
    isReady: checklist.isReadyForPath1 && blockerCount === 0,
    blockerCount,
    evidenceRequiredCount: checklist.evidenceRequiredCount,
    explanationRequiredCount: checklist.explanationRequiredCount,
    accountUnconfirmedCount: checklist.accountUnconfirmedCount,
    exclusionReasonRequiredCount: checklist.exclusionReasonRequiredCount,
    taxBlockerCount: checklist.taxBlockerCount,
    targetRoute: RECONCILIATION_PATH1_GATE_ROUTE,
  })
}

export async function loadReconciliationPath1Gate({
  tenantId,
  periodKey,
  today,
}: {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
}): Promise<ReconciliationPath1Gate> {
  const summary = await loadBookkeepingReviewSummary({
    tenantId,
    periodKey,
    today,
    tab: 'all',
    includeExcluded: true,
  })
  const displayModel = buildLiveReconciliationLedgerDisplayModel(summary)
  return buildReconciliationPath1Gate(summary.period.key, displayModel.closingChecklist)
}
