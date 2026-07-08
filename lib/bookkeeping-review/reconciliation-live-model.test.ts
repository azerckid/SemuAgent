import { describe, expect, it } from 'vitest'
import type { BookkeepingReviewQueueRow } from './summary'
import {
  buildLiveReconciliationLedgerRow,
  buildLiveRowConclusion,
  mapLiveEvidenceActionState,
  mapLiveMatchCandidate,
  resolveLivePrimaryAction,
} from './reconciliation-live-model'
import { reconciliationLedgerRowSchema } from './reconciliation-display-model'

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
    reconciliation: { matchState: 'confirmed', candidates: [], blockers: [] },
    ...overrides,
  }
}

describe('mapLiveEvidenceActionState', () => {
  it('maps excluded status to excluded regardless of source or candidates', () => {
    const row = buildRow({ status: 'excluded', sourceType: 'card' })
    expect(mapLiveEvidenceActionState(row)).toBe('excluded')
  })

  it('maps rows with candidates to candidate', () => {
    const row = buildRow({
      reconciliation: {
        matchState: 'candidate',
        candidates: [{
          id: 'c1', sourceType: 'tax_invoice', rowId: 'other-row', date: '2026-07-08',
          counterparty: '테스트 거래처', amountKrw: 100_000, confidence: 'high', reason: 'same_amount_same_day',
        }],
        blockers: [],
      },
    })
    expect(mapLiveEvidenceActionState(row)).toBe('candidate')
  })

  it('requires evidence for bank/other sources with no candidates', () => {
    expect(mapLiveEvidenceActionState(buildRow({ sourceType: 'bank' }))).toBe('evidence_required')
    expect(mapLiveEvidenceActionState(buildRow({ sourceType: 'other' }))).toBe('evidence_required')
  })

  it('treats card/receipt/tax_invoice sources with no candidates as self-sufficient evidence', () => {
    expect(mapLiveEvidenceActionState(buildRow({ sourceType: 'card' }))).toBe('linked')
    expect(mapLiveEvidenceActionState(buildRow({ sourceType: 'receipt' }))).toBe('linked')
    expect(mapLiveEvidenceActionState(buildRow({ sourceType: 'tax_invoice' }))).toBe('linked')
  })
})

describe('mapLiveMatchCandidate', () => {
  it('renames sourceType to source and defaults taxAmountKrw to null', () => {
    const mapped = mapLiveMatchCandidate({
      id: 'c1', sourceType: 'tax_invoice', rowId: 'row-2', date: '2026-07-01',
      counterparty: '거래처', amountKrw: 50_000, confidence: 'medium', reason: 'same_amount_near_day',
    })

    expect(mapped).toEqual({
      id: 'c1', source: 'tax_invoice', rowId: 'row-2', date: '2026-07-01',
      counterparty: '거래처', amountKrw: 50_000, taxAmountKrw: null, confidence: 'medium', reason: 'same_amount_near_day',
    })
  })
})

describe('resolveLivePrimaryAction', () => {
  it('prioritizes connect_evidence for evidence_required and candidate states', () => {
    expect(resolveLivePrimaryAction(buildRow(), 'evidence_required')).toBe('connect_evidence')
    expect(resolveLivePrimaryAction(buildRow(), 'candidate')).toBe('connect_evidence')
  })

  it('falls back to confirm_account when the row is not yet confirmed', () => {
    expect(resolveLivePrimaryAction(buildRow({ status: 'suggested' }), 'linked')).toBe('confirm_account')
  })

  it('uses review_only for confirmed or excluded rows', () => {
    expect(resolveLivePrimaryAction(buildRow({ status: 'confirmed' }), 'linked')).toBe('review_only')
    expect(resolveLivePrimaryAction(buildRow({ status: 'excluded' }), 'excluded')).toBe('review_only')
  })
})

describe('buildLiveRowConclusion', () => {
  it('keeps actions disabled and explains why', () => {
    const conclusion = buildLiveRowConclusion(buildRow(), 'evidence_required')
    expect(conclusion.actionEnabled).toBe(false)
    expect(conclusion.disabledReason).toBe('Slice 2b 전까지 저장·확정이 비활성화됩니다.')
  })

  it('surfaces the top candidate reason in the headline and basis label', () => {
    const row = buildRow({
      reconciliation: {
        matchState: 'candidate',
        candidates: [{
          id: 'c1', sourceType: 'tax_invoice', rowId: 'other-row', date: '2026-07-08',
          counterparty: '테스트 거래처', amountKrw: 100_000, confidence: 'high', reason: 'same_amount_same_day',
        }],
        blockers: [],
      },
    })
    const conclusion = buildLiveRowConclusion(row, 'candidate')
    expect(conclusion.headline).toContain('같은 금액·같은 일자')
    expect(conclusion.basisLabel).toBe('같은 금액·같은 일자')
  })

  it('never uses forbidden candidate-count wording (Brief 41 §0.3)', () => {
    const withCandidate = buildRow({
      reconciliation: {
        matchState: 'candidate',
        candidates: [{
          id: 'c1', sourceType: 'tax_invoice', rowId: 'other-row', date: '2026-07-08',
          counterparty: '테스트 거래처', amountKrw: 100_000, confidence: 'high', reason: 'same_amount_same_day',
        }],
        blockers: [],
      },
    })
    const withoutCandidate = buildRow()

    for (const conclusion of [
      buildLiveRowConclusion(withCandidate, 'candidate'),
      buildLiveRowConclusion(withoutCandidate, 'candidate'),
      buildLiveRowConclusion(withoutCandidate, 'evidence_required'),
      buildLiveRowConclusion(withoutCandidate, 'linked'),
      buildLiveRowConclusion(withoutCandidate, 'excluded'),
    ]) {
      expect(conclusion.headline).not.toContain('후보')
      expect(conclusion.basisLabel).not.toContain('후보')
    }
  })
})

describe('buildLiveReconciliationLedgerRow', () => {
  it('produces a schema-valid ReconciliationLedgerRow', () => {
    const row = buildRow({
      reconciliation: {
        matchState: 'candidate',
        candidates: [{
          id: 'c1', sourceType: 'tax_invoice', rowId: 'other-row', date: '2026-07-08',
          counterparty: '테스트 거래처', amountKrw: 100_000, confidence: 'high', reason: 'same_amount_same_day',
        }],
        blockers: [{ code: 'account_unconfirmed', label: '계정항목 미확정' }],
      },
    })
    const ledgerRow = buildLiveReconciliationLedgerRow(row, { mode: 'month', label: '2026년 7월 기장검토' })

    expect(() => reconciliationLedgerRowSchema.parse(ledgerRow)).not.toThrow()
    expect(ledgerRow.actions).toEqual({
      canConfirmAccount: false,
      canExplain: false,
      canExclude: false,
      canConfirmMatch: false,
    })
    expect(ledgerRow.patternSuggestion).toBeNull()
    expect(ledgerRow.explanationMemo).toBeNull()
    expect(ledgerRow.exclusionReason).toBeNull()
  })

  it('produces a schema-valid row for excluded and evidence_required cases too', () => {
    const excludedRow = buildLiveReconciliationLedgerRow(
      buildRow({ status: 'excluded' }),
      { mode: 'month', label: '2026년 7월 기장검토' },
    )
    expect(() => reconciliationLedgerRowSchema.parse(excludedRow)).not.toThrow()

    const evidenceRequiredRow = buildLiveReconciliationLedgerRow(
      buildRow({ sourceType: 'bank' }),
      { mode: 'month', label: '2026년 7월 기장검토' },
    )
    expect(() => reconciliationLedgerRowSchema.parse(evidenceRequiredRow)).not.toThrow()
  })
})
