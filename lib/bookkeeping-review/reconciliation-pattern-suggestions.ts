import { labelForBookkeepingAccountCategory } from '@/lib/bookkeeping/account-categories'
import { evidenceSourceLabel, exclusionReasonLabel } from './reconciliation-row-actions'
import type { BookkeepingReviewQueueRow, BookkeepingSourceType } from './summary'
import type { ReconciliationExclusionReason, ReconciliationPatternSuggestion, ReconciliationSource } from './reconciliation-display-model'

export const PATTERN_REJECTION_PREFIX = '패턴 거부: '

export function formatPatternRejectionMemo(basisLabel: string): string {
  return `${PATTERN_REJECTION_PREFIX}${basisLabel.trim()}`
}

export function isPatternRejectionMemo(memo: string | null | undefined): boolean {
  return memo?.includes(PATTERN_REJECTION_PREFIX) ?? false
}

function normalizePatternText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '').toLowerCase()
}

function isBeforeTarget(candidateDate: string | null, targetDate: string | null): boolean {
  if (!candidateDate || !targetDate) return true
  return candidateDate.slice(0, 10) < targetDate.slice(0, 10)
}

function latestPeriod(rows: BookkeepingReviewQueueRow[]): string | null {
  const latest = rows
    .map((row) => row.transactionDate?.slice(0, 7) ?? null)
    .filter((period): period is string => period !== null)
    .sort()
    .at(-1)
  return latest ?? null
}

function pickDominantAccount(rows: BookkeepingReviewQueueRow[]): { account: string; count: number } | null {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.finalAccount || row.finalAccount === 'unclassified') continue
    counts.set(row.finalAccount, (counts.get(row.finalAccount) ?? 0) + 1)
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const top = ranked[0]
  if (!top) return null
  const tied = ranked[1]?.[1] === top[1]
  if (tied) return null
  return { account: top[0], count: top[1] }
}

function pickDominantValue<T extends string>(values: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const top = ranked[0]
  if (!top) return null
  const tied = ranked[1]?.[1] === top[1]
  if (tied) return null
  return { value: top[0], count: top[1] }
}

function samePatternScope(row: BookkeepingReviewQueueRow, candidate: BookkeepingReviewQueueRow): boolean {
  if (candidate.id === row.id) return false
  if (normalizePatternText(candidate.counterparty) !== normalizePatternText(row.counterparty)) return false
  if (row.direction !== 'unknown' && candidate.direction !== 'unknown' && candidate.direction !== row.direction) return false
  return isBeforeTarget(candidate.transactionDate, row.transactionDate)
}

function linkedEvidenceSource(row: BookkeepingReviewQueueRow, allRows: BookkeepingReviewQueueRow[]): ReconciliationSource | null {
  if (!row.linkedEvidenceRowId) return null
  const linked = allRows.find((candidate) => candidate.id === row.linkedEvidenceRowId)
  if (!linked) return null
  if (linked.sourceType === 'bank' || linked.sourceType === 'other') return null
  return linked.sourceType as ReconciliationSource
}

function inferExclusionReasonFromMemo(memo: string | null): ReconciliationExclusionReason | null {
  const normalized = normalizePatternText(memo)
  if (!normalized) return null
  if (normalized.includes('개인') || normalized.includes('사적')) return 'personal_private'
  if (normalized.includes('업무무관')) return 'business_unrelated'
  if (normalized.includes('중복')) return 'duplicate_evidence'
  if (normalized.includes('기간')) return 'wrong_period'
  if (normalized.includes('참고')) return 'reference_only'
  if (normalized.includes('불공제')) return 'non_deductible_vat'
  if (normalized.includes('내부이체')) return 'internal_transfer'
  if (normalized.includes('환불') || normalized.includes('취소')) return 'refund_or_cancellation'
  return 'unsupported_needs_review'
}

function buildAccountPatternSuggestion(
  row: BookkeepingReviewQueueRow,
  rows: BookkeepingReviewQueueRow[],
): ReconciliationPatternSuggestion | null {
  if (row.status === 'confirmed' || row.status === 'excluded') return null
  if (row.finalAccount) return null

  const priorConfirmedRows = rows.filter((candidate) => {
    if (!samePatternScope(row, candidate)) return false
    if (candidate.status !== 'confirmed' || !candidate.finalAccount) return false
    return candidate.finalAccount !== 'unclassified'
  })
  const dominant = pickDominantAccount(priorConfirmedRows)
  if (!dominant) return null

  const label = labelForBookkeepingAccountCategory(dominant.account)
  return {
    suggestedAccount: dominant.account,
    suggestedEvidenceSource: null,
    suggestedExclusionReason: null,
    confidence: dominant.count >= 2 ? 'high' : 'medium',
    basisLabel: `최근 같은 거래처 ${dominant.count}건을 ${label}로 확정`,
    matchedCount: dominant.count,
    lastSeenPeriod: latestPeriod(priorConfirmedRows),
    reason: 'same_counterparty_prior_account',
  }
}

function buildEvidencePatternSuggestion(
  row: BookkeepingReviewQueueRow,
  rows: BookkeepingReviewQueueRow[],
): ReconciliationPatternSuggestion | null {
  if (row.status === 'confirmed' || row.status === 'excluded') return null
  if (row.sourceType !== 'bank' || row.linkedEvidenceRowId) return null

  const priorLinkedRows = rows.filter((candidate) => {
    if (!samePatternScope(row, candidate)) return false
    return candidate.sourceType === 'bank' && linkedEvidenceSource(candidate, rows) !== null
  })
  const dominant = pickDominantValue(
    priorLinkedRows
      .map((candidate) => linkedEvidenceSource(candidate, rows))
      .filter((source): source is Exclude<BookkeepingSourceType, 'bank' | 'other'> => source !== null && source !== 'bank' && source !== 'other'),
  )
  if (!dominant) return null

  return {
    suggestedAccount: null,
    suggestedEvidenceSource: dominant.value,
    suggestedExclusionReason: null,
    confidence: dominant.count >= 2 ? 'high' : 'medium',
    basisLabel: `최근 같은 거래처 ${dominant.count}건을 ${evidenceSourceLabel(dominant.value)} 증빙으로 연결`,
    matchedCount: dominant.count,
    lastSeenPeriod: latestPeriod(priorLinkedRows),
    reason: 'same_counterparty_prior_evidence',
  }
}

function buildExclusionPatternSuggestion(
  row: BookkeepingReviewQueueRow,
  rows: BookkeepingReviewQueueRow[],
): ReconciliationPatternSuggestion | null {
  if (row.status === 'confirmed' || row.status === 'excluded') return null
  if (row.linkedEvidenceRowId) return null

  const priorExcludedRows = rows.filter((candidate) => {
    if (!samePatternScope(row, candidate)) return false
    return candidate.status === 'excluded'
  })
  const dominant = pickDominantValue(
    priorExcludedRows
      .map((candidate) => inferExclusionReasonFromMemo(candidate.staffMemo))
      .filter((reason): reason is ReconciliationExclusionReason => reason !== null),
  )
  if (!dominant) return null

  return {
    suggestedAccount: null,
    suggestedEvidenceSource: null,
    suggestedExclusionReason: dominant.value,
    confidence: dominant.count >= 2 ? 'high' : 'medium',
    basisLabel: `최근 같은 거래처 ${dominant.count}건을 ${exclusionReasonLabel(dominant.value)} 제외 사유로 처리`,
    matchedCount: dominant.count,
    lastSeenPeriod: latestPeriod(priorExcludedRows),
    reason: 'prior_exclusion_pattern',
  }
}

function mergeSuggestions(
  account: ReconciliationPatternSuggestion | null,
  evidence: ReconciliationPatternSuggestion | null,
  exclusion: ReconciliationPatternSuggestion | null,
): ReconciliationPatternSuggestion | null {
  const base = exclusion ?? evidence ?? account
  if (!base) return null

  return {
    ...base,
    suggestedAccount: account?.suggestedAccount ?? base.suggestedAccount,
    suggestedEvidenceSource: evidence?.suggestedEvidenceSource ?? base.suggestedEvidenceSource,
    suggestedExclusionReason: exclusion?.suggestedExclusionReason ?? base.suggestedExclusionReason,
  }
}

export function buildReconciliationPatternSuggestions(
  rows: BookkeepingReviewQueueRow[],
): Map<string, ReconciliationPatternSuggestion> {
  const suggestions = new Map<string, ReconciliationPatternSuggestion>()

  for (const row of rows) {
    if (isPatternRejectionMemo(row.staffMemo)) continue
    const counterparty = normalizePatternText(row.counterparty)
    if (!counterparty) continue

    const suggestion = mergeSuggestions(
      buildAccountPatternSuggestion(row, rows),
      buildEvidencePatternSuggestion(row, rows),
      buildExclusionPatternSuggestion(row, rows),
    )
    if (suggestion) suggestions.set(row.id, suggestion)
  }

  return suggestions
}

export function buildAccountPatternSuggestions(
  rows: BookkeepingReviewQueueRow[],
): Map<string, ReconciliationPatternSuggestion> {
  const suggestions = new Map<string, ReconciliationPatternSuggestion>()

  for (const row of rows) {
    if (row.status === 'confirmed' || row.status === 'excluded') continue
    if (row.finalAccount) continue
    if (isPatternRejectionMemo(row.staffMemo)) continue

    const counterparty = normalizePatternText(row.counterparty)
    if (!counterparty) continue

    const suggestion = buildAccountPatternSuggestion(row, rows)
    if (suggestion) suggestions.set(row.id, suggestion)
  }

  return suggestions
}
