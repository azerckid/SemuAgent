import { describe, expect, it } from 'vitest'
import { attachReconciliationInfo, type BookkeepingReviewQueueRow, type BookkeepingReviewSummary } from './summary'
import {
  buildLiveBatchSuggestionGroups,
  buildLiveClosingChecklist,
  buildLiveNextActions,
  buildLiveReconciliationLedgerDisplayModel,
  buildLiveTaxBlockerSummaries,
  inferReconciliationPeriodMode,
} from './reconciliation-live-display-model'
import { buildLiveReconciliationLedgerRow } from './reconciliation-live-model'
import { reconciliationLedgerDisplayModelSchema } from './reconciliation-display-model'

function buildRow(overrides: Partial<BookkeepingReviewQueueRow> = {}): BookkeepingReviewQueueRow {
  return {
    id: 'row-1',
    uploadSessionId: 'session-1',
    transactionDate: '2026-07-08',
    description: '테스트 거래',
    counterparty: '테스트 거래처',
    amountKrw: 100_000,
    recommendedAccount: '복리후생비',
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

describe('inferReconciliationPeriodMode', () => {
  it('recognizes half-year, quarter, and month keys', () => {
    expect(inferReconciliationPeriodMode('2026-H1')).toBe('half_year')
    expect(inferReconciliationPeriodMode('2026-Q3')).toBe('quarter')
    expect(inferReconciliationPeriodMode('2026-07')).toBe('month')
  })

  it('falls back to custom for anything else', () => {
    expect(inferReconciliationPeriodMode('2026')).toBe('custom')
    expect(inferReconciliationPeriodMode('bad-period')).toBe('custom')
  })
})

describe('buildLiveClosingChecklist', () => {
  it('counts each blocker category independently', () => {
    const queueRows = attachReconciliationInfo([
      buildRow({ id: 'a', sourceType: 'bank', status: 'confirmed', amountKrw: 1 }),
      buildRow({ id: 'b', sourceType: 'bank', status: 'suggested', amountKrw: 2 }),
      buildRow({ id: 'c', sourceType: 'card', status: 'excluded', amountKrw: 3 }),
    ])
    const rows = queueRows.map((row) => buildLiveReconciliationLedgerRow(row, { mode: 'month', label: 'label' }))
    const checklist = buildLiveClosingChecklist(rows)

    expect(checklist.evidenceRequiredCount).toBe(2) // a, b are both bank with no candidates
    expect(checklist.accountUnconfirmedCount).toBe(1) // b is not confirmed
    expect(checklist.exclusionReasonRequiredCount).toBe(1) // c is excluded with no staffMemo recorded yet
    expect(checklist.explanationRequiredCount).toBe(0) // not derivable yet
    expect(checklist.taxBlockerCount).toBe(4)
    expect(checklist.isReadyForPath1).toBe(false)
  })

  it('is ready for Path 1 when there are no blockers', () => {
    const rows = [
      buildLiveReconciliationLedgerRow(buildRow({ id: 'a', sourceType: 'card', status: 'confirmed' }), { mode: 'month', label: 'label' }),
    ]
    expect(buildLiveClosingChecklist(rows).isReadyForPath1).toBe(true)
  })

  it('clears exclusionReasonRequiredCount once a reason is saved into staffMemo (PR #169 review P1)', () => {
    // saveReconciliationRowExclusion writes the reason into staffMemo (v1
    // has no structured exclusionReason column) — row.exclusionReason
    // itself stays permanently null for live rows, so the checklist must
    // read explanationMemo (staffMemo) to notice a saved reason.
    const rows = [
      buildLiveReconciliationLedgerRow(
        buildRow({ id: 'c', sourceType: 'card', status: 'excluded', staffMemo: '제외 사유: 개인 사용 - 영화 관람' }),
        { mode: 'month', label: 'label' },
      ),
    ]
    const checklist = buildLiveClosingChecklist(rows)
    expect(checklist.exclusionReasonRequiredCount).toBe(0)
    expect(checklist.isReadyForPath1).toBe(true)
  })
})

describe('buildLiveTaxBlockerSummaries', () => {
  it('only reports the vat track, honestly derived from the checklist', () => {
    const checklist = buildLiveClosingChecklist([
      buildLiveReconciliationLedgerRow(buildRow({ sourceType: 'bank' }), { mode: 'month', label: 'label' }),
    ])
    const summaries = buildLiveTaxBlockerSummaries(checklist)

    expect(summaries).toHaveLength(1)
    expect(summaries[0]!.taxTrack).toBe('vat')
    expect(summaries[0]!.blockerCount).toBe(checklist.taxBlockerCount)
    expect(summaries[0]!.canGeneratePath1File).toBe(checklist.isReadyForPath1)
  })
})

describe('buildLiveNextActions', () => {
  it('surfaces the highest-amount evidence_required and account_unconfirmed rows', () => {
    const rows = [
      buildLiveReconciliationLedgerRow(buildRow({ id: 'small', sourceType: 'bank', amountKrw: 10_000, status: 'confirmed' }), { mode: 'month', label: 'label' }),
      buildLiveReconciliationLedgerRow(buildRow({ id: 'large', sourceType: 'bank', amountKrw: 900_000, status: 'confirmed' }), { mode: 'month', label: 'label' }),
    ]
    const actions = buildLiveNextActions(rows)

    expect(actions).toHaveLength(1)
    expect(actions[0]!.priority).toBe('filing_blocker')
    expect(actions[0]!.targetRowId).toBe('large')
    expect(actions[0]!.label).toBe('증빙 필요 2건')
  })

  it('returns an empty queue when nothing is blocked', () => {
    const rows = [
      buildLiveReconciliationLedgerRow(buildRow({ sourceType: 'card', status: 'confirmed' }), { mode: 'month', label: 'label' }),
    ]
    expect(buildLiveNextActions(rows)).toEqual([])
  })

  it('surfaces excluded rows that still need a reason, matching closingChecklist.exclusionReasonRequiredCount', () => {
    const rows = [
      buildLiveReconciliationLedgerRow(buildRow({ id: 'excluded-small', sourceType: 'card', status: 'excluded', amountKrw: 5_000 }), { mode: 'month', label: 'label' }),
      buildLiveReconciliationLedgerRow(buildRow({ id: 'excluded-large', sourceType: 'card', status: 'excluded', amountKrw: 500_000 }), { mode: 'month', label: 'label' }),
    ]
    const actions = buildLiveNextActions(rows)

    expect(actions).toHaveLength(1)
    expect(actions[0]!.priority).toBe('filing_blocker')
    expect(actions[0]!.targetRowId).toBe('excluded-large')
    expect(actions[0]!.label).toBe('제외 사유 필요 2건')
    expect(actions[0]!.targetRoute).toBe('/dashboard/bookkeeping/reconciliation-ledger?source=exclusion_review')
  })

  it('excludes rows that already have a saved reason from the queue (PR #169 review P1)', () => {
    const rows = [
      buildLiveReconciliationLedgerRow(
        buildRow({ id: 'excluded-with-reason', sourceType: 'card', status: 'excluded', staffMemo: '제외 사유: 중복 결제' }),
        { mode: 'month', label: 'label' },
      ),
    ]
    expect(buildLiveNextActions(rows)).toEqual([])
  })
})

describe('buildLiveBatchSuggestionGroups', () => {
  it('groups safe repeated account suggestions by counterparty and account', () => {
    const rows = [
      buildLiveReconciliationLedgerRow(buildRow({ id: 'target-a', counterparty: '김세무사무소', status: 'suggested' }), { mode: 'month', label: 'label' }, {
        suggestedAccount: 'fees',
        suggestedEvidenceSource: null,
        suggestedExclusionReason: null,
        confidence: 'high',
        basisLabel: '최근 같은 거래처 2건을 지급수수료로 확정',
        matchedCount: 2,
        lastSeenPeriod: '2026-06',
        reason: 'same_counterparty_prior_account',
      }),
      buildLiveReconciliationLedgerRow(buildRow({ id: 'target-b', counterparty: '김세무사무소', status: 'suggested' }), { mode: 'month', label: 'label' }, {
        suggestedAccount: 'fees',
        suggestedEvidenceSource: null,
        suggestedExclusionReason: null,
        confidence: 'high',
        basisLabel: '최근 같은 거래처 2건을 지급수수료로 확정',
        matchedCount: 2,
        lastSeenPeriod: '2026-06',
        reason: 'same_counterparty_prior_account',
      }),
    ]

    const groups = buildLiveBatchSuggestionGroups(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.suggestedAction).toBe('apply_account')
    expect(groups[0]!.rowIds).toEqual(['target-a', 'target-b'])
    expect(groups[0]!.eligibility).toBe('safe_to_offer')
  })
})

describe('buildLiveReconciliationLedgerDisplayModel', () => {
  it('produces a schema-valid ReconciliationLedgerDisplayModel from a summary', () => {
    const summary: BookkeepingReviewSummary = {
      tenant: { id: 't1', name: '회사', timezone: 'Asia/Seoul' },
      businessEntity: { id: 'b1', name: '사업장' },
      period: {
        key: '2026-07',
        label: '2026년 7월 기장검토',
        startMonth: '2026-07',
        endMonth: '2026-07',
        filingDeadline: '2026-08-10',
        dDay: 10,
        progressPercent: 50,
      },
      tab: 'all',
      counts: { pending: 1, lowConfidence: 0, confirmed: 0, total: 1 },
      rows: [
        buildRow({ id: 'row-1', counterparty: '김세무사무소', transactionDate: '2026-07-08', status: 'suggested' }),
        buildRow({ id: 'prior-1', counterparty: '김세무사무소', transactionDate: '2026-06-08', finalAccount: 'fees', status: 'confirmed' }),
      ],
      selected: null,
    }

    const model = buildLiveReconciliationLedgerDisplayModel(summary)

    expect(() => reconciliationLedgerDisplayModelSchema.parse(model)).not.toThrow()
    expect(model.rows).toHaveLength(2)
    expect(model.rows[0]!.periodMode).toBe('month')
    expect(model.rows[0]!.periodLabel).toBe('2026년 7월 기장검토')
    expect(model.rows[0]!.patternSuggestion?.suggestedAccount).toBe('fees')
  })

  it('carries prior evidence and exclusion patterns into live rows', () => {
    const summary: BookkeepingReviewSummary = {
      tenant: { id: 't1', name: '회사', timezone: 'Asia/Seoul' },
      businessEntity: { id: 'b1', name: '사업장' },
      period: {
        key: '2026-07',
        label: '2026년 7월 기장검토',
        startMonth: '2026-07',
        endMonth: '2026-07',
        filingDeadline: '2026-08-10',
        dDay: 10,
        progressPercent: 50,
      },
      tab: 'all',
      counts: { pending: 2, lowConfidence: 0, confirmed: 0, total: 2 },
      rows: [
        buildRow({ id: 'bank-target', counterparty: '원아이지넥스원', transactionDate: '2026-07-08', sourceType: 'bank' }),
        buildRow({ id: 'bank-prior', counterparty: '원아이지넥스원', transactionDate: '2026-06-08', sourceType: 'bank', linkedEvidenceRowId: 'tax-prior' }),
        buildRow({ id: 'tax-prior', counterparty: '원아이지넥스원', transactionDate: '2026-06-08', sourceType: 'tax_invoice', status: 'confirmed' }),
        buildRow({ id: 'exclude-target', counterparty: 'PC방나라', transactionDate: '2026-07-08', sourceType: 'card' }),
        buildRow({ id: 'exclude-prior', counterparty: 'PC방나라', transactionDate: '2026-06-08', sourceType: 'card', status: 'excluded', staffMemo: '제외 사유: 업무무관 - PC방 결제' }),
      ],
      selected: null,
    }

    const model = buildLiveReconciliationLedgerDisplayModel(summary)
    expect(model.rows.find((row) => row.id === 'bank-target')?.patternSuggestion?.suggestedEvidenceSource).toBe('tax_invoice')
    expect(model.rows.find((row) => row.id === 'exclude-target')?.patternSuggestion?.suggestedExclusionReason).toBe('business_unrelated')
  })

  it('produces a schema-valid empty model when there are no rows', () => {
    const summary: BookkeepingReviewSummary = {
      tenant: { id: 't1', name: '회사', timezone: 'Asia/Seoul' },
      businessEntity: null,
      period: {
        key: '2026-H1',
        label: '2026년 부가세 1기 확정 신고',
        startMonth: '2026-01',
        endMonth: '2026-06',
        filingDeadline: '2026-07-25',
        dDay: 5,
        progressPercent: 90,
      },
      tab: 'all',
      counts: { pending: 0, lowConfidence: 0, confirmed: 0, total: 0 },
      rows: [],
      selected: null,
    }

    const model = buildLiveReconciliationLedgerDisplayModel(summary)
    expect(() => reconciliationLedgerDisplayModelSchema.parse(model)).not.toThrow()
    expect(model.rows).toEqual([])
    expect(model.closingChecklist.isReadyForPath1).toBe(true)
  })
})
