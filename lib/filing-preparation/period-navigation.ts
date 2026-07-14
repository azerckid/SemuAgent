export type FilingPeriodGranularity = 'month' | 'half_year' | 'year'

type ParsedPeriod = {
  ordinal: number
  format: (ordinal: number) => string
}

type BuildPeriodNavigationParams = {
  pathname: string
  periodKey: string
  latestPeriodKey: string
  granularity: FilingPeriodGranularity
}

export type PeriodNavigationHrefs = {
  previousHref?: string
  nextHref?: string
}

export function buildPeriodNavigationHrefs({
  pathname,
  periodKey,
  latestPeriodKey,
  granularity,
}: BuildPeriodNavigationParams): PeriodNavigationHrefs {
  const selected = parsePeriod(periodKey, granularity)
  const latest = parsePeriod(latestPeriodKey, granularity)
  if (!selected || !latest) return {}

  return {
    previousHref: periodHref(pathname, selected.format(selected.ordinal - 1)),
    nextHref: selected.ordinal < latest.ordinal
      ? periodHref(pathname, selected.format(selected.ordinal + 1))
      : undefined,
  }
}

function parsePeriod(periodKey: string, granularity: FilingPeriodGranularity): ParsedPeriod | null {
  if (granularity === 'month') {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey)
    if (!match) return null
    const ordinal = Number(match[1]) * 12 + Number(match[2]) - 1
    return {
      ordinal,
      format: (value) => {
        const year = Math.floor(value / 12)
        const month = ((value % 12) + 12) % 12 + 1
        return `${year}-${String(month).padStart(2, '0')}`
      },
    }
  }

  if (granularity === 'half_year') {
    const match = /^(\d{4})-H([12])$/.exec(periodKey)
    if (!match) return null
    const ordinal = Number(match[1]) * 2 + Number(match[2]) - 1
    return {
      ordinal,
      format: (value) => {
        const year = Math.floor(value / 2)
        const half = ((value % 2) + 2) % 2 + 1
        return `${year}-H${half}`
      },
    }
  }

  const match = /^(\d{4})$/.exec(periodKey)
  if (!match) return null
  return {
    ordinal: Number(match[1]),
    format: (value) => String(value),
  }
}

function periodHref(pathname: string, periodKey: string) {
  const separator = pathname.includes('?') ? '&' : '?'
  return `${pathname}${separator}period=${encodeURIComponent(periodKey)}`
}
