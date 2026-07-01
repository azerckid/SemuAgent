import { describe, expect, it } from 'vitest'
import { buildAttributionSummary } from './build-material-attribution-summary'
import type { ReviewMaterialAttribution } from './review-workspace-types'

function mockAttribution(overrides: Partial<ReviewMaterialAttribution> = {}): ReviewMaterialAttribution {
  return {
    id: 'attr-1',
    uploadSessionId: 'session-1',
    sourceKind: 'transaction_row',
    sourceLabel: 'row-1',
    evidenceDate: '2026-04-01',
    attributedPeriod: '2026-04',
    requestedPeriod: '2026-06',
    closePeriod: '2026-04~2026-06',
    periodRelation: 'prior',
    amountKrw: 1000,
    counterparty: null,
    description: null,
    duplicateStatus: 'none',
    duplicateBasis: null,
    recommendation: 'include',
    staffDecision: null,
    staffNote: null,
    ...overrides,
  }
}

describe('buildAttributionSummary', () => {
  it('returns null when no resolved rows', () => {
    expect(buildAttributionSummary([])).toBeNull()
    expect(buildAttributionSummary([
      mockAttribution({ attributedPeriod: null, periodRelation: 'unknown' }),
    ])).toBeNull()
  })

  it('aggregates solmate-like prior rows inside close window', () => {
    const summary = buildAttributionSummary([
      mockAttribution({ id: 'a1', attributedPeriod: '2026-04', periodRelation: 'prior' }),
      mockAttribution({ id: 'a2', attributedPeriod: '2026-05', periodRelation: 'prior' }),
    ])

    expect(summary).toMatchObject({
      requestedInPeriod: 0,
      prior: 2,
      inCloseWindow: 2,
      outOfScope: 0,
      inCloseWindowPeriods: ['2026-04', '2026-05'],
      outOfScopePeriods: [],
    })
  })

  it('aggregates web3people-like prior rows outside close window', () => {
    const summary = buildAttributionSummary([
      mockAttribution({ id: 'a1', attributedPeriod: '2024-01', periodRelation: 'prior' }),
      mockAttribution({ id: 'a2', attributedPeriod: '2024-02', periodRelation: 'prior' }),
    ])

    expect(summary).toMatchObject({
      requestedInPeriod: 0,
      prior: 2,
      inCloseWindow: 0,
      outOfScope: 2,
      inCloseWindowPeriods: [],
      outOfScopePeriods: ['2024-01', '2024-02'],
    })
  })

  it('counts requested rows and splits mixed prior scope', () => {
    const summary = buildAttributionSummary([
      mockAttribution({ id: 'a1', attributedPeriod: '2026-06', periodRelation: 'requested' }),
      mockAttribution({ id: 'a2', attributedPeriod: '2026-05', periodRelation: 'prior' }),
      mockAttribution({ id: 'a3', attributedPeriod: '2024-01', periodRelation: 'prior' }),
    ])

    expect(summary).toMatchObject({
      requestedInPeriod: 1,
      prior: 2,
      inCloseWindow: 1,
      outOfScope: 1,
      inCloseWindowPeriods: ['2026-05'],
      outOfScopePeriods: ['2024-01'],
    })
  })
})
