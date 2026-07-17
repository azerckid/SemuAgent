import { describe, expect, it } from 'vitest'
import {
  buildSebiseoUploadResultCardFromCounts,
  buildSebiseoUploadResultCtaHref,
  buildSebiseoUploadResultCtaLabel,
  countSebiseoUploadFileStatuses,
} from './upload-result-schema'

describe('countSebiseoUploadFileStatuses', () => {
  it('buckets known upload_file statuses', () => {
    expect(countSebiseoUploadFileStatuses([
      { status: 'matched' },
      { status: 'needs_review' },
      { status: 'analyzing' },
      { status: 'uploaded' },
      { status: 'failed' },
      { status: 'rejected' },
      { status: 'mystery' },
    ])).toEqual({
      totalCount: 6,
      okCount: 1,
      needsReviewCount: 1,
      inProgressCount: 2,
      failedCount: 1,
      excludedCount: 1,
    })
  })
})

describe('buildSebiseoUploadResultCardFromCounts', () => {
  it('builds card for half-year session with needs_review CTA', () => {
    const card = buildSebiseoUploadResultCardFromCounts({
      sessionId: 'sess-1',
      accountingPeriod: '2026-07~2026-12',
      files: [{ status: 'matched' }, { status: 'needs_review' }],
    })

    expect(card).toEqual({
      sessionId: 'sess-1',
      periodKey: '2026-H2',
      periodLabel: '2026년 하반기',
      totalCount: 2,
      okCount: 1,
      needsReviewCount: 1,
      inProgressCount: 0,
      failedCount: 0,
      excludedCount: 0,
      ctaHref: '/dashboard/direct-upload?period=2026-H2&sessionId=sess-1',
      ctaLabel: '확인 필요 1건 보기',
    })
  })

  it('uses past-year label without option list and default CTA when no needs_review', () => {
    const card = buildSebiseoUploadResultCardFromCounts({
      sessionId: 'sess-past',
      accountingPeriod: '2025-01~2025-06',
      files: [{ status: 'matched' }],
    })

    expect(card?.periodKey).toBe('2025-H1')
    expect(card?.periodLabel).toBe('2025년 상반기')
    expect(card?.ctaLabel).toBe('자료수집에서 보기')
  })

  it('hides card when period reverse fails or files empty', () => {
    expect(buildSebiseoUploadResultCardFromCounts({
      sessionId: 'sess-1',
      accountingPeriod: '2026-H1',
      files: [{ status: 'matched' }],
    })).toBeNull()

    expect(buildSebiseoUploadResultCardFromCounts({
      sessionId: 'sess-1',
      accountingPeriod: '2026-07',
      files: [],
    })).toBeNull()
  })
})

describe('CTA helpers', () => {
  it('builds href and labels', () => {
    expect(buildSebiseoUploadResultCtaHref('2026-07', 'abc')).toBe(
      '/dashboard/direct-upload?period=2026-07&sessionId=abc',
    )
    expect(buildSebiseoUploadResultCtaLabel(0)).toBe('자료수집에서 보기')
    expect(buildSebiseoUploadResultCtaLabel(3)).toBe('확인 필요 3건 보기')
  })
})
