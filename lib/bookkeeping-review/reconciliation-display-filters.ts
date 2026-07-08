import { z } from 'zod'
import type { ReconciliationLedgerRow, ReconciliationSource } from './reconciliation-display-model'
import { sortReconciliationRowsByTransactionDateDesc } from './reconciliation-row-sort'

export const reconciliationDisplayFilterValues = [
  'all',
  'bank',
  'card',
  'tax_invoice',
  'cash_receipt',
  'receipt',
  'other',
  'evidence_required',
  'explanation_required',
  'exclusion_review',
] as const

export const reconciliationDisplayFilterSchema = z.enum(reconciliationDisplayFilterValues)
export type ReconciliationDisplayFilter = (typeof reconciliationDisplayFilterValues)[number]

export function normalizeReconciliationDisplayFilter(value: string | undefined): ReconciliationDisplayFilter {
  const parsed = reconciliationDisplayFilterSchema.safeParse(value)
  return parsed.success ? parsed.data : 'all'
}

export function isCashReceiptDisplaySource(source: ReconciliationSource): boolean {
  return source === 'cash_receipt' || source === 'receipt'
}

export function countCashReceiptDisplayRows(rows: ReconciliationLedgerRow[]): number {
  return rows.filter((row) => isCashReceiptDisplaySource(row.source)).length
}

export function filterReconciliationDisplayRows(
  rows: ReconciliationLedgerRow[],
  filter: ReconciliationDisplayFilter,
): ReconciliationLedgerRow[] {
  let filtered: ReconciliationLedgerRow[]
  if (filter === 'all') {
    filtered = rows
  } else if (filter === 'evidence_required') {
    filtered = rows.filter((row) => row.evidenceActionState === 'evidence_required')
  } else if (filter === 'explanation_required') {
    filtered = rows.filter((row) => row.evidenceActionState === 'explanation_required')
  } else if (filter === 'exclusion_review') {
    filtered = rows.filter(
      (row) =>
        row.evidenceActionState === 'excluded'
        || row.blockers.some((blocker) => blocker.code === 'exclude_reason_required'),
    )
  } else if (filter === 'cash_receipt') {
    filtered = rows.filter((row) => isCashReceiptDisplaySource(row.source))
  } else {
    filtered = rows.filter((row) => row.source === filter)
  }

  return sortReconciliationRowsByTransactionDateDesc(filtered)
}

export function buildReconciliationDisplaySourceCounts(
  rows: ReconciliationLedgerRow[],
): Record<ReconciliationSource, number> {
  return rows.reduce<Record<ReconciliationSource, number>>(
    (acc, row) => {
      acc[row.source] += 1
      return acc
    },
    {
      bank: 0,
      card: 0,
      tax_invoice: 0,
      receipt: 0,
      cash_receipt: 0,
      other: 0,
    },
  )
}

export function countReconciliationDisplayRows(
  rows: ReconciliationLedgerRow[],
  predicate: (row: ReconciliationLedgerRow) => boolean,
): number {
  return rows.filter(predicate).length
}

export function reconciliationDisplayFilterHref(filter: ReconciliationDisplayFilter): string {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('source', filter)
  const query = params.toString()
  return query ? '/dashboard/bookkeeping/reconciliation-ledger?' + query : '/dashboard/bookkeeping/reconciliation-ledger'
}
