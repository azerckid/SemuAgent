import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  buildBookkeepingReviewCounts,
  buildJournalEntry,
  confidenceTone,
  filterRowsByTab,
  mapClassificationRow,
  normalizeConfidence,
  requiresManualAccount,
  resolveBookkeepingReviewTab,
  type BookkeepingReviewQueueRow,
} from './summary'

function row(partial: Partial<BookkeepingReviewQueueRow>): BookkeepingReviewQueueRow {
  return {
    id: 'row',
    uploadSessionId: 'sess',
    transactionDate: '2026-06-01',
    description: '거래',
    counterparty: null,
    amountKrw: 1000,
    recommendedAccount: '소모품비',
    finalAccount: null,
    confidence: 'high',
    confidenceTone: 'ok',
    status: 'suggested',
    requiresManualAccount: false,
    ...partial,
  }
}

describe('normalizeConfidence / confidenceTone', () => {
  it('maps confidence to tone (S-30)', () => {
    expect(confidenceTone(normalizeConfidence('high'))).toBe('ok')
    expect(confidenceTone(normalizeConfidence('medium'))).toBe('warn')
    expect(confidenceTone(normalizeConfidence('low'))).toBe('danger')
  })

  it('falls back to low for unknown values', () => {
    expect(normalizeConfidence(null)).toBe('low')
    expect(normalizeConfidence('bogus')).toBe('low')
  })
})

describe('requiresManualAccount', () => {
  it('forces 계정 지정 for low confidence & unconfirmed (S-31)', () => {
    expect(requiresManualAccount('low', 'needs_decision')).toBe(true)
  })
  it('does not force when already confirmed (S-32)', () => {
    expect(requiresManualAccount('low', 'confirmed')).toBe(false)
  })
  it('does not force for high/medium confidence', () => {
    expect(requiresManualAccount('high', 'suggested')).toBe(false)
    expect(requiresManualAccount('medium', 'needs_decision')).toBe(false)
  })
})

describe('resolveBookkeepingReviewTab', () => {
  it('defaults to pending for missing/invalid', () => {
    expect(resolveBookkeepingReviewTab(null)).toBe('pending')
    expect(resolveBookkeepingReviewTab('bogus')).toBe('pending')
  })
  it('accepts valid tabs', () => {
    expect(resolveBookkeepingReviewTab('confirmed')).toBe('confirmed')
    expect(resolveBookkeepingReviewTab('all')).toBe('all')
  })
})

describe('buildBookkeepingReviewCounts (S-20~22)', () => {
  it('counts pending, low confidence, confirmed, total excluding excluded', () => {
    const rows = [
      row({ id: 'a', status: 'suggested', confidence: 'high' }),
      row({ id: 'b', status: 'needs_decision', confidence: 'low' }),
      row({ id: 'c', status: 'confirmed', confidence: 'low' }),
      row({ id: 'd', status: 'unclassified', confidence: 'low' }),
      row({ id: 'e', status: 'excluded', confidence: 'low' }),
    ]
    expect(buildBookkeepingReviewCounts(rows)).toEqual({
      pending: 3,       // a, b, d
      lowConfidence: 2, // b, d (c is confirmed → excluded from low)
      confirmed: 1,     // c
      total: 4,         // excludes e
    })
  })
})

describe('filterRowsByTab', () => {
  const rows = [
    row({ id: 'a', status: 'suggested', confidence: 'high' }),
    row({ id: 'b', status: 'needs_decision', confidence: 'low' }),
    row({ id: 'c', status: 'confirmed', confidence: 'low' }),
    row({ id: 'e', status: 'excluded' }),
  ]

  it('pending tab excludes confirmed/excluded', () => {
    expect(filterRowsByTab(rows, 'pending').map((r) => r.id)).toEqual(['a', 'b'])
  })
  it('low_confidence tab is low & unconfirmed', () => {
    expect(filterRowsByTab(rows, 'low_confidence').map((r) => r.id)).toEqual(['b'])
  })
  it('confirmed tab', () => {
    expect(filterRowsByTab(rows, 'confirmed').map((r) => r.id)).toEqual(['c'])
  })
  it('all tab excludes only excluded', () => {
    expect(filterRowsByTab(rows, 'all').map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('mapClassificationRow', () => {
  it('derives description/counterparty and manual-account flag', () => {
    const mapped = mapClassificationRow({
      id: 'r1',
      uploadSessionId: 's1',
      transactionDate: '2026-06-10',
      merchantName: '오피스디포',
      description: null,
      amountKrw: 55000,
      recommendedAccount: '소모품비',
      finalAccount: null,
      recommendationConfidence: 'low',
      status: 'needs_decision',
    })
    expect(mapped.description).toBe('오피스디포') // description null → merchantName
    expect(mapped.counterparty).toBe('오피스디포')
    expect(mapped.confidenceTone).toBe('danger')
    expect(mapped.requiresManualAccount).toBe(true)
  })
})

describe('buildJournalEntry (S-40~42)', () => {
  it('maps debit/credit sides and derives balance', () => {
    const je = buildJournalEntry([
      { side: 'debit', accountName: '소모품비', accountCode: null, amountKrw: 50000 },
      { side: 'debit', accountName: '부가세대급금', accountCode: null, amountKrw: 5000 },
      { side: 'credit', accountName: '미지급금', accountCode: null, amountKrw: 55000 },
    ])
    expect(je).not.toBeNull()
    expect(je?.lines[0]).toMatchObject({ side: '차변', account: '소모품비', amountKrw: 50000 })
    expect(je?.debitTotal).toBe(55000)
    expect(je?.creditTotal).toBe(55000)
    expect(je?.balanced).toBe(true)
  })

  it('flags unbalanced entries (S-42)', () => {
    const je = buildJournalEntry([
      { side: 'debit', accountName: 'A', accountCode: null, amountKrw: 100 },
      { side: 'credit', accountName: 'B', accountCode: null, amountKrw: 90 },
    ])
    expect(je?.balanced).toBe(false)
  })

  it('returns null when no lines (전표 미생성 → 잠금)', () => {
    expect(buildJournalEntry([])).toBeNull()
  })
})

describe('bookkeeping review loader boundaries', () => {
  const source = readFileSync(new URL('./summary.ts', import.meta.url), 'utf8')

  it('does not reference excluded request/mail tables (S-61)', () => {
    for (const id of ['requestTemplate', 'clientRequestSchedule', 'clientRequestEvent', 'outboundEmail', 'inboundEmail', 'staffMailbox']) {
      expect(source).not.toContain(id)
    }
  })

  it('carries uploadSessionId on each row for session-scoped mutation (S-53)', () => {
    expect(source).toContain('uploadSessionId: bookkeepingTransactionClassification.uploadSessionId')
  })

  it('filters by accounting period and staff_direct source (S-10)', () => {
    expect(source).toContain('gte(uploadSession.accountingPeriod, period.startMonth)')
    expect(source).toContain("eq(uploadSession.source, 'staff_direct')")
  })

  it('excludes superseded classification runs', () => {
    expect(source).toContain('ACTIVE_RUN_STATUSES')
  })
})
