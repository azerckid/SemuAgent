import { describe, expect, it } from 'vitest'
import { getReviewSummaryDescription } from './review-shell-copy'

describe('getReviewSummaryDescription', () => {
  it('uses customer period and email line when provided', () => {
    expect(getReviewSummaryDescription(
      { source: 'customer_upload' },
      '2026-06 · 수신 client@example.com',
    )).toBe('2026-06 · 수신 client@example.com')
  })

  it('uses staff-direct copy without customer submission language', () => {
    expect(getReviewSummaryDescription({ source: 'staff_direct' }, null)).toBe(
      '업로드한 테스트 자료를 요청자료 기준에 맞춰 정리합니다.',
    )
  })

  it('uses customer fallback copy when no session description exists', () => {
    expect(getReviewSummaryDescription({ source: 'customer_upload' }, null)).toBe(
      '고객이 제출한 자료를 요청자료 기준에 맞춰 정리합니다.',
    )
  })
})
