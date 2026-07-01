export type BookkeepingPeriodType = 'monthly' | 'quarterly' | 'yearly'

export type BookkeepingPeriodRange = {
  type: BookkeepingPeriodType
  start: string
  end: string
  label: string
}

export type BookkeepingPeriodRangeSnapshot = {
  bookkeepingPeriodType: BookkeepingPeriodType | null
  bookkeepingPeriodStart: string | null
  bookkeepingPeriodEnd: string | null
}

export const emptyBookkeepingPeriodRangeSnapshot: BookkeepingPeriodRangeSnapshot = {
  bookkeepingPeriodType: null,
  bookkeepingPeriodStart: null,
  bookkeepingPeriodEnd: null,
}

type ResolveRangeParams = {
  accountingPeriod: string
  periodType?: BookkeepingPeriodType | null
  periodStart?: string | null
  periodEnd?: string | null
}

function formatMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function normalizeBookkeepingMonth(value: string | null | undefined) {
  if (!value) return null
  const match = value.trim().match(/^(20\d{2})[-.\s년]*(\d{1,2})(?:\s*월)?$/)
  if (!match) return null

  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return formatMonth(Number(match[1]), month)
}

function parseQuarter(value: string) {
  const normalized = value.trim().toUpperCase()
  const match = normalized.match(/^(20\d{2})[-.\s]*Q([1-4])$/) ??
    normalized.match(/^(20\d{2})[-.\s]*([1-4])\s*분기$/)
  if (!match) return null

  const quarter = Number(match[2])
  const year = Number(match[1])
  const startMonth = ((quarter - 1) * 3) + 1
  return {
    type: 'quarterly' as const,
    start: formatMonth(year, startMonth),
    end: formatMonth(year, startMonth + 2),
    label: `${year}-Q${quarter}`,
  }
}

function parseYear(value: string) {
  const match = value.trim().match(/^(20\d{2})(?:\s*년)?$/)
  if (!match) return null
  const year = Number(match[1])
  return {
    type: 'yearly' as const,
    start: formatMonth(year, 1),
    end: formatMonth(year, 12),
    label: String(year),
  }
}

function quarterFromMonth(monthValue: string) {
  const [yearText, monthText] = monthValue.split('-')
  const month = Number(monthText)
  const quarter = Math.floor((month - 1) / 3) + 1
  const startMonth = ((quarter - 1) * 3) + 1
  return {
    type: 'quarterly' as const,
    start: formatMonth(Number(yearText), startMonth),
    end: formatMonth(Number(yearText), startMonth + 2),
    label: `${yearText}-Q${quarter}`,
  }
}

function yearFromMonth(monthValue: string) {
  const year = monthValue.slice(0, 4)
  return {
    type: 'yearly' as const,
    start: `${year}-01`,
    end: `${year}-12`,
    label: year,
  }
}

function rangeFromExplicitMonths(params: ResolveRangeParams) {
  const start = normalizeBookkeepingMonth(params.periodStart)
  const end = normalizeBookkeepingMonth(params.periodEnd)
  if (!start || !end || start > end) return null

  return {
    type: params.periodType ?? 'monthly',
    start,
    end,
    label: start === end ? start : `${start}~${end}`,
  }
}

function monthIndex(monthValue: string) {
  const [yearText, monthText] = monthValue.split('-')
  return (Number(yearText) * 12) + Number(monthText)
}

function inferTypeFromExplicitRange(start: string, end: string): BookkeepingPeriodType | null {
  const monthCount = monthIndex(end) - monthIndex(start) + 1
  if (monthCount === 1) return 'monthly'
  if (monthCount === 3 && ['01', '04', '07', '10'].includes(start.slice(5, 7))) return 'quarterly'
  if (monthCount === 12 && start.endsWith('-01') && end.endsWith('-12')) return 'yearly'
  return null
}

export function resolveBookkeepingPeriodRange(params: ResolveRangeParams): BookkeepingPeriodRange | null {
  if (params.periodStart || params.periodEnd) return rangeFromExplicitMonths(params)

  const periodType = params.periodType ?? 'monthly'
  const month = normalizeBookkeepingMonth(params.accountingPeriod)

  if (periodType === 'monthly') {
    if (!month) return null
    return { type: 'monthly', start: month, end: month, label: month }
  }

  if (periodType === 'quarterly') {
    return parseQuarter(params.accountingPeriod) ?? (month ? quarterFromMonth(month) : null)
  }

  if (periodType === 'yearly') {
    return parseYear(params.accountingPeriod) ?? (month ? yearFromMonth(month) : null)
  }

  return null
}

export function inferBookkeepingPeriodRange(accountingPeriod: string): BookkeepingPeriodRange | null {
  const [startText, endText] = accountingPeriod.split('~').map((value) => value.trim())
  if (startText && endText) {
    const start = normalizeBookkeepingMonth(startText)
    const end = normalizeBookkeepingMonth(endText)
    if (!start || !end || start > end) return null
    const type = inferTypeFromExplicitRange(start, end)
    if (!type) return null
    return { type, start, end, label: start === end ? start : `${start}~${end}` }
  }

  return resolveBookkeepingPeriodRange({ accountingPeriod, periodType: 'monthly' }) ??
    resolveBookkeepingPeriodRange({ accountingPeriod, periodType: 'quarterly' }) ??
    resolveBookkeepingPeriodRange({ accountingPeriod, periodType: 'yearly' })
}

export function buildBookkeepingPeriodRangeSnapshot(params: {
  accountingPeriod: string
  periodType?: BookkeepingPeriodType | null
}): BookkeepingPeriodRangeSnapshot {
  const range = params.periodType
    ? resolveBookkeepingPeriodRange({
      accountingPeriod: params.accountingPeriod,
      periodType: params.periodType,
    })
    : inferBookkeepingPeriodRange(params.accountingPeriod)
  return {
    bookkeepingPeriodType: range?.type ?? null,
    bookkeepingPeriodStart: range?.start ?? null,
    bookkeepingPeriodEnd: range?.end ?? null,
  }
}

export function resolveBookkeepingPeriodRangeSnapshot(params: {
  accountingPeriod: string
  bookkeepingPeriodType?: BookkeepingPeriodType | null
  bookkeepingPeriodStart?: string | null
  bookkeepingPeriodEnd?: string | null
}): BookkeepingPeriodRange | null {
  if (params.bookkeepingPeriodStart || params.bookkeepingPeriodEnd) {
    return resolveBookkeepingPeriodRange({
      accountingPeriod: params.accountingPeriod,
      periodType: params.bookkeepingPeriodType ?? 'monthly',
      periodStart: params.bookkeepingPeriodStart,
      periodEnd: params.bookkeepingPeriodEnd,
    })
  }

  if (params.bookkeepingPeriodType) {
    return resolveBookkeepingPeriodRange({
      accountingPeriod: params.accountingPeriod,
      periodType: params.bookkeepingPeriodType,
    })
  }

  return resolveBookkeepingPeriodRange({
    accountingPeriod: params.accountingPeriod,
    periodType: 'monthly',
  })
}

export function periodFromAttributionValue(params: {
  attributedPeriod?: string | null
  evidenceDate?: string | null
}) {
  return normalizeBookkeepingMonth(params.attributedPeriod) ?? params.evidenceDate?.slice(0, 7) ?? null
}

export function isBookkeepingPeriodInRange(period: string | null | undefined, range: BookkeepingPeriodRange) {
  const normalized = normalizeBookkeepingMonth(period)
  return Boolean(normalized && normalized >= range.start && normalized <= range.end)
}

export function formatBookkeepingPeriodRange(range: BookkeepingPeriodRange) {
  return range.start === range.end ? range.start : `${range.start}~${range.end}`
}
