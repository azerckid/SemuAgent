import { describe, expect, it } from 'vitest'
import {
  buildFiscalYearMonths,
  deriveFiscalLedgerMonthStatus,
  resolveLedgerPeriodRange,
} from './fiscal-year-ledger-rules'

describe('bookkeeping fiscal year ledger', () => {
  it('builds all 12 month slots for a fiscal year', () => {
    expect(buildFiscalYearMonths(2026)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ])
  })

  it('derives the conservative Slice 1 month statuses', () => {
    expect(deriveFiscalLedgerMonthStatus({
      sessionCount: 0,
      includedMaterialCount: 0,
      completedClassificationRunCount: 0,
      journalEntryRunCount: 0,
    })).toBe('not_requested')

    expect(deriveFiscalLedgerMonthStatus({
      sessionCount: 1,
      includedMaterialCount: 0,
      completedClassificationRunCount: 0,
      journalEntryRunCount: 0,
    })).toBe('requested')

    expect(deriveFiscalLedgerMonthStatus({
      sessionCount: 1,
      includedMaterialCount: 3,
      completedClassificationRunCount: 0,
      journalEntryRunCount: 0,
    })).toBe('classification_needed')

    expect(deriveFiscalLedgerMonthStatus({
      sessionCount: 1,
      includedMaterialCount: 3,
      completedClassificationRunCount: 1,
      journalEntryRunCount: 0,
    })).toBe('journal_needed')

    expect(deriveFiscalLedgerMonthStatus({
      sessionCount: 1,
      includedMaterialCount: 3,
      completedClassificationRunCount: 1,
      journalEntryRunCount: 1,
    })).toBe('journal_draft_ready')
  })
})

describe('resolveLedgerPeriodRange', () => {
  it('defaults to the full fiscal year when no period is given', () => {
    expect(resolveLedgerPeriodRange(2026, undefined)).toEqual({
      type: 'year',
      start: '2026-01',
      end: '2026-12',
      label: '2026',
    })
  })

  it('parses a month', () => {
    expect(resolveLedgerPeriodRange(2026, '2026-05')).toEqual({
      type: 'month',
      start: '2026-05',
      end: '2026-05',
      label: '2026-05',
    })
  })

  it('parses a quarter', () => {
    expect(resolveLedgerPeriodRange(2026, '2026-Q2')).toEqual({
      type: 'quarter',
      start: '2026-04',
      end: '2026-06',
      label: '2026-Q2',
    })
  })

  it('parses a half year', () => {
    expect(resolveLedgerPeriodRange(2026, '2026-H1')).toEqual({
      type: 'half',
      start: '2026-01',
      end: '2026-06',
      label: '2026-H1',
    })
    expect(resolveLedgerPeriodRange(2026, '2026-H2')).toEqual({
      type: 'half',
      start: '2026-07',
      end: '2026-12',
      label: '2026-H2',
    })
  })

  it('parses a bare year', () => {
    expect(resolveLedgerPeriodRange(2026, '2026')).toEqual({
      type: 'year',
      start: '2026-01',
      end: '2026-12',
      label: '2026',
    })
  })

  it('rejects a period whose year does not match the ledger fiscal year', () => {
    expect(resolveLedgerPeriodRange(2026, '2025-05')).toBeNull()
    expect(resolveLedgerPeriodRange(2026, '2025-Q2')).toBeNull()
    expect(resolveLedgerPeriodRange(2026, '2025-H1')).toBeNull()
    expect(resolveLedgerPeriodRange(2026, '2025')).toBeNull()
  })

  it('rejects an unrecognized format', () => {
    expect(resolveLedgerPeriodRange(2026, 'not-a-period')).toBeNull()
  })
})
