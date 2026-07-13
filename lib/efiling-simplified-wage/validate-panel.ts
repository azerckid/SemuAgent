import { digitsOnly } from './format'
import type { BuildSimplifiedWageInput, ValidationIssue } from './types'

function issue(
  ruleId: ValidationIssue['ruleId'],
  severity: ValidationIssue['severity'],
  message: string,
  employeeKey?: string,
): ValidationIssue {
  return { ruleId, severity, message, employeeKey }
}

/**
 * Path 1b panel — direct-entry data readiness without PII (V-08) or submission metadata.
 * Never includes residentId values in messages.
 */
export function validateDataReadiness(input: BuildSimplifiedWageInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const regDigits = digitsOnly(input.businessRegistrationNumber)
  if (regDigits.length !== 10) {
    issues.push(issue('V-09', 'error', '사업자등록번호(10자리)가 필요합니다.'))
  }

  if (!input.businessName.trim()) {
    issues.push(issue('V-09', 'error', '상호가 필요합니다.'))
  }

  if (!input.representativeName.trim()) {
    issues.push(issue('V-09', 'error', '대표자명이 필요합니다.'))
  }

  for (const month of input.missingPayrollMonths ?? []) {
    issues.push(issue('V-10', 'error', `반기 급여 자료 누락: ${month}`))
  }

  const readyEmployees = input.employees.filter((e) => e.simplifiedStatus === 'ready')

  if (readyEmployees.length === 0 && input.employees.length > 0) {
    issues.push(issue('V-07', 'error', '홈택스 직접작성에 옮길 준비 완료 직원이 없습니다.'))
  }

  for (const emp of input.employees) {
    if (emp.simplifiedStatus !== 'ready') {
      issues.push(
        issue(
          'V-07',
          'error',
          `지급명세서 준비 미완료(${emp.simplifiedStatus})`,
          emp.employeeKey,
        ),
      )
    }

    const monthlySum = Object.values(emp.monthlyGrossPayKrw).reduce((a, b) => a + b, 0)
    if (monthlySum !== emp.grossPayKrw) {
      issues.push(
        issue(
          'V-11',
          'error',
          `월별 급여 합계(${monthlySum})와 반기 총급여(${emp.grossPayKrw})가 일치하지 않습니다.`,
          emp.employeeKey,
        ),
      )
    }

    if (emp.workPeriodStart > emp.workPeriodEnd) {
      issues.push(issue('V-06', 'error', '근무시작일이 종료일보다 늦습니다.', emp.employeeKey))
    }
  }

  return issues
}

export function pendingSubmissionMetaIssues(): ValidationIssue[] {
  return [
    issue('V-09', 'warn', '세무서코드(3자리) 입력이 필요합니다.'),
    issue('V-09', 'warn', '담당자 성명·연락처 입력이 필요합니다.'),
  ]
}

export function pendingPiiIssue(readyEmployeeCount: number): ValidationIssue | null {
  if (readyEmployeeCount <= 0) return null
  return issue(
    'V-08',
    'warn',
    `준비 완료 ${readyEmployeeCount}명 — 소득자 식별정보 입력이 필요합니다.`,
  )
}
