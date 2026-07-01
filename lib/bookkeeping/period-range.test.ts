import { describe, expect, it } from 'vitest'
import {
  buildBookkeepingPeriodRangeSnapshot,
  formatBookkeepingPeriodRange,
  inferBookkeepingPeriodRange,
  isBookkeepingPeriodInRange,
  periodFromAttributionValue,
  resolveBookkeepingPeriodRange,
  resolveBookkeepingPeriodRangeSnapshot,
} from './period-range'

describe('resolveBookkeepingPeriodRange', () => {
  it('resolves monthly ranges from existing accountingPeriod values', () => {
    expect(resolveBookkeepingPeriodRange({ accountingPeriod: '2024-07' })).toEqual({
      type: 'monthly',
      start: '2024-07',
      end: '2024-07',
      label: '2024-07',
    })
  })

  it('resolves quarterly ranges from quarter labels', () => {
    expect(resolveBookkeepingPeriodRange({
      accountingPeriod: '2024-Q3',
      periodType: 'quarterly',
    })).toEqual({
      type: 'quarterly',
      start: '2024-07',
      end: '2024-09',
      label: '2024-Q3',
    })

    expect(resolveBookkeepingPeriodRange({
      accountingPeriod: '2024 3분기',
      periodType: 'quarterly',
    })).toMatchObject({
      start: '2024-07',
      end: '2024-09',
    })
  })

  it('resolves quarterly ranges from a month inside the quarter', () => {
    expect(resolveBookkeepingPeriodRange({
      accountingPeriod: '2024-08',
      periodType: 'quarterly',
    })).toMatchObject({
      start: '2024-07',
      end: '2024-09',
    })
  })

  it('resolves yearly ranges', () => {
    expect(resolveBookkeepingPeriodRange({
      accountingPeriod: '2024',
      periodType: 'yearly',
    })).toEqual({
      type: 'yearly',
      start: '2024-01',
      end: '2024-12',
      label: '2024',
    })
  })

  it('uses explicit start and end snapshots when present', () => {
    expect(resolveBookkeepingPeriodRange({
      accountingPeriod: '2024-07',
      periodType: 'quarterly',
      periodStart: '2024-07',
      periodEnd: '2024-09',
    })).toEqual({
      type: 'quarterly',
      start: '2024-07',
      end: '2024-09',
      label: '2024-07~2024-09',
    })
  })

  it('rejects invalid or reversed ranges', () => {
    expect(resolveBookkeepingPeriodRange({ accountingPeriod: '2024-13' })).toBeNull()
    expect(resolveBookkeepingPeriodRange({
      accountingPeriod: '2024-07',
      periodStart: '2024-09',
      periodEnd: '2024-07',
    })).toBeNull()
  })
})

describe('inferBookkeepingPeriodRange', () => {
  it('infers period types from stored accounting period labels', () => {
    expect(inferBookkeepingPeriodRange('2024-07')).toMatchObject({
      type: 'monthly',
      start: '2024-07',
      end: '2024-07',
    })
    expect(inferBookkeepingPeriodRange('2024-Q3')).toMatchObject({
      type: 'quarterly',
      start: '2024-07',
      end: '2024-09',
    })
    expect(inferBookkeepingPeriodRange('2024')).toMatchObject({
      type: 'yearly',
      start: '2024-01',
      end: '2024-12',
    })
  })

  it('infers supported explicit ranges', () => {
    expect(inferBookkeepingPeriodRange('2024-07~2024-09')).toMatchObject({
      type: 'quarterly',
      start: '2024-07',
      end: '2024-09',
    })
    expect(inferBookkeepingPeriodRange('2024-01~2024-12')).toMatchObject({
      type: 'yearly',
      start: '2024-01',
      end: '2024-12',
    })
    expect(inferBookkeepingPeriodRange('2024-07~2024-08')).toBeNull()
  })

  it('builds nullable DB snapshots', () => {
    expect(buildBookkeepingPeriodRangeSnapshot({ accountingPeriod: '2024-Q3' })).toEqual({
      bookkeepingPeriodType: 'quarterly',
      bookkeepingPeriodStart: '2024-07',
      bookkeepingPeriodEnd: '2024-09',
    })
    expect(buildBookkeepingPeriodRangeSnapshot({ accountingPeriod: 'invalid' })).toEqual({
      bookkeepingPeriodType: null,
      bookkeepingPeriodStart: null,
      bookkeepingPeriodEnd: null,
    })
  })

  it('builds snapshots from explicit UI period type selection', () => {
    expect(buildBookkeepingPeriodRangeSnapshot({
      accountingPeriod: '2024-07',
      periodType: 'quarterly',
    })).toEqual({
      bookkeepingPeriodType: 'quarterly',
      bookkeepingPeriodStart: '2024-07',
      bookkeepingPeriodEnd: '2024-09',
    })

    expect(buildBookkeepingPeriodRangeSnapshot({
      accountingPeriod: '2024-07',
      periodType: 'yearly',
    })).toEqual({
      bookkeepingPeriodType: 'yearly',
      bookkeepingPeriodStart: '2024-01',
      bookkeepingPeriodEnd: '2024-12',
    })
  })
})

describe('bookkeeping period range membership', () => {
  const q3 = {
    type: 'quarterly' as const,
    start: '2024-07',
    end: '2024-09',
    label: '2024-Q3',
  }

  it('checks whether an attributed period is inside the target range', () => {
    expect(isBookkeepingPeriodInRange('2024-06', q3)).toBe(false)
    expect(isBookkeepingPeriodInRange('2024-07', q3)).toBe(true)
    expect(isBookkeepingPeriodInRange('2024-09', q3)).toBe(true)
    expect(isBookkeepingPeriodInRange('2024-10', q3)).toBe(false)
  })

  it('derives a period from attribution values', () => {
    expect(periodFromAttributionValue({ attributedPeriod: '2024-07', evidenceDate: '2024-08-01' })).toBe('2024-07')
    expect(periodFromAttributionValue({ attributedPeriod: null, evidenceDate: '2024-08-01' })).toBe('2024-08')
    expect(periodFromAttributionValue({ attributedPeriod: null, evidenceDate: null })).toBeNull()
  })

  it('formats single-month and multi-month ranges', () => {
    expect(formatBookkeepingPeriodRange({ type: 'monthly', start: '2024-07', end: '2024-07', label: '2024-07' })).toBe('2024-07')
    expect(formatBookkeepingPeriodRange(q3)).toBe('2024-07~2024-09')
  })
})

describe('resolveBookkeepingPeriodRangeSnapshot', () => {
  it('uses stored explicit snapshot boundaries first', () => {
    expect(resolveBookkeepingPeriodRangeSnapshot({
      accountingPeriod: '2024-07',
      bookkeepingPeriodType: 'quarterly',
      bookkeepingPeriodStart: '2024-07',
      bookkeepingPeriodEnd: '2024-09',
    })).toEqual({
      type: 'quarterly',
      start: '2024-07',
      end: '2024-09',
      label: '2024-07~2024-09',
    })
  })

  it('treats legacy sessions without snapshots as monthly', () => {
    expect(resolveBookkeepingPeriodRangeSnapshot({
      accountingPeriod: '2024-07',
    })).toEqual({
      type: 'monthly',
      start: '2024-07',
      end: '2024-07',
      label: '2024-07',
    })
  })
})
