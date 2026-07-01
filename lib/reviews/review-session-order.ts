import type { ReviewSession } from './review-workspace-types'

export function sortReviewSessions(sessions: ReviewSession[]) {
  return [...sessions].sort((a, b) => {
    const createdAtDelta = b.createdAt.localeCompare(a.createdAt)
    if (createdAtDelta !== 0) return createdAtDelta

    const periodDelta = b.accountingPeriod.localeCompare(a.accountingPeriod)
    if (periodDelta !== 0) return periodDelta

    return a.clientName.localeCompare(b.clientName, 'ko')
  })
}
