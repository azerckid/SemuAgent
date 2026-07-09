import { describe, expect, it } from 'vitest'
import type { BookkeepingReviewQueueRow } from './summary'
import {
  buildAccountPatternSuggestions,
  buildReconciliationPatternSuggestions,
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

describe('buildReconciliationPatternSuggestions', () => {
  it('suggests the prior evidence source for a repeated bank counterparty', () => {
    const target = buildRow({ id: 'target', transactionDate: '2026-07-08', counterparty: '원아이지넥스원', sourceType: 'bank' })
    const rows = [
      target,
      buildRow({
        id: 'prior-bank',
        transactionDate: '2026-06-08',
        counterparty: '원아이지넥스원',
        sourceType: 'bank',
        linkedEvidenceRowId: 'prior-tax',
      }),
      buildRow({
        id: 'prior-tax',
        transactionDate: '2026-06-08',
        counterparty: '원아이지넥스원',
        sourceType: 'tax_invoice',
        status: 'confirmed',
      }),
    ]

    const suggestion = buildReconciliationPatternSuggestions(rows).get(target.id)
    expect(suggestion?.suggestedEvidenceSource).toBe('tax_invoice')
    expect(suggestion?.reason).toBe('same_counterparty_prior_evidence')
    expect(suggestion?.basisLabel).toContain('세금계산서 증빙으로 연결')
  })

  it('suggests the prior exclusion reason for a repeated excluded counterparty', () => {
    const target = buildRow({ id: 'target', transactionDate: '2026-07-08', counterparty: 'PC방나라', sourceType: 'card' })
    const rows = [
      target,
      buildRow({
        id: 'prior-excluded',
        transactionDate: '2026-06-08',
        counterparty: 'PC방나라',
        sourceType: 'card',
        status: 'excluded',
        staffMemo: '제외 사유: 업무무관 - PC방 결제',
      }),
    ]

    const suggestion = buildReconciliationPatternSuggestions(rows).get(target.id)
    expect(suggestion?.suggestedExclusionReason).toBe('business_unrelated')
    expect(suggestion?.reason).toBe('prior_exclusion_pattern')
    expect(suggestion?.basisLabel).toContain('업무무관 제외 사유로 처리')
  })

  it('does not treat evidence exception history as an exclusion pattern', () => {
    const target = buildRow({ id: 'target', transactionDate: '2026-07-08', counterparty: '페이즈 주식회사', sourceType: 'bank' })
    const rows = [
      target,
      buildRow({
        id: 'prior-exception',
        transactionDate: '2026-06-08',
        counterparty: '페이즈 주식회사',
        sourceType: 'bank',
        status: 'suggested',
        staffMemo: '증빙 예외: 내부이체',
      }),
    ]

    expect(buildReconciliationPatternSuggestions(rows).get(target.id)).toBeUndefined()
  })

  it('keeps exclusion as the primary visible basis while preserving account and evidence suggestions', () => {
    const target = buildRow({ id: 'target', transactionDate: '2026-07-08', counterparty: '반복거래처', sourceType: 'bank' })
    const rows = [
      target,
      buildRow({ id: 'prior-account', transactionDate: '2026-06-01', counterparty: '반복거래처', finalAccount: 'fees', status: 'confirmed' }),
      buildRow({ id: 'prior-bank', transactionDate: '2026-06-02', counterparty: '반복거래처', sourceType: 'bank', linkedEvidenceRowId: 'prior-tax' }),
      buildRow({ id: 'prior-tax', transactionDate: '2026-06-02', counterparty: '반복거래처', sourceType: 'tax_invoice', status: 'confirmed' }),
      buildRow({ id: 'prior-excluded', transactionDate: '2026-06-03', counterparty: '반복거래처', status: 'excluded', staffMemo: '제외 사유: 중복 증빙' }),
    ]

    const suggestion = buildReconciliationPatternSuggestions(rows).get(target.id)
    expect(suggestion?.suggestedAccount).toBe('fees')
    expect(suggestion?.suggestedEvidenceSource).toBe('tax_invoice')
    expect(suggestion?.suggestedExclusionReason).toBe('duplicate_evidence')
    expect(suggestion?.reason).toBe('prior_exclusion_pattern')
  })
})
