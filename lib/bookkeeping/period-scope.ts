import { isBookkeepingPeriodInRange, normalizeBookkeepingMonth } from './period-range'

export type ClosePeriodRange = {
  start: string
  end: string
}

export type PeriodScopeRelation = 'requested' | 'prior' | 'future' | 'unknown'

export function parseClosePeriodRange(closePeriod: string): ClosePeriodRange | null {
  const trimmed = closePeriod.trim()
  if (!trimmed) return null

  if (trimmed.includes('~')) {
    const [startRaw, endRaw] = trimmed.split('~')
    const start = normalizeBookkeepingMonth(startRaw ?? '')
    const end = normalizeBookkeepingMonth(endRaw ?? '')
    if (!start || !end || start > end) return null
    return { start, end }
  }

  const single = normalizeBookkeepingMonth(trimmed)
  if (!single) return null
  return { start: single, end: single }
}

export function isOutOfCloseScope(params: {
  attributedPeriod: string | null
  periodRelation: PeriodScopeRelation
  closePeriod: string
}): boolean {
  if (params.periodRelation === 'requested' || params.periodRelation === 'unknown') {
    return false
  }

  const attributed = normalizeBookkeepingMonth(params.attributedPeriod)
  if (!attributed) return false

  const range = parseClosePeriodRange(params.closePeriod)
  if (!range) return false

  return !isBookkeepingPeriodInRange(attributed, {
    type: 'monthly',
    start: range.start,
    end: range.end,
    label: `${range.start}~${range.end}`,
  })
}
