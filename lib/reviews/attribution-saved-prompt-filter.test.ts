import { describe, expect, it } from 'vitest'
import { applyReviewAttributionFilterSpec } from '@/lib/reviews/attribution-saved-prompt-filter'
import type { AttributionSavedPromptFilterRow } from '@/lib/reviews/attribution-saved-prompt-filter'
import type { ReviewAttributionFilterSpecV1 } from '@/lib/reviews/attribution-saved-prompt-filter-schema'

const rows: AttributionSavedPromptFilterRow[] = [
  {
    id: '1',
    fileLabel: '통장.pdf',
    sourceLabel: '통장 거래내역',
    evidenceDate: '2026-01-15',
    attributedPeriod: '2026-01',
    periodRelation: 'requested',
    amountKrw: 1_500_000,
    counterparty: 'ABC상사',
    description: '매출 입금',
    duplicateStatus: 'none',
    recommendation: 'include',
    staffDecision: null,
  },
  {
    id: '2',
    fileLabel: '세금계산서.xlsx',
    sourceLabel: '세금계산서',
    evidenceDate: '2025-12-28',
    attributedPeriod: '2025-12',
    periodRelation: 'prior',
    amountKrw: 800_000,
    counterparty: 'XYZ물류',
    description: '운송비',
    duplicateStatus: 'possible_duplicate',
    recommendation: 'hold',
    staffDecision: 'hold',
  },
  {
    id: '3',
    fileLabel: '영수증.jpg',
    sourceLabel: '카드 영수증',
    evidenceDate: '2026-02-01',
    attributedPeriod: '2026-02',
    periodRelation: 'future',
    amountKrw: 120_000,
    counterparty: '카페',
    description: '간담회',
    duplicateStatus: 'none',
    recommendation: 'reference_only',
    staffDecision: 'include',
  },
]

function spec(partial: Omit<ReviewAttributionFilterSpecV1, 'version' | 'explanationKo'> & { explanationKo?: string }): ReviewAttributionFilterSpecV1 {
  return {
    version: 1,
    explanationKo: partial.explanationKo ?? '테스트',
    ...partial,
  }
}

describe('applyReviewAttributionFilterSpec', () => {
  it('filters by amountKrw min', () => {
    const result = applyReviewAttributionFilterSpec(rows, spec({ amountKrw: { min: 500_000 } }))
    expect(result.summary.matchedRows).toBe(2)
    expect(result.rows.map((row) => row.id)).toEqual(['1', '2'])
  })

  it('filters by periodRelationIn', () => {
    const result = applyReviewAttributionFilterSpec(rows, spec({ periodRelationIn: ['prior', 'future'] }))
    expect(result.rows.map((row) => row.id)).toEqual(['2', '3'])
  })

  it('filters undecided staff decision', () => {
    const result = applyReviewAttributionFilterSpec(rows, spec({ staffDecisionIn: ['undecided'] }))
    expect(result.rows.map((row) => row.id)).toEqual(['1'])
  })

  it('filters by textContains across fields', () => {
    const result = applyReviewAttributionFilterSpec(rows, spec({ textContains: ['통장'] }))
    expect(result.rows.map((row) => row.id)).toEqual(['1'])
  })

  it('sorts by amountKrw desc and applies limit', () => {
    const result = applyReviewAttributionFilterSpec(
      rows,
      spec({
        amountKrw: { min: 1 },
        sort: { field: 'amountKrw', direction: 'desc' },
        limit: 2,
      }),
    )
    expect(result.rows.map((row) => row.id)).toEqual(['1', '2'])
    expect(result.summary.amountSumKrw).toBe(2_300_000)
  })

  it('computes needsReviewRows for null staffDecision', () => {
    const result = applyReviewAttributionFilterSpec(rows, spec({ amountKrw: { min: 1 } }))
    expect(result.summary.needsReviewRows).toBe(1)
  })
})
