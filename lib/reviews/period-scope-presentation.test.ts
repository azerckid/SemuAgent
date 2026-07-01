import { describe, expect, it } from 'vitest'
import {
  buildRequestedPeriodGapMessageLines,
  buildRequestedPeriodPromptBlockMessage,
  shouldCreatePeriodGapMissingRequestDraft,
} from './period-scope-presentation'
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
    prior: 10,
    future: 0,
    unknown: 0,
    possibleDuplicate: 0,
    requestedInPeriod: 0,
    inCloseWindow: 10,
    outOfScope: 0,
    inCloseWindowPeriods: ['2026-04', '2026-05'],
    outOfScopePeriods: [],
    ...overrides,
  }
}

describe('shouldCreatePeriodGapMissingRequestDraft', () => {
  it('requires uploaded files', () => {
    expect(shouldCreatePeriodGapMissingRequestDraft(mockSummary(), 0)).toBe(false)
    expect(shouldCreatePeriodGapMissingRequestDraft(mockSummary(), 3)).toBe(true)
  })

  it('returns false when requested period rows exist', () => {
    expect(shouldCreatePeriodGapMissingRequestDraft(mockSummary({ requestedInPeriod: 2 }), 3)).toBe(false)
  })
})

describe('buildRequestedPeriodGapMessageLines', () => {
  it('uses exact out-of-close-window wording for wrong-period uploads', () => {
    expect(buildRequestedPeriodGapMessageLines(mockSummary({
      inCloseWindow: 0,
      outOfScope: 310,
      outOfScopePeriods: ['2024-01', '2024-02', '2024-03'],
    }))).toEqual([
      '요청 기간(2026-06)에 해당하는 거래가 확인되지 않습니다.',
      '업로드된 자료는 2024년 거래로 판단되어 마감범위(2026-04~2026-06) 밖입니다.',
      '2026-06 자료를 보충 요청해 주세요.',
    ])
  })

  it('keeps in-close-window uploads distinct from wrong-period uploads', () => {
    expect(buildRequestedPeriodGapMessageLines(mockSummary())).toEqual([
      '요청 기간(2026-06)에 해당하는 거래가 확인되지 않습니다.',
      '업로드된 자료는 2026-04~2026-05 거래로 판단되며 마감범위(2026-04~2026-06) 안이지만 요청 기간(2026-06) 거래가 아닙니다.',
      '2026-06 자료를 보충 요청해 주세요.',
    ])
  })
})

describe('buildRequestedPeriodPromptBlockMessage', () => {
  it('blocks saved prompt extraction with the same requested-period gap reason', () => {
    expect(buildRequestedPeriodPromptBlockMessage(mockSummary({
      inCloseWindow: 0,
      outOfScope: 310,
      outOfScopePeriods: ['2024-01'],
    }))).toContain('업로드된 자료는 2024년 거래로 판단되어 마감범위(2026-04~2026-06) 밖입니다.')
  })
})
