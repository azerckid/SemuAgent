import { isOutOfCloseScope } from '@/lib/bookkeeping/period-scope'
import type {
  ReviewMaterialAttribution,
  ReviewMaterialAttributionSummary,
} from './review-workspace-types'

function isResolvedAttribution(row: ReviewMaterialAttribution) {
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(row.attributedPeriod ?? '') && row.periodRelation !== 'unknown'
}

export function buildAttributionSummary(rows: ReviewMaterialAttribution[]): ReviewMaterialAttributionSummary | null {
  const resolvedRows = rows.filter(isResolvedAttribution)
  if (resolvedRows.length === 0) return null
  const first = resolvedRows[0]
  const decisions = resolvedRows.map((row) => row.staffDecision ?? row.recommendation)

  let inCloseWindow = 0
  let outOfScope = 0
  const inCloseWindowPeriods = new Set<string>()
  const outOfScopePeriods = new Set<string>()
  for (const row of resolvedRows) {
    if (row.periodRelation !== 'prior' && row.periodRelation !== 'future') continue
    if (isOutOfCloseScope({
      attributedPeriod: row.attributedPeriod,
      periodRelation: row.periodRelation,
      closePeriod: first.closePeriod,
    })) {
      outOfScope += 1
      if (row.attributedPeriod) outOfScopePeriods.add(row.attributedPeriod)
    } else {
      inCloseWindow += 1
      if (row.attributedPeriod) inCloseWindowPeriods.add(row.attributedPeriod)
    }
  }

  return {
    requestedPeriod: first.requestedPeriod,
    closePeriod: first.closePeriod,
    total: resolvedRows.length,
    include: decisions.filter((decision) => decision === 'include').length,
    hold: decisions.filter((decision) => decision === 'hold').length,
    excludeDuplicate: decisions.filter((decision) => decision === 'exclude_duplicate').length,
    referenceOnly: decisions.filter((decision) => decision === 'reference_only').length,
    prior: resolvedRows.filter((row) => row.periodRelation === 'prior').length,
    future: resolvedRows.filter((row) => row.periodRelation === 'future').length,
    unknown: 0,
    possibleDuplicate: resolvedRows.filter((row) => row.duplicateStatus === 'possible_duplicate').length,
    requestedInPeriod: resolvedRows.filter((row) => row.periodRelation === 'requested').length,
    inCloseWindow,
    outOfScope,
    inCloseWindowPeriods: [...inCloseWindowPeriods].sort(),
    outOfScopePeriods: [...outOfScopePeriods].sort(),
  }
}
