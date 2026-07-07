import { describe, expect, it } from 'vitest'
import { emptyReconciliationInfo, type BookkeepingReviewQueueRow } from '@/lib/bookkeeping-review/summary'
import {
  filterReconciliationRows,
  normalizeReconciliationFilter,
  reconciliationFilterHref,
} from './reconciliation-ledger'

function row(partial: Partial<BookkeepingReviewQueueRow> & Pick<BookkeepingReviewQueueRow, 'id' | 'sourceType'>): BookkeepingReviewQueueRow {
  return {
    id: partial.id,
    uploadSessionId: partial.uploadSessionId ?? 'session_1',
    transactionDate: partial.transactionDate ?? '2026-06-27',
    description: partial.description ?? '테스트 거래',
    counterparty: partial.counterparty ?? '테스트 거래처',
    amountKrw: partial.amountKrw ?? 1000,
    recommendedAccount: partial.recommendedAccount ?? '매출',
    finalAccount: partial.finalAccount ?? null,
    confidence: partial.confidence ?? 'high',
    confidenceTone: partial.confidenceTone ?? 'ok',
    status: partial.status ?? 'confirmed',
    sourceType: partial.sourceType,
    direction: partial.direction ?? 'income',
    requiresManualAccount: partial.requiresManualAccount ?? false,
    reconciliation: partial.reconciliation ?? emptyReconciliationInfo(),
  }
}

describe('reconciliation ledger filters', () => {
  const rows = [
    row({ id: 'bank_confirmed', sourceType: 'bank' }),
    row({ id: 'card_confirmed', sourceType: 'card' }),
    row({ id: 'tax_invoice_confirmed', sourceType: 'tax_invoice' }),
    row({ id: 'missing_evidence', sourceType: 'other', status: 'needs_decision', reconciliation: { matchState: 'missing_evidence', candidates: [], blockers: [{ code: 'missing_evidence', label: '연결 증빙 필요' }] } }),
    row({ id: 'account_unconfirmed_only', sourceType: 'bank', status: 'suggested', reconciliation: { matchState: 'candidate', candidates: [], blockers: [{ code: 'account_unconfirmed', label: '계정항목 미확정' }] } }),
    row({ id: 'low_confidence', sourceType: 'receipt', confidence: 'low', status: 'suggested', requiresManualAccount: true, reconciliation: { matchState: 'candidate', candidates: [], blockers: [{ code: 'account_unconfirmed', label: '계정항목 미확정' }, { code: 'explanation_required', label: '사용내역 소명 필요' }] } }),
  ]

  it('normalizes allowed query values and falls back invalid values to all', () => {
    expect(normalizeReconciliationFilter('bank')).toBe('bank')
    expect(normalizeReconciliationFilter('missing_evidence')).toBe('missing_evidence')
    expect(normalizeReconciliationFilter('unexpected')).toBe('all')
    expect(normalizeReconciliationFilter(undefined)).toBe('all')
  })

  it('filters source tabs by sourceType', () => {
    expect(filterReconciliationRows(rows, 'bank').map((item) => item.id)).toEqual(['bank_confirmed', 'account_unconfirmed_only'])
    expect(filterReconciliationRows(rows, 'card').map((item) => item.id)).toEqual(['card_confirmed'])
    expect(filterReconciliationRows(rows, 'tax_invoice').map((item) => item.id)).toEqual(['tax_invoice_confirmed'])
  })

  it('filters missing evidence and exclusion review tabs by review criteria', () => {
    expect(filterReconciliationRows(rows, 'missing_evidence').map((item) => item.id)).toEqual(['missing_evidence'])
    expect(filterReconciliationRows(rows, 'exclusion_review').map((item) => item.id)).toEqual(['low_confidence'])
  })

  it('builds stable filter links with period and optional source query', () => {
    expect(reconciliationFilterHref('2026-H1', 'all')).toBe('/dashboard/bookkeeping/reconciliation-ledger?period=2026-H1')
    expect(reconciliationFilterHref('2026-H1', 'card')).toBe('/dashboard/bookkeeping/reconciliation-ledger?period=2026-H1&source=card')
  })
})
