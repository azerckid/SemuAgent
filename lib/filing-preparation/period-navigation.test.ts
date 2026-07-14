import { describe, expect, it } from 'vitest'
import { buildPeriodNavigationHrefs } from './period-navigation'

describe('filing preparation period navigation', () => {
  it('moves monthly periods across a year boundary', () => {
    expect(buildPeriodNavigationHrefs({
      pathname: '/dashboard/filing-preparation/local-income-tax',
      periodKey: '2026-01',
      latestPeriodKey: '2026-06',
      granularity: 'month',
    })).toEqual({
      previousHref: '/dashboard/filing-preparation/local-income-tax?period=2025-12',
      nextHref: '/dashboard/filing-preparation/local-income-tax?period=2026-02',
    })
  })

  it('moves half-year periods and stops at the latest loader period', () => {
    expect(buildPeriodNavigationHrefs({
      pathname: '/dashboard/filing-preparation/payment-statements',
      periodKey: '2026-H1',
      latestPeriodKey: '2026-H1',
      granularity: 'half_year',
    })).toEqual({
      previousHref: '/dashboard/filing-preparation/payment-statements?period=2025-H2',
      nextHref: undefined,
    })
  })

  it('allows returning toward the latest annual period', () => {
    expect(buildPeriodNavigationHrefs({
      pathname: '/dashboard/filing-preparation/year-end-settlement',
      periodKey: '2024',
      latestPeriodKey: '2025',
      granularity: 'year',
    })).toEqual({
      previousHref: '/dashboard/filing-preparation/year-end-settlement?period=2023',
      nextHref: '/dashboard/filing-preparation/year-end-settlement?period=2025',
    })
  })

  it('returns read-only navigation for unsupported or mismatched keys', () => {
    expect(buildPeriodNavigationHrefs({
      pathname: '/dashboard/filing-preparation',
      periodKey: '2026-Q2',
      latestPeriodKey: '2026-H1',
      granularity: 'half_year',
    })).toEqual({})
  })
})
