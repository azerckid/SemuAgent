import { describe, expect, it } from 'vitest'
import { rollupDailyRevenue } from './revenue-rollup'

describe('rollupDailyRevenue', () => {
  it('keeps day granularity as one bucket per day', () => {
    const result = rollupDailyRevenue(
      [
        { date: '2026-06-01', paidAmountKrw: 1000, failedAmountKrw: 0 },
        { date: '2026-06-02', paidAmountKrw: 2000, failedAmountKrw: 500 },
      ],
      'day',
    )

    expect(result).toEqual([
      { bucketStart: '2026-06-01', label: '2026-06-01', paidAmountKrw: 1000, failedAmountKrw: 0 },
      { bucketStart: '2026-06-02', label: '2026-06-02', paidAmountKrw: 2000, failedAmountKrw: 500 },
    ])
  })

  it('sums days within the same calendar month', () => {
    const result = rollupDailyRevenue(
      [
        { date: '2026-06-01', paidAmountKrw: 1000, failedAmountKrw: 100 },
        { date: '2026-06-15', paidAmountKrw: 2000, failedAmountKrw: 0 },
        { date: '2026-07-01', paidAmountKrw: 500, failedAmountKrw: 0 },
      ],
      'month',
    )

    expect(result).toEqual([
      { bucketStart: '2026-06-01', label: '2026-06', paidAmountKrw: 3000, failedAmountKrw: 100 },
      { bucketStart: '2026-07-01', label: '2026-07', paidAmountKrw: 500, failedAmountKrw: 0 },
    ])
  })

  it('sums across a quarter boundary correctly', () => {
    const result = rollupDailyRevenue(
      [
        { date: '2026-03-31', paidAmountKrw: 100, failedAmountKrw: 0 },
        { date: '2026-04-01', paidAmountKrw: 200, failedAmountKrw: 0 },
        { date: '2026-06-30', paidAmountKrw: 300, failedAmountKrw: 0 },
      ],
      'quarter',
    )

    expect(result).toEqual([
      { bucketStart: '2026-01-01', label: '2026 Q1', paidAmountKrw: 100, failedAmountKrw: 0 },
      { bucketStart: '2026-04-01', label: '2026 Q2', paidAmountKrw: 500, failedAmountKrw: 0 },
    ])
  })

  it('sums across a half-year boundary correctly', () => {
    const result = rollupDailyRevenue(
      [
        { date: '2026-06-30', paidAmountKrw: 100, failedAmountKrw: 0 },
        { date: '2026-07-01', paidAmountKrw: 200, failedAmountKrw: 0 },
      ],
      'half_year',
    )

    expect(result).toEqual([
      { bucketStart: '2026-01-01', label: '2026 상반기', paidAmountKrw: 100, failedAmountKrw: 0 },
      { bucketStart: '2026-07-01', label: '2026 하반기', paidAmountKrw: 200, failedAmountKrw: 0 },
    ])
  })

  it('sums across a year boundary correctly', () => {
    const result = rollupDailyRevenue(
      [
        { date: '2025-12-31', paidAmountKrw: 100, failedAmountKrw: 0 },
        { date: '2026-01-01', paidAmountKrw: 200, failedAmountKrw: 0 },
      ],
      'year',
    )

    expect(result).toEqual([
      { bucketStart: '2025-01-01', label: '2025', paidAmountKrw: 100, failedAmountKrw: 0 },
      { bucketStart: '2026-01-01', label: '2026', paidAmountKrw: 200, failedAmountKrw: 0 },
    ])
  })

  it('buckets weeks starting Monday', () => {
    const result = rollupDailyRevenue(
      [
        { date: '2026-06-15', paidAmountKrw: 100, failedAmountKrw: 0 }, // Monday
        { date: '2026-06-21', paidAmountKrw: 200, failedAmountKrw: 0 }, // Sunday, same week
        { date: '2026-06-22', paidAmountKrw: 300, failedAmountKrw: 0 }, // Monday, next week
      ],
      'week',
    )

    expect(result).toEqual([
      { bucketStart: '2026-06-15', label: '2026-06-15 주', paidAmountKrw: 300, failedAmountKrw: 0 },
      { bucketStart: '2026-06-22', label: '2026-06-22 주', paidAmountKrw: 300, failedAmountKrw: 0 },
    ])
  })
})
