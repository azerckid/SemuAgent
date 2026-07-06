import { SIMPLIFIED_WAGE_RECORD_LENGTH } from './constants'
import { readPad9, readPadX } from './format'
import type { BuildSimplifiedWageInput, SimplifiedWageEmployeeSegment, ValidationIssue } from './types'

function issue(
  ruleId: ValidationIssue['ruleId'],
  severity: ValidationIssue['severity'],
  message: string,
  employeeKey?: string,
): ValidationIssue {
  return { ruleId, severity, message, employeeKey }
}

export function validateInputBeforeBuild(input: BuildSimplifiedWageInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!input.taxOfficeCode || !/^\d{3}$/.test(input.taxOfficeCode)) {
    issues.push(issue('V-09', 'error', '세무서코드(3자리)가 필요합니다.'))
  }

  for (const month of input.missingPayrollMonths ?? []) {
    issues.push(issue('V-10', 'error', `반기 급여 자료 누락: ${month}`))
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
    if (!emp.residentId || emp.residentId.length !== 13) {
      issues.push(issue('V-08', 'error', '소득자 주민등록번호(13자리)가 필요합니다.', emp.employeeKey))
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

export function readyEmployeeSegments(input: BuildSimplifiedWageInput): SimplifiedWageEmployeeSegment[] {
  return input.employees.filter((e) => e.simplifiedStatus === 'ready')
}

export function validateBuiltRecords(records: Buffer[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (records.length === 0) {
    issues.push(issue('V-02', 'error', '레코드가 없습니다.'))
    return issues
  }

  for (let i = 0; i < records.length; i++) {
    if (records[i].length !== SIMPLIFIED_WAGE_RECORD_LENGTH) {
      issues.push(issue('V-01', 'error', `레코드 ${i + 1} 길이가 ${records[i].length}바이트입니다.`))
    }
  }

  const aRecords = records.filter((r) => readPadX(r, 0, 1) === 'A')
  const bRecords = records.filter((r) => readPadX(r, 0, 1) === 'B')
  const cRecords = records.filter((r) => readPadX(r, 0, 1) === 'C')

  if (readPadX(records[0], 0, 1) !== 'A') {
    issues.push(issue('V-02', 'error', '첫 레코드가 A레코드가 아닙니다.'))
  }
  if (aRecords.length !== 1) {
    issues.push(issue('V-02', 'error', `A레코드는 1개여야 합니다(현재 ${aRecords.length}개).`))
  }

  if (aRecords.length === 1) {
    const a14 = readPad9(aRecords[0], 160, 5)
    if (bRecords.length !== a14) {
      issues.push(issue('V-03', 'error', `B레코드 수(${bRecords.length})가 A14(${a14})와 일치하지 않습니다.`))
    }
  }

  if (bRecords.length === 1 && cRecords.length >= 0) {
    const b = bRecords[0]
    const b11 = readPad9(b, 110, 10)
    if (b11 !== cRecords.length) {
      issues.push(issue('V-04', 'error', `B11(${b11})이 C레코드 수(${cRecords.length})와 일치하지 않습니다.`))
    }

    const sumC14 = cRecords.reduce((sum, c) => sum + readPad9(c, 106, 13), 0)
    const sumC15 = cRecords.reduce((sum, c) => sum + readPad9(c, 119, 13), 0)
    const b12 = readPad9(b, 120, 13)
    const b13 = readPad9(b, 133, 13)
    if (b12 !== sumC14) {
      issues.push(issue('V-05', 'error', `B12(${b12})가 C14 합계(${sumC14})와 일치하지 않습니다.`))
    }
    if (b13 !== sumC15) {
      issues.push(issue('V-05', 'error', `B13(${b13})가 C15 합계(${sumC15})와 일치하지 않습니다.`))
    }
  }

  for (const c of cRecords) {
    const c12 = readPadX(c, 90, 8)
    const c13 = readPadX(c, 98, 8)
    if (c12 > c13) {
      issues.push(issue('V-06', 'error', `C12(${c12}) > C13(${c13})`))
    }
    const c14 = readPad9(c, 106, 13)
    if (c14 < 0) {
      issues.push(issue('V-06', 'error', 'C14는 0 이상이어야 합니다.'))
    }
  }

  return issues
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error')
}
