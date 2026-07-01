import { describe, expect, it } from 'vitest'
import { getPayrollAdaptiveStructuringEligibility } from './adaptive-structuring-eligibility'

function baseParams() {
  return {
    hasFiles: true,
    hasPasswordBlockedFile: false,
    batchStatus: 'failed' as const,
    batchErrorMessage: null,
    passCount: 0,
    failCount: 0,
  }
}

describe('getPayrollAdaptiveStructuringEligibility', () => {
  it('is not eligible when there are no files', () => {
    const result = getPayrollAdaptiveStructuringEligibility({ ...baseParams(), hasFiles: false })
    expect(result).toEqual({ eligible: false, reason: '구조화 후보 없음' })
  })

  it('is not eligible when a file is password blocked', () => {
    const result = getPayrollAdaptiveStructuringEligibility({ ...baseParams(), hasPasswordBlockedFile: true })
    expect(result).toEqual({ eligible: false, reason: '파일 확인 필요' })
  })

  it('is not eligible when no batch exists yet', () => {
    const result = getPayrollAdaptiveStructuringEligibility({ ...baseParams(), batchStatus: null })
    expect(result).toEqual({ eligible: false, reason: '구조화 후보 없음' })
  })

  it('is not eligible while the batch is pending or running', () => {
    expect(getPayrollAdaptiveStructuringEligibility({ ...baseParams(), batchStatus: 'pending' }))
      .toEqual({ eligible: false, reason: '검토 완료 후 가능' })
    expect(getPayrollAdaptiveStructuringEligibility({ ...baseParams(), batchStatus: 'running' }))
      .toEqual({ eligible: false, reason: '검토 완료 후 가능' })
  })

  it('is not eligible when the known extractor fully succeeded (no fail rows)', () => {
    const result = getPayrollAdaptiveStructuringEligibility({
      ...baseParams(),
      batchStatus: 'completed',
      passCount: 5,
      failCount: 0,
    })
    expect(result).toEqual({ eligible: false, reason: '기존 구조화 로직으로 처리됨' })
  })

  it('is not eligible when extraction produced rows that still need fixing', () => {
    const result = getPayrollAdaptiveStructuringEligibility({
      ...baseParams(),
      batchStatus: 'completed',
      passCount: 3,
      failCount: 2,
    })
    expect(result).toEqual({
      eligible: false,
      reason: '추출은 되었지만 row 보완 대상입니다. 구조화 제안 대상은 추출 실패·미인식 양식입니다.',
    })
  })

  it('is not eligible when extraction produced only fail rows', () => {
    const result = getPayrollAdaptiveStructuringEligibility({
      ...baseParams(),
      batchStatus: 'needs_review',
      passCount: 0,
      failCount: 4,
    })
    expect(result).toEqual({
      eligible: false,
      reason: '추출은 되었지만 row 보완 대상입니다. 구조화 제안 대상은 추출 실패·미인식 양식입니다.',
    })
  })

  it('is not eligible when the batch failed with only policy or metadata content', () => {
    const result = getPayrollAdaptiveStructuringEligibility({
      ...baseParams(),
      batchErrorMessage: '사내 규정 감지: 이 워크북은 회사 안내문으로 보입니다.',
    })
    expect(result).toEqual({ eligible: false, reason: '사내 규정/메타정보만 감지되어 구조화 제안 대상이 아닙니다.' })
  })

  it('is eligible when the batch failed because the payroll material was not recognized', () => {
    const result = getPayrollAdaptiveStructuringEligibility({
      ...baseParams(),
      batchErrorMessage: '급여 지급 항목이 없습니다. 워크북 형식을 확인해 주세요.',
    })
    expect(result).toEqual({
      eligible: true,
      reason: '급여 지급 데이터로 보이나 기존 추출기가 인식하지 못했습니다.',
    })
  })

  it('is not eligible when the batch failed due to a period mismatch, even though the message mentions payroll data', () => {
    const result = getPayrollAdaptiveStructuringEligibility({
      ...baseParams(),
      batchErrorMessage: [
        '추출 불가: 요청 급여 기간(2026-05)에 해당하는 직원별 급여 지급 데이터가 확인되지 않았습니다.',
        '해당 기간의 급여 지급대장 또는 급여명세서 자료를 다시 업로드해 주세요.',
      ].join('\n'),
    })
    expect(result).toEqual({
      eligible: false,
      reason: '요청 기간에 해당하는 데이터가 없어 발생한 오류로 보입니다. 구조화 제안 대상이 아닙니다.',
    })
  })

  it('is not eligible when the period-mismatch summary line appears in the catch-path display message', () => {
    const result = getPayrollAdaptiveStructuringEligibility({
      ...baseParams(),
      batchErrorMessage: '요청 급여 기간(2026-05)에 맞는 직원 급여 지급 데이터가 원자료에서 확인되지 않았습니다.',
    })
    expect(result).toEqual({
      eligible: false,
      reason: '요청 기간에 해당하는 데이터가 없어 발생한 오류로 보입니다. 구조화 제안 대상이 아닙니다.',
    })
  })

  it('is not eligible when the failure reason is unrecognized', () => {
    const result = getPayrollAdaptiveStructuringEligibility({
      ...baseParams(),
      batchErrorMessage: '알 수 없는 오류가 발생했습니다.',
    })
    expect(result).toEqual({ eligible: false, reason: '구조화 제안 대상인지 추가 확인이 필요합니다.' })
  })
})
