import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

export function getReviewSummaryDescription(
  session: Pick<ReviewSession, 'source'>,
  sessionDescription: string | null,
) {
  if (sessionDescription) return sessionDescription
  if (session.source === 'staff_direct') {
    return '업로드한 테스트 자료를 요청자료 기준에 맞춰 정리합니다.'
  }
  return '고객이 제출한 자료를 요청자료 기준에 맞춰 정리합니다.'
}
