import type { ReviewMaterialAttributionDecision } from '@/lib/reviews/review-workspace-types'
import type { ReviewAttributionFilterSpecV1 } from '@/lib/reviews/attribution-saved-prompt-filter-schema'

export type AttributionSavedPromptFilterRow = {
  id: string
  fileLabel: string | null
  sourceLabel: string
  evidenceDate: string | null
  attributedPeriod: string | null
  periodRelation: 'requested' | 'prior' | 'future' | 'unknown'
  amountKrw: number | null
  counterparty: string | null
  description: string | null
  duplicateStatus: 'none' | 'possible_duplicate'
  recommendation: ReviewMaterialAttributionDecision
  staffDecision: ReviewMaterialAttributionDecision | null
}

export type AttributionSavedPromptFilterResult = {
  rows: AttributionSavedPromptFilterRow[]
  summary: {
    totalRows: number
    matchedRows: number
    amountSumKrw: number
    needsReviewRows: number
  }
}

function containsAny(haystack: string | null | undefined, needles: string[]) {
  if (!haystack || needles.length === 0) return false
  const normalized = haystack.toLowerCase()
  return needles.some((needle) => normalized.includes(needle.toLowerCase()))
}

function matchesSpec(row: AttributionSavedPromptFilterRow, spec: ReviewAttributionFilterSpecV1) {
  if (spec.amountKrw?.min !== undefined) {
    if (row.amountKrw === null || row.amountKrw < spec.amountKrw.min) return false
  }
  if (spec.amountKrw?.max !== undefined) {
    if (row.amountKrw === null || row.amountKrw > spec.amountKrw.max) return false
  }
  if (spec.periodRelationIn && !spec.periodRelationIn.includes(row.periodRelation)) return false
  if (spec.attributedPeriodIn && (!row.attributedPeriod || !spec.attributedPeriodIn.includes(row.attributedPeriod))) {
    return false
  }
  if (spec.counterpartyContains && !containsAny(row.counterparty, spec.counterpartyContains)) return false
  if (spec.descriptionContains && !containsAny(row.description, spec.descriptionContains)) return false
  if (spec.textContains) {
    const textMatched =
      containsAny(row.counterparty, spec.textContains) ||
      containsAny(row.description, spec.textContains) ||
      containsAny(row.sourceLabel, spec.textContains) ||
      containsAny(row.fileLabel, spec.textContains)
    if (!textMatched) return false
  }
  if (spec.duplicateStatusIn && !spec.duplicateStatusIn.includes(row.duplicateStatus)) return false
  if (spec.aiRecommendationIn && !spec.aiRecommendationIn.includes(row.recommendation)) return false
  if (spec.staffDecisionIn) {
    const staffMatches = spec.staffDecisionIn.some((decision) => {
      if (decision === 'undecided') return row.staffDecision === null
      return row.staffDecision === decision
    })
    if (!staffMatches) return false
  }
  return true
}

function compareRows(
  left: AttributionSavedPromptFilterRow,
  right: AttributionSavedPromptFilterRow,
  field: NonNullable<ReviewAttributionFilterSpecV1['sort']>['field'],
  direction: NonNullable<ReviewAttributionFilterSpecV1['sort']>['direction'],
) {
  const factor = direction === 'asc' ? 1 : -1
  if (field === 'amountKrw') {
    const leftValue = left.amountKrw ?? Number.NEGATIVE_INFINITY
    const rightValue = right.amountKrw ?? Number.NEGATIVE_INFINITY
    return (leftValue - rightValue) * factor
  }
  if (field === 'evidenceDate') {
    return (left.evidenceDate ?? '').localeCompare(right.evidenceDate ?? '') * factor
  }
  return (left.attributedPeriod ?? '').localeCompare(right.attributedPeriod ?? '') * factor
}

export function applyReviewAttributionFilterSpec(
  rows: AttributionSavedPromptFilterRow[],
  spec: ReviewAttributionFilterSpecV1,
): AttributionSavedPromptFilterResult {
  let matched = rows.filter((row) => matchesSpec(row, spec))

  if (spec.sort) {
    matched = [...matched].sort((left, right) => compareRows(left, right, spec.sort!.field, spec.sort!.direction))
  } else {
    matched = [...matched].sort((left, right) => {
      const amountCompare = (right.amountKrw ?? 0) - (left.amountKrw ?? 0)
      if (amountCompare !== 0) return amountCompare
      return (left.attributedPeriod ?? '').localeCompare(right.attributedPeriod ?? '')
    })
  }

  if (spec.limit !== undefined) {
    matched = matched.slice(0, spec.limit)
  }

  const amountSumKrw = matched.reduce((sum, row) => sum + (row.amountKrw ?? 0), 0)
  const needsReviewRows = matched.filter((row) => row.staffDecision === null).length

  return {
    rows: matched,
    summary: {
      totalRows: rows.length,
      matchedRows: matched.length,
      amountSumKrw,
      needsReviewRows,
    },
  }
}
