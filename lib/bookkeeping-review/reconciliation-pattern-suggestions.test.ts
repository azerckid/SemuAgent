import { describe, expect, it } from 'vitest'
import type { BookkeepingReviewQueueRow } from './summary'
import {
  buildAccountPatternSuggestions,
  formatPatternRejectionMemo,
  isPatternRejectionMemo,
} from './reconciliation-pattern-suggestions'

function buildRow(overrides: Partial<BookkeepingReviewQueueRow> = {}): BookkeepingReviewQueueRow {
  return {
    id: 'row-1',
    uploadSessionId: 'session-1',
    transactionDate: '2026-07-08',
    description: '테스트 거래',
    counterparty: '테스트 거래처',
    amountKrw: 100_000,
    recommendedAccount: 'supplies',
    finalAccount: null,
    confidence: 'high',
    confidenceTone: 'ok',
    status: 'suggested',
    sourceType: 'bank',
    direction: 'expense',
    requiresManualAccount: false,
    staffMemo: null,
    linkedEvidenceRowId: null,
    reconciliation: { matchState: 'confirmed', candidates: [], blockers: [] },
    ...overrides,
  }
}

describe('buildAccountPatternSuggestions', () => {
  it('suggests the dominant prior confirmed account for the same counterparty', () => {
    const target = buildRow({ id: 'target', transactionDate: '2026-07-08', counterparty: '김세무사무소' })
    const rows = [
      target,
      buildRow({ id: 'prior-1', transactionDate: '2026-06-08', counterparty: '김 세무사무소', finalAccount: 'fees', status: 'confirmed' }),
      buildRow({ id: 'prior-2', transactionDate: '2026-05-08', counterparty: '김세무사무소', finalAccount: 'fees', status: 'confirmed' }),
      buildRow({ id: 'other', transactionDate: '2026-06-08', counterparty: '다른거래처', finalAccount: 'rent', status: 'confirmed' }),
    ]

    const suggestion = buildAccountPatternSuggestions(rows).get(target.id)
    expect(suggestion?.suggestedAccount).toBe('fees')
    expect(suggestion?.confidence).toBe('high')
    expect(suggestion?.matchedCount).toBe(2)
    expect(suggestion?.basisLabel).toContain('지급수수료')
    expect(suggestion?.lastSeenPeriod).toBe('2026-06')
  })

  it('does not suggest when prior accounts are tied', () => {
    const target = buildRow({ id: 'target', counterparty: '반복거래처' })
    const rows = [
      target,
      buildRow({ id: 'prior-1', transactionDate: '2026-06-01', counterparty: '반복거래처', finalAccount: 'fees', status: 'confirmed' }),
      buildRow({ id: 'prior-2', transactionDate: '2026-05-01', counterparty: '반복거래처', finalAccount: 'rent', status: 'confirmed' }),
    ]

    expect(buildAccountPatternSuggestions(rows).get(target.id)).toBeUndefined()
  })

  it('does not suggest again after the user rejects the pattern', () => {
    const target = buildRow({
      id: 'target',
      counterparty: '김세무사무소',
      staffMemo: formatPatternRejectionMemo('최근 같은 거래처 1건을 지급수수료로 확정'),
    })
    const rows = [
      target,
      buildRow({ id: 'prior-1', transactionDate: '2026-06-08', counterparty: '김세무사무소', finalAccount: 'fees', status: 'confirmed' }),
    ]

    expect(isPatternRejectionMemo(target.staffMemo)).toBe(true)
    expect(buildAccountPatternSuggestions(rows).get(target.id)).toBeUndefined()
  })

  it('detects pattern rejection even when it is appended after an existing memo', () => {
    const memo = `업무용 결제 확인\n${formatPatternRejectionMemo('최근 같은 거래처 1건을 지급수수료로 확정')}`

    expect(isPatternRejectionMemo(memo)).toBe(true)
  })
})
