import { describe, expect, it } from 'vitest'
import {
  buildLedgerPeriodOptions,
  summarizeLedgerPeriod,
  type LedgerMonthView,
} from './bookkeeping-fiscal-year-panel-helpers'

function month(periodMonth: string, overrides: Partial<LedgerMonthView> = {}): LedgerMonthView {
  return {
    id: periodMonth,
    periodMonth,
    status: 'not_requested',
    lastUploadSessionId: null,
    counts: {
      sessionCount: 0,
      includedMaterialCount: 0,
      completedClassificationRunCount: 0,
      journalEntryRunCount: 0,
    },
    ...overrides,
  }
}

describe('bookkeeping fiscal year panel helpers', () => {
  it('builds year, half, quarter, and month period options', () => {
    const options = buildLedgerPeriodOptions(2026)

    expect(options.map((option) => option.value)).toEqual([
      '2026',
      '2026-H1',
      '2026-H2',
      '2026-Q1',
      '2026-Q2',
      '2026-Q3',
      '2026-Q4',
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

  it('summarizes selected half-year months and counts', () => {
    const months = [
      month('2026-01'),
      month('2026-02', {
        status: 'classification_needed',
        counts: {
          sessionCount: 1,
          includedMaterialCount: 3,
          completedClassificationRunCount: 0,
          journalEntryRunCount: 0,
        },
      }),
      month('2026-03', {
        status: 'journal_draft_ready',
        counts: {
          sessionCount: 1,
          includedMaterialCount: 2,
          completedClassificationRunCount: 1,
          journalEntryRunCount: 1,
        },
      }),
      month('2026-07', {
        status: 'journal_needed',
        counts: {
          sessionCount: 1,
          includedMaterialCount: 1,
          completedClassificationRunCount: 1,
          journalEntryRunCount: 0,
        },
      }),
    ]

    const summary = summarizeLedgerPeriod({ fiscalYear: 2026, months, period: '2026-H1' })

    expect(summary.option).toMatchObject({ value: '2026-H1', start: '2026-01', end: '2026-06' })
    expect(summary.selectedMonths.map((item) => item.periodMonth)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(summary.totals).toEqual({
      sessionCount: 2,
      includedMaterialCount: 5,
      completedClassificationRunCount: 1,
      journalEntryRunCount: 1,
    })
    expect(summary.statusCounts).toMatchObject({
      not_requested: 1,
      classification_needed: 1,
      journal_draft_ready: 1,
      journal_needed: 0,
    })
  })
})
