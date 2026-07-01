import { DateTime } from '@/lib/time'

export type FiscalLedgerMonthStatus =
  | 'not_requested'
  | 'requested'
  | 'material_received'
  | 'classification_needed'
  | 'journal_needed'
  | 'journal_draft_ready'

export type LedgerMonthSignals = {
  sessionCount: number
  includedMaterialCount: number
  completedClassificationRunCount: number
  journalEntryRunCount: number
}

export function buildFiscalYearMonths(fiscalYear: number) {
  const start = DateTime.fromObject({ year: fiscalYear, month: 1, day: 1 }, { zone: 'Asia/Seoul' })
  return Array.from({ length: 12 }, (_, index) => start.plus({ months: index }).toFormat('yyyy-MM'))
}

export function deriveFiscalLedgerMonthStatus(signals: LedgerMonthSignals): FiscalLedgerMonthStatus {
  if (signals.sessionCount === 0 && signals.includedMaterialCount === 0) return 'not_requested'
  if (signals.includedMaterialCount === 0) return 'requested'
  if (signals.completedClassificationRunCount === 0) return 'classification_needed'
  if (signals.journalEntryRunCount === 0) return 'journal_needed'
  return 'journal_draft_ready'
}

export type LedgerPeriodRangeType = 'month' | 'quarter' | 'half' | 'year'

export type LedgerPeriodRange = {
  type: LedgerPeriodRangeType
  start: string // inclusive YYYY-MM
  end: string // inclusive YYYY-MM
  label: string
}

function formatLedgerMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

// 세션의 bookkeeping_period_type(monthly/quarterly/yearly)와는 별개로, ledger
// 누적 조회용 ?period= 쿼리(2026-05 / 2026-Q2 / 2026-H1 / 2026)만 해석하는
// 좁은 범위의 파서다. half를 추가하기 위해 기존 period-range.ts는 건드리지 않는다.
export function resolveLedgerPeriodRange(fiscalYear: number, period?: string | null): LedgerPeriodRange | null {
  if (!period) {
    return { type: 'year', start: formatLedgerMonth(fiscalYear, 1), end: formatLedgerMonth(fiscalYear, 12), label: String(fiscalYear) }
  }

  const trimmed = period.trim()

  const monthMatch = trimmed.match(/^(\d{4})-(\d{2})$/)
  if (monthMatch) {
    const year = Number(monthMatch[1])
    const month = Number(monthMatch[2])
    if (year !== fiscalYear || month < 1 || month > 12) return null
    const value = formatLedgerMonth(year, month)
    return { type: 'month', start: value, end: value, label: value }
  }

  const quarterMatch = trimmed.match(/^(\d{4})-Q([1-4])$/i)
  if (quarterMatch) {
    const year = Number(quarterMatch[1])
    if (year !== fiscalYear) return null
    const quarter = Number(quarterMatch[2])
    const startMonth = ((quarter - 1) * 3) + 1
    return {
      type: 'quarter',
      start: formatLedgerMonth(year, startMonth),
      end: formatLedgerMonth(year, startMonth + 2),
      label: `${year}-Q${quarter}`,
    }
  }

  const halfMatch = trimmed.match(/^(\d{4})-H([12])$/i)
  if (halfMatch) {
    const year = Number(halfMatch[1])
    if (year !== fiscalYear) return null
    const half = Number(halfMatch[2])
    const startMonth = half === 1 ? 1 : 7
    return {
      type: 'half',
      start: formatLedgerMonth(year, startMonth),
      end: formatLedgerMonth(year, startMonth + 5),
      label: `${year}-H${half}`,
    }
  }

  const yearMatch = trimmed.match(/^(\d{4})$/)
  if (yearMatch) {
    const year = Number(yearMatch[1])
    if (year !== fiscalYear) return null
    return { type: 'year', start: formatLedgerMonth(year, 1), end: formatLedgerMonth(year, 12), label: String(year) }
  }

  return null
}
