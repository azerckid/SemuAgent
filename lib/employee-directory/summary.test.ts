import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildEmployeeDirectoryRow,
  buildEmployeeDirectoryStats,
  insuranceEnrollmentLabel,
  maskEmployeeName,
  normalizeEmployeeStatus,
  normalizeInsuranceEnrollmentStatus,
  normalizePayrollEligibility,
  sortEmployeeRows,
} from './summary'

const baseRow = {
  id: 'emp-1',
  employeeCode: 'EMP-001',
  displayName: '김대표',
  department: '경영',
  jobTitle: '대표',
  employeeStatus: 'active',
  payrollEligibility: 'eligible',
  insuranceEnrollmentStatus: 'enrolled',
  hireDate: '2019-03-02',
  terminationDate: null,
  workEmail: 'daepyo@sample.co',
  notificationEnabled: true,
}

describe('employee status normalization', () => {
  it('falls back to safe defaults for unknown values', () => {
    expect(normalizeEmployeeStatus('weird')).toBe('active')
    expect(normalizePayrollEligibility('weird')).toBe('eligible')
    expect(normalizeInsuranceEnrollmentStatus('weird')).toBe('not_checked')
    expect(insuranceEnrollmentLabel('needs_review')).toBe('확인 필요')
  })
})

describe('employee name masking', () => {
  it('masks names when the viewer cannot see them', () => {
    expect(maskEmployeeName('김대표', true)).toBe('김대표')
    expect(maskEmployeeName('김대표', false)).toBe('김**')
    expect(maskEmployeeName('김', false)).toBe('*')
  })
})

describe('employee directory stats', () => {
  it('counts active, payroll-eligible, needs-review, terminated (excluding terminated from active tallies)', () => {
    const stats = buildEmployeeDirectoryStats([
      { ...baseRow, id: '1', employeeStatus: 'active', payrollEligibility: 'eligible', insuranceEnrollmentStatus: 'enrolled' },
      { ...baseRow, id: '2', employeeStatus: 'active', payrollEligibility: 'eligible', insuranceEnrollmentStatus: 'needs_review' },
      { ...baseRow, id: '3', employeeStatus: 'leave', payrollEligibility: 'excluded', insuranceEnrollmentStatus: 'not_applicable' },
      { ...baseRow, id: '4', employeeStatus: 'terminated', payrollEligibility: 'eligible', insuranceEnrollmentStatus: 'needs_review' },
    ])
    expect(stats).toEqual({
      activeCount: 2,
      payrollEligibleCount: 2,
      needsReviewCount: 1,
      terminatedCount: 1,
    })
  })
})

describe('employee directory row', () => {
  it('derives labels, tone, and issue label; carries latest payroll period', () => {
    const row = buildEmployeeDirectoryRow(
      { ...baseRow, insuranceEnrollmentStatus: 'needs_review' },
      '2026-06',
    )
    expect(row).toMatchObject({
      employeeStatusLabel: '재직',
      employeeStatusTone: 'ok',
      payrollEligibilityLabel: '대상',
      insuranceEnrollmentLabel: '확인 필요',
      insuranceEnrollmentTone: 'warn',
      latestPayrollPeriod: '2026-06',
      issueLabel: '4대보험 확인 필요',
    })
  })

  it('does not raise an issue for terminated employees', () => {
    const row = buildEmployeeDirectoryRow(
      { ...baseRow, employeeStatus: 'terminated', insuranceEnrollmentStatus: 'needs_review' },
      null,
    )
    expect(row.issueLabel).toBeNull()
  })

  it('sorts active before leave before terminated', () => {
    const rows = sortEmployeeRows([
      buildEmployeeDirectoryRow({ ...baseRow, id: 't', employeeCode: 'C', employeeStatus: 'terminated' }, null),
      buildEmployeeDirectoryRow({ ...baseRow, id: 'a', employeeCode: 'A', employeeStatus: 'active' }, null),
      buildEmployeeDirectoryRow({ ...baseRow, id: 'l', employeeCode: 'B', employeeStatus: 'leave' }, null),
    ])
    expect(rows.map((r) => r.employeeStatus)).toEqual(['active', 'leave', 'terminated'])
  })
})

describe('read model boundaries', () => {
  const source = readFileSync(new URL('./summary.ts', import.meta.url), 'utf8')

  it('scopes queries by tenant and business entity', () => {
    expect(source).toContain('eq(employeeProfile.tenantId, tenantId)')
    expect(source).toContain('eq(employeeProfile.clientId, businessEntity.id)')
  })

  it('does not persist raw resident/account/phone numbers', () => {
    for (const banned of ['residentNumber', 'accountNumber', 'phoneNumber', 'rrn']) {
      expect(source).not.toContain(banned)
    }
  })
})
