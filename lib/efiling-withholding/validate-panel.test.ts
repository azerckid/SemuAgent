import { describe, expect, it } from 'vitest'
import {
  pendingBinaryLayoutIssue,
  validateWithholdingPanel,
} from './validate-panel'
import type { ValidateWithholdingPanelInput, WithholdingPayrollLine } from './types'

function baseInput(over: Partial<ValidateWithholdingPanelInput> = {}): ValidateWithholdingPanelInput {
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
    businessRegistrationNumber: '123-45-67890',
    businessName: 'Sample Co',
    representativeName: 'Kim Rep',
    lines: [],
    ...over,
  }
}

function line(over: Partial<WithholdingPayrollLine> = {}): WithholdingPayrollLine {
  return {
    employeeKey: 'code:E-001',
    employeeName: 'Kim Rep',
    grossPayKrw: 3_550_000,
    incomeTaxKrw: 159_000,
    status: 'ready',
    ...over,
  }
}

describe('validateWithholdingPanel', () => {
  it('flags unclosed payroll period (W-V-01)', () => {
    const issues = validateWithholdingPanel(baseInput({ closeStatus: 'open' }))
    expect(issues.some((i) => i.ruleId === 'W-V-01')).toBe(true)
  })

  it('flags needs_review employee lines (W-V-02)', () => {
    const issues = validateWithholdingPanel(baseInput({
      lines: [line({ status: 'needs_review', employeeName: 'Lee' })],
      confirmedEmployeeCount: 11,
      periodEmployeeCount: 12,
    }))
    expect(issues.some((i) => i.ruleId === 'W-V-02' && i.employeeKey === 'code:E-001')).toBe(true)
  })

  it('flags period vs confirmed mismatch (W-V-03)', () => {
    const issues = validateWithholdingPanel(baseInput({
      confirmedGrossPayKrw: 40_000_000,
    }))
    expect(issues.some((i) => i.ruleId === 'W-V-03')).toBe(true)
  })

  it('does not raise W-V-04 when guide matches period summary and confirmed income tax', () => {
    const issues = validateWithholdingPanel(baseInput({
      lines: [line({ status: 'needs_review' })],
      confirmedEmployeeCount: 11,
      confirmedGrossPayKrw: 39_050_000,
    }))
    expect(issues.some((i) => i.ruleId === 'W-V-04')).toBe(false)
    expect(issues.some((i) => i.ruleId === 'W-V-02')).toBe(true)
    expect(issues.some((i) => i.ruleId === 'W-V-03')).toBe(true)
  })

  it('flags JC-013 guide income tax mismatch (W-V-04)', () => {
    const issues = validateWithholdingPanel(baseInput({
      confirmedIncomeTaxKrw: 1_800_000,
      guideIncomeTaxKrw: 1_910_000,
    }))
    expect(issues.some((i) => i.ruleId === 'W-V-04')).toBe(true)
  })

  it('passes when A01 matches JC-013 guide values', () => {
    const issues = validateWithholdingPanel(baseInput({ lines: [line()] }))
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0)
  })
})

describe('pendingBinaryLayoutIssue', () => {
  it('returns warn severity for missing binary spec', () => {
    const issue = pendingBinaryLayoutIssue()
    expect(issue.severity).toBe('warn')
    expect(issue.ruleId).toBe('W-V-06')
  })
})
