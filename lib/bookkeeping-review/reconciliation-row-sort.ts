import { DateTime } from 'luxon'

type ReconciliationSortableRow = {
  readonly transactionDate: string | null
  readonly id: string
}

function transactionDateMillis(transactionDate: string | null) {
  if (!transactionDate) return Number.NEGATIVE_INFINITY
  const parsed = DateTime.fromISO(transactionDate, { zone: 'Asia/Seoul' })
  return parsed.isValid ? parsed.toMillis() : Number.NEGATIVE_INFINITY
}

export function compareReconciliationRowsByTransactionDateDesc(
  left: ReconciliationSortableRow,
  right: ReconciliationSortableRow,
) {
  const leftMillis = transactionDateMillis(left.transactionDate)
  const rightMillis = transactionDateMillis(right.transactionDate)
  if (leftMillis !== rightMillis) return rightMillis - leftMillis
  return right.id.localeCompare(left.id)
}

export function sortReconciliationRowsByTransactionDateDesc<T extends ReconciliationSortableRow>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(compareReconciliationRowsByTransactionDateDesc)
}
