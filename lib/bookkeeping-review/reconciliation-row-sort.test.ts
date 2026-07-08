import { describe, expect, it } from 'vitest'
import {
  compareReconciliationRowsByTransactionDateDesc,
  sortReconciliationRowsByTransactionDateDesc,
} from './reconciliation-row-sort'

describe('reconciliation row sort', () => {
  it('sorts by transaction date descending with newest first', () => {
    const rows = [
      { id: 'jan', transactionDate: '2026-01-15' },
      { id: 'jul', transactionDate: '2026-07-12' },
      { id: 'jun', transactionDate: '2026-06-28' },
      { id: 'jul-older', transactionDate: '2026-07-06' },
    ]

    expect(sortReconciliationRowsByTransactionDateDesc(rows).map((row) => row.id)).toEqual([
      'jul',
      'jul-older',
      'jun',
      'jan',
    ])
  })

  it('uses id descending as a stable tiebreaker on the same date', () => {
    expect(
      compareReconciliationRowsByTransactionDateDesc(
        { id: 'row-a', transactionDate: '2026-07-08' },
        { id: 'row-b', transactionDate: '2026-07-08' },
      ),
    ).toBeGreaterThan(0)
  })

  it('places rows without transaction dates at the bottom', () => {
    const rows = [
      { id: 'missing', transactionDate: null },
      { id: 'dated', transactionDate: '2026-03-01' },
    ]

    expect(sortReconciliationRowsByTransactionDateDesc(rows).map((row) => row.id)).toEqual(['dated', 'missing'])
  })
})
