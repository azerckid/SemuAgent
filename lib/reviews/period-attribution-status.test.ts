import { describe, expect, it } from 'vitest'
import { deriveMaterialAttributionDisplayStatus } from './period-attribution-status'
import type { ReviewMaterialAttributionSummary } from './review-workspace-types'

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
    requestedInPeriod: 10,
    inCloseWindow: 0,
    outOfScope: 0,
    ...overrides,
  }
}

describe('deriveMaterialAttributionDisplayStatus', () => {
  it('labels solmate-like gap as 검토필요 with in-close-window detail', () => {
    const status = deriveMaterialAttributionDisplayStatus(mockSummary({
      total: 278,
      prior: 278,
      requestedInPeriod: 0,
      inCloseWindow: 278,
      outOfScope: 0,
      include: 200,
    }))

    expect(status.label).toBe('검토필요')
    expect(status.detail).toContain('요청 기간(2026-06) 해당 거래 없음')
    expect(status.detail).toContain('마감범위 안 278건')
    expect(status.tone).toBe('warning')
  })

  it('labels web3people-like gap as 요청기간 불일치 with out-of-scope detail', () => {
    const status = deriveMaterialAttributionDisplayStatus(mockSummary({
      total: 310,
      prior: 310,
      requestedInPeriod: 0,
      inCloseWindow: 0,
      outOfScope: 310,
    }))

    expect(status.label).toBe('요청기간 불일치')
    expect(status.detail).toContain('요청 기간(2026-06) 해당 거래 없음')
    expect(status.detail).toContain('마감범위 밖 310건')
    expect(status.tone).toBe('destructive')
  })

  it('prefers 요청기간 불일치 when both in-close and out-of-scope exist', () => {
    const status = deriveMaterialAttributionDisplayStatus(mockSummary({
      requestedInPeriod: 0,
      inCloseWindow: 5,
      outOfScope: 3,
    }))

    expect(status.label).toBe('요청기간 불일치')
    expect(status.detail).toContain('마감범위 안 5건')
    expect(status.detail).toContain('마감범위 밖 3건')
  })

  it('returns 완료 when requested period rows exist', () => {
    const status = deriveMaterialAttributionDisplayStatus(mockSummary({
      requestedInPeriod: 5,
      prior: 2,
      inCloseWindow: 2,
    }))

    expect(status.label).toBe('완료')
  })

  it('still surfaces unknown before period gap', () => {
    const status = deriveMaterialAttributionDisplayStatus(mockSummary({
      unknown: 2,
      requestedInPeriod: 0,
      outOfScope: 10,
    }))

    expect(status.label).toBe('검토필요')
    expect(status.detail).toContain('귀속월 판단 불가')
  })
})
