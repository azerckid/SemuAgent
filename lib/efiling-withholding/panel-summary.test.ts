import { describe, expect, it } from 'vitest'
import { buildWithholdingEfilingSummary } from './panel-summary'
import type { ValidateWithholdingPanelInput } from './types'

function panelInput(over: Partial<ValidateWithholdingPanelInput> = {}): ValidateWithholdingPanelInput {
  return {
    payrollPeriodKey: '2026-06',
    paymentDate: '2026-06-25',
    closeStatus: 'closed',
    periodEmployeeCount: 12,
    periodGrossPayKrw: 42_600_000,
    confirmedEmployeeCount: 12,
    confirmedGrossPayKrw: 42_600_000,
    confirmedIncomeTaxKrw: 1_910_000,
    localIncomeTaxKrw: 191_000,
    guideEmployeeCount: 12,
    guideGrossPayKrw: 42_600_000,
    guideIncomeTaxKrw: 1_910_000,
    businessRegistrationNumber: '1234567890',
    businessName: 'Sample Co',
    representativeName: 'Kim Rep',
    lines: [],
    ...over,
  }
}

describe('buildWithholdingEfilingSummary', () => {
  it('exposes A01 aggregate fields and reference local income tax total (Path 1b)', () => {
    const summary = buildWithholdingEfilingSummary({
      panelInput: panelInput(),
      business: {
        businessRegistrationNumber: '1234567890',
        businessName: 'Sample Co',
        representativeName: 'Kim Rep',
        maskedBusinessRegistrationNumber: '123-**-*****',
      },
    })

    expect(summary.a01).toEqual({
      employeeCount: 12,
      grossPayKrw: 42_600_000,
      incomeTaxKrw: 1_910_000,
    })
    expect(summary.localIncomeTaxKrw).toBe(191_000)
    expect(summary.downloadAvailable).toBe(false)
    expect(summary.binaryLayoutReady).toBe(false)
    expect(summary.payrollLabel).toBe('2026년 6월 귀속')
    expect(summary.paymentPeriodKey).toBe('2026-06')
    expect(summary.paymentLabel).toBe('2026년 6월')
    expect(summary.businessName).toBe('Sample Co')
  })

  it('uses confirmed-only aggregates for A01 (excludes needs_review) so ④⑤⑥ share one population', () => {
    const summary = buildWithholdingEfilingSummary({
      panelInput: panelInput({
        // 기간요약에는 미확정 직원 1명이 더 있어 인원·총지급액이 크다.
        periodEmployeeCount: 12,
        periodGrossPayKrw: 42_600_000,
        // 확정분은 미확정 직원을 제외한 11명 기준.
        confirmedEmployeeCount: 11,
        confirmedGrossPayKrw: 40_600_000,
        confirmedIncomeTaxKrw: 1_800_000,
        lines: [
          { employeeKey: 'e1', employeeName: '김대표', grossPayKrw: 2_000_000, incomeTaxKrw: 110_000, status: 'needs_review' },
        ],
      }),
      business: {
        businessRegistrationNumber: '1234567890',
        businessName: 'Sample Co',
        representativeName: 'Kim Rep',
        maskedBusinessRegistrationNumber: null,
      },
    })

    // ④⑤⑥이 모두 확정 기준(11명 / 40,600,000 / 1,800,000)으로 일치해야 한다.
    expect(summary.a01).toEqual({
      employeeCount: 11,
      grossPayKrw: 40_600_000,
      incomeTaxKrw: 1_800_000,
    })
    // 기간요약(12명 / 42,600,000)이 그대로 새어 나오면 안 된다.
    expect(summary.a01.employeeCount).not.toBe(12)
    expect(summary.a01.grossPayKrw).not.toBe(42_600_000)
  })

  it('requires confirmation instead of assuming a payment month when payment date is missing', () => {
    const summary = buildWithholdingEfilingSummary({
      panelInput: panelInput({ paymentDate: null }),
      business: {
        businessRegistrationNumber: '1234567890',
        businessName: 'Sample Co',
        representativeName: 'Kim Rep',
        maskedBusinessRegistrationNumber: null,
      },
    })

    expect(summary.paymentPeriodKey).toBeNull()
    expect(summary.paymentLabel).toBe('급여 지급일 확인 필요')
  })

  it('marks blocking when payroll is not closed', () => {
    const summary = buildWithholdingEfilingSummary({
      panelInput: panelInput({ closeStatus: 'open' }),
      business: {
        businessRegistrationNumber: '1234567890',
        businessName: 'Sample Co',
        representativeName: 'Kim Rep',
        maskedBusinessRegistrationNumber: null,
      },
    })

    expect(summary.hasBlockingDataIssues).toBe(true)
  })
})
