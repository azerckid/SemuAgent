import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

export function getReviewRequestMethodLabel(session: Pick<ReviewSession, 'source'>) {
  return session.source === 'staff_direct' ? '직접업로드' : '메일업로드'
}
