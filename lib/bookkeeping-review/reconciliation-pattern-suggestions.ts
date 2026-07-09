import { labelForBookkeepingAccountCategory } from '@/lib/bookkeeping/account-categories'
import type { BookkeepingReviewQueueRow } from './summary'
import type { ReconciliationPatternSuggestion } from './reconciliation-display-model'

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

    const priorConfirmedRows = rows.filter((candidate) => {
      if (candidate.id === row.id) return false
      if (candidate.status !== 'confirmed' || !candidate.finalAccount) return false
      if (candidate.finalAccount === 'unclassified') return false
      if (normalizePatternText(candidate.counterparty) !== counterparty) return false
      if (row.direction !== 'unknown' && candidate.direction !== 'unknown' && candidate.direction !== row.direction) return false
      return isBeforeTarget(candidate.transactionDate, row.transactionDate)
    })
    const dominant = pickDominantAccount(priorConfirmedRows)
    if (!dominant) continue

    const label = labelForBookkeepingAccountCategory(dominant.account)
    suggestions.set(row.id, {
      suggestedAccount: dominant.account,
      suggestedEvidenceSource: null,
      suggestedExclusionReason: null,
      confidence: dominant.count >= 2 ? 'high' : 'medium',
      basisLabel: `최근 같은 거래처 ${dominant.count}건을 ${label}로 확정`,
      matchedCount: dominant.count,
      lastSeenPeriod: latestPeriod(priorConfirmedRows),
      reason: 'same_counterparty_prior_account',
    })
  }

  return suggestions
}
