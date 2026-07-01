import { DateTime } from '@/lib/time'

export type RevenueGranularity = 'day' | 'week' | 'month' | 'quarter' | 'half_year' | 'year'

export type DailyRevenueRow = {
  date: string
  paidAmountKrw: number
  failedAmountKrw: number
}

export type RevenueBucket = {
  bucketStart: string
  label: string
  paidAmountKrw: number
  failedAmountKrw: number
}

function bucketStartFor(dateStr: string, granularity: RevenueGranularity): DateTime {
  const dt = DateTime.fromISO(dateStr, { zone: 'Asia/Seoul' })
  switch (granularity) {
    case 'day':
      return dt.startOf('day')
    case 'week':
      return dt.startOf('week')
    case 'month':
      return dt.startOf('month')
    case 'quarter':
      return dt.startOf('quarter')
    case 'half_year':
      return dt.set({ month: dt.month <= 6 ? 1 : 7, day: 1 }).startOf('day')
    case 'year':
      return dt.startOf('year')
  }
}

function labelFor(bucketStart: DateTime, granularity: RevenueGranularity): string {
  switch (granularity) {
    case 'day':
      return bucketStart.toFormat('yyyy-MM-dd')
    case 'week':
      return `${bucketStart.toFormat('yyyy-MM-dd')} 주`
    case 'month':
      return bucketStart.toFormat('yyyy-MM')
    case 'quarter':
      return `${bucketStart.year} Q${bucketStart.quarter}`
    case 'half_year':
      return `${bucketStart.year} ${bucketStart.month === 1 ? '상반기' : '하반기'}`
    case 'year':
      return `${bucketStart.year}`
  }
}

/**
 * Rolls up day-granularity sums (already bounded by the date-range query)
 * into the requested period granularity. Kept as a pure function so the
 * server can fetch a small, date-bounded set of daily rows from the DB and
 * do the week/month/quarter/half-year/year arithmetic in JS instead of
 * relying on fragile SQLite date-bucketing functions.
 */
export function rollupDailyRevenue(rows: DailyRevenueRow[], granularity: RevenueGranularity): RevenueBucket[] {
  const buckets = new Map<string, RevenueBucket>()

  for (const row of rows) {
    const bucketStart = bucketStartFor(row.date, granularity)
    const key = bucketStart.toISODate() ?? row.date
    const existing = buckets.get(key)
    if (existing) {
      existing.paidAmountKrw += row.paidAmountKrw
      existing.failedAmountKrw += row.failedAmountKrw
    } else {
      buckets.set(key, {
        bucketStart: key,
        label: labelFor(bucketStart, granularity),
        paidAmountKrw: row.paidAmountKrw,
        failedAmountKrw: row.failedAmountKrw,
      })
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.bucketStart.localeCompare(b.bucketStart))
}
