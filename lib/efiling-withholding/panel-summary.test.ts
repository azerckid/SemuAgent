import { describe, expect, it } from 'vitest'
import { buildWithholdingEfilingSummary } from './panel-summary'
import type { ValidateWithholdingPanelInput } from './types'

function panelInput(over: Partial<ValidateWithholdingPanelInput> = {}): ValidateWithholdingPanelInput {
  return {
    payrollPeriodKey: '2026-06',
    closeStatus: 'closed',
    periodEmployeeCount: 12,
    periodGrossPayKrw: 42_600_000,
    confirmedEmployeeCount: 12,
    confirmedGrossPayKrw: 42_600_000,
    confirmedIncomeTaxKrw: 1_910_000,
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
  it('exposes A01 aggregate fields and disables download (Slice 1a)', () => {
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
    expect(summary.downloadAvailable).toBe(false)
    expect(summary.binaryLayoutReady).toBe(false)
    expect(summary.payrollLabel).toBe('2026년 6월 귀속')
  })

  it('includes binary layout gap in format checks', () => {
    const summary = buildWithholdingEfilingSummary({
      panelInput: panelInput(),
      business: {
        businessRegistrationNumber: '1234567890',
        businessName: 'Sample Co',
        representativeName: 'Kim Rep',
        maskedBusinessRegistrationNumber: null,
      },
    })

    expect(summary.formatChecks.some((c) => c.id === 'layout' && c.tone === 'warn')).toBe(true)
    expect(summary.validationItems.some((i) => i.ruleId === 'W-V-06')).toBe(true)
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
