import { describe, expect, it } from 'vitest'
import { buildPeriodGapMissingRequestDraft, isPeriodGapMissingRequestCriteriaSummary } from './period-gap-missing-request'
import type { ReviewMaterialAttributionSummary } from '@/lib/reviews/review-workspace-types'

function mockSummary(overrides: Partial<ReviewMaterialAttributionSummary> = {}): ReviewMaterialAttributionSummary {
  return {
    requestedPeriod: '2026-06',
    closePeriod: '2026-04~2026-06',
    total: 10,
    include: 8,
    hold: 0,
    excludeDuplicate: 0,
    referenceOnly: 2,
    prior: 0,
    future: 0,
    unknown: 0,
    possibleDuplicate: 0,
    requestedInPeriod: 0,
    inCloseWindow: 0,
    outOfScope: 0,
    inCloseWindowPeriods: [],
    outOfScopePeriods: [],
    ...overrides,
  }
}

const baseParams = {
  clientName: '솔메이트',
  contactName: '담당자',
  staffName: '춘심이',
  accountingPeriod: '2026-06',
  uploadUrl: 'https://example.com/upload/token',
  uploadBaseUrl: 'https://example.com',
}

describe('isPeriodGapMissingRequestCriteriaSummary', () => {
  it('detects period-gap draft criteria', () => {
    expect(isPeriodGapMissingRequestCriteriaSummary('요청 기간 부재 — 요청월 자료 추가 요청')).toBe(true)
    expect(isPeriodGapMissingRequestCriteriaSummary('제출자료 확인 안내 — 3개 항목')).toBe(false)
  })
})

describe('buildPeriodGapMissingRequestDraft', () => {
  it('returns null when requested period rows exist', () => {
    expect(buildPeriodGapMissingRequestDraft({
      ...baseParams,
      summary: mockSummary({ requestedInPeriod: 3 }),
    })).toBeNull()
  })

  it('builds solmate-like missing requested month copy', () => {
    const draft = buildPeriodGapMissingRequestDraft({
      ...baseParams,
      summary: mockSummary({
        total: 278,
        inCloseWindow: 278,
        prior: 278,
        inCloseWindowPeriods: ['2026-04', '2026-05'],
      }),
    })

    expect(draft?.criteriaSummary).toContain('요청월 자료 추가 요청')
    expect(draft?.bodyHtml).toContain('요청 기간(<strong>2026-06</strong>)')
    expect(draft?.bodyHtml).toContain('2026-04~2026-05 거래')
    expect(draft?.bodyHtml).toContain('2026-04~2026-06')
    expect(draft?.subject).toContain('솔메이트')
  })

  it('builds web3people-like wrong period copy', () => {
    const draft = buildPeriodGapMissingRequestDraft({
      ...baseParams,
      clientName: 'web3people',
      summary: mockSummary({
        total: 310,
        outOfScope: 310,
        prior: 310,
        outOfScopePeriods: ['2024-01', '2024-02', '2024-03'],
      }),
    })

    expect(draft?.criteriaSummary).toContain('기간 불일치')
    expect(draft?.bodyHtml).toContain('요청 기간(<strong>2026-06</strong>)에 해당하는 거래가 확인되지 않습니다.')
    expect(draft?.bodyHtml).toContain('2024년 거래')
    expect(draft?.bodyHtml).toContain('마감범위(2026-04~2026-06) 밖')
    expect(draft?.bodyHtml).toContain('2026-06 자료')
  })

  it('builds mixed variant copy', () => {
    const draft = buildPeriodGapMissingRequestDraft({
      ...baseParams,
      summary: mockSummary({
        inCloseWindow: 5,
        outOfScope: 3,
        prior: 8,
        inCloseWindowPeriods: ['2026-04'],
        outOfScopePeriods: ['2024-01'],
      }),
    })

    expect(draft?.criteriaSummary).toContain('혼재')
    expect(draft?.bodyHtml).toContain('5건')
    expect(draft?.bodyHtml).toContain('3건')
  })
})
