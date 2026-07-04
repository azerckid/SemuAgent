import { describe, expect, it } from 'vitest'
import { resolvePayrollAttentionEmployees } from './payroll-attention-employees'

function line(employeeCode: string | null, status: 'ready' | 'needs_review' | 'closed' = 'needs_review') {
  return { employeeCode, status }
}

function profile(over: Partial<{
  employeeCode: string | null
  displayName: string
  workEmail: string | null
  notificationEnabled: boolean
  employeeStatus: 'active' | 'leave' | 'terminated'
}> = {}) {
  return {
    employeeCode: 'E-001',
    displayName: '김철수',
    workEmail: 'chulsoo@example.com',
    notificationEnabled: true,
    employeeStatus: 'active' as const,
    ...over,
  }
}

describe('resolvePayrollAttentionEmployees', () => {
  it('includes an employee with a matching needs_review line, valid email, notifications on', () => {
    const result = resolvePayrollAttentionEmployees([line('E-001')], [profile()])
    expect(result).toEqual([{ employeeCode: 'E-001', employeeName: '김철수', workEmail: 'chulsoo@example.com' }])
  })

  it('excludes ready/closed lines (only needs_review triggers a notification)', () => {
    expect(resolvePayrollAttentionEmployees([line('E-001', 'ready')], [profile()])).toEqual([])
    expect(resolvePayrollAttentionEmployees([line('E-001', 'closed')], [profile()])).toEqual([])
  })

  it('excludes when payroll line has no employeeCode (no name fallback — avoids misdirected personal email)', () => {
    const result = resolvePayrollAttentionEmployees([line(null)], [profile()])
    expect(result).toEqual([])
  })

  it('excludes when there is no matching profile (직원 명부 미매칭)', () => {
    const result = resolvePayrollAttentionEmployees([line('E-999')], [profile()])
    expect(result).toEqual([])
  })

  it('excludes when workEmail is missing or blank', () => {
    expect(resolvePayrollAttentionEmployees([line('E-001')], [profile({ workEmail: null })])).toEqual([])
    expect(resolvePayrollAttentionEmployees([line('E-001')], [profile({ workEmail: '  ' })])).toEqual([])
  })

  it('excludes when notificationEnabled is false', () => {
    const result = resolvePayrollAttentionEmployees([line('E-001')], [profile({ notificationEnabled: false })])
    expect(result).toEqual([])
  })

  it('excludes terminated employees', () => {
    const result = resolvePayrollAttentionEmployees([line('E-001')], [profile({ employeeStatus: 'terminated' })])
    expect(result).toEqual([])
  })

  it('one excluded employee does not affect another eligible employee', () => {
    const lines = [line('E-001'), line('E-002')]
    const profiles = [profile(), profile({ employeeCode: 'E-002', displayName: '이영희', notificationEnabled: false })]
    const result = resolvePayrollAttentionEmployees(lines, profiles)
    expect(result).toEqual([{ employeeCode: 'E-001', employeeName: '김철수', workEmail: 'chulsoo@example.com' }])
  })

  it('does not duplicate an employee with multiple needs_review lines in the period', () => {
    const result = resolvePayrollAttentionEmployees([line('E-001'), line('E-001')], [profile()])
    expect(result).toHaveLength(1)
  })
})
