import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  buildBookkeepingReviewCounts,
  buildJournalEntry,
  confidenceTone,
  filterRowsByTab,
  mapClassificationRow,
  normalizeConfidence,
  pickLatestCompletedRunIdsBySession,
  requiresManualAccount,
  resolveBookkeepingReviewTab,
  selectBookkeepingReviewRowForDetail,
  sessionPeriodOverlapsCompanyPeriod,
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
    sourceType: partial.sourceType ?? 'other',
    direction: partial.direction ?? 'unknown',
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
      sourceType: 'card',
      direction: 'expense',
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

describe('sessionPeriodOverlapsCompanyPeriod (S-10)', () => {
  const h1 = { startMonth: '2026-01', endMonth: '2026-06' }

  it('uses bookkeepingPeriodStart/End snapshot for quarterly/yearly sessions', () => {
    expect(sessionPeriodOverlapsCompanyPeriod({
      accountingPeriod: '2026-Q1',
      bookkeepingPeriodStart: '2026-01',
      bookkeepingPeriodEnd: '2026-03',
    }, h1)).toBe(true)
    expect(sessionPeriodOverlapsCompanyPeriod({
      accountingPeriod: '2025',
      bookkeepingPeriodStart: '2025-01',
      bookkeepingPeriodEnd: '2025-12',
    }, h1)).toBe(false)
  })

  it('falls back to parsing accountingPeriod when snapshot is missing', () => {
    expect(sessionPeriodOverlapsCompanyPeriod({
      accountingPeriod: '2026-Q2',
      bookkeepingPeriodStart: null,
      bookkeepingPeriodEnd: null,
    }, h1)).toBe(true)
    expect(sessionPeriodOverlapsCompanyPeriod({
      accountingPeriod: '2026-Q3',
      bookkeepingPeriodStart: null,
      bookkeepingPeriodEnd: null,
    }, h1)).toBe(false)
  })

  it('normalizes legacy YYYY-MM-DD snapshot values', () => {
    expect(sessionPeriodOverlapsCompanyPeriod({
      accountingPeriod: '2026-06',
      bookkeepingPeriodStart: '2026-06-01',
      bookkeepingPeriodEnd: '2026-06-30',
    }, h1)).toBe(true)
  })

  it('falls back to accountingPeriod when snapshot range is invalid', () => {
    expect(sessionPeriodOverlapsCompanyPeriod({
      accountingPeriod: '2026-Q1',
      bookkeepingPeriodStart: '2026-03',
      bookkeepingPeriodEnd: '2026-01',
    }, h1)).toBe(true)
  })
})

describe('pickLatestCompletedRunIdsBySession (S-23)', () => {
  it('selects only the latest completed run per session and ignores draft/running/failed/superseded', () => {
    expect(pickLatestCompletedRunIdsBySession([
      { id: 's1-old', uploadSessionId: 'session-1', status: 'completed', createdAt: '2026-06-01T00:00:00.000+09:00' },
      { id: 's1-running', uploadSessionId: 'session-1', status: 'running', createdAt: '2026-06-03T00:00:00.000+09:00' },
      { id: 's1-new', uploadSessionId: 'session-1', status: 'completed', createdAt: '2026-06-02T00:00:00.000+09:00' },
      { id: 's2-failed', uploadSessionId: 'session-2', status: 'failed', createdAt: '2026-06-04T00:00:00.000+09:00' },
      { id: 's2-ok', uploadSessionId: 'session-2', status: 'completed', createdAt: '2026-06-01T00:00:00.000+09:00' },
      { id: 's3-superseded', uploadSessionId: 'session-3', status: 'superseded', createdAt: '2026-06-01T00:00:00.000+09:00' },
    ])).toEqual(['s1-new', 's2-ok'])
  })

  it('uses id as a deterministic tie-break when createdAt is identical', () => {
    expect(pickLatestCompletedRunIdsBySession([
      { id: 'run-a', uploadSessionId: 'session-1', status: 'completed', createdAt: '2026-06-01T00:00:00.000+09:00' },
      { id: 'run-b', uploadSessionId: 'session-1', status: 'completed', createdAt: '2026-06-01T00:00:00.000+09:00' },
    ])).toEqual(['run-b'])
  })
})

describe('selectBookkeepingReviewRowForDetail', () => {
  it('keeps the selected detail inside the current tab rows (P2)', () => {
    const pending = row({ id: 'pending', status: 'suggested' })
    const confirmed = row({ id: 'confirmed', status: 'confirmed' })
    const tabRows = filterRowsByTab([pending, confirmed], 'pending')

    expect(selectBookkeepingReviewRowForDetail(tabRows, 'confirmed')?.id).toBe('pending')
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

  it('delegates staff_direct/period scoping to the shared source_batch resolver (S-10, JC-031 3b)', () => {
    expect(source).toContain('resolveActiveSourceBatchSessionIds({')
    expect(source).not.toContain('from(uploadSession)')
    expect(source).not.toContain("eq(uploadSession.source, 'staff_direct')")
  })

  it('uses only latest completed classification runs', () => {
    expect(source).toContain("eq(bookkeepingClassificationRun.status, 'completed')")
    expect(source).toContain('pickLatestCompletedRunIdsBySession(runRows)')
  })

  it('orders the queue by latest transaction date first for Preview parity', () => {
    expect(source).toContain('desc(bookkeepingTransactionClassification.transactionDate)')
    expect(source).toContain('desc(bookkeepingTransactionClassification.createdAt)')
  })
})
