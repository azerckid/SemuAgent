import { describe, expect, it } from 'vitest'
import {
  normalizeSourceLabel,
  normalizeSourceLabels,
  USAGE_HELP_CANONICAL_SOURCE_LABELS,
} from '@/lib/usage-help/source-labels'

describe('normalizeSourceLabel', () => {
  it('maps legacy submission status labels to canonical form', () => {
    expect(normalizeSourceLabel('자료검토 제출 자료 현황')).toBe(
      USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
    )
    expect(normalizeSourceLabel('자료 검토 제출 자료 현황')).toBe(
      USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
    )
  })

  it('maps screen role aliases to screen labels', () => {
    expect(normalizeSourceLabel('자료 검토 화면 역할')).toBe(
      USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews,
    )
    expect(normalizeSourceLabel('진행 현황 메트릭')).toBe(
      USAGE_HELP_CANONICAL_SOURCE_LABELS.dashboard,
    )
  })
})

describe('normalizeSourceLabels', () => {
  it('deduplicates and falls back to route default', () => {
    expect(
      normalizeSourceLabels([], USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews),
    ).toEqual([USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews])
  })

  it('limits display labels to two items', () => {
    expect(
      normalizeSourceLabels([
        USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews,
        USAGE_HELP_CANONICAL_SOURCE_LABELS.sessionDetail,
        USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
      ]),
    ).toHaveLength(2)
  })
})
