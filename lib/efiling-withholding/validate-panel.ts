import type { ValidateWithholdingPanelInput, ValidationIssue } from './types'

function issue(
  ruleId: ValidationIssue['ruleId'],
  severity: ValidationIssue['severity'],
  message: string,
  employeeKey?: string,
): ValidationIssue {
  return { ruleId, severity, message, employeeKey }
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * A01 서식·JC-013 가이드 정합성 검증(1a/1b 공통). PII·바이너리 레코드는 범위 밖.
 */
export function validateWithholdingPanel(input: ValidateWithholdingPanelInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (input.closeStatus !== 'closed') {
    issues.push(issue('W-V-01', 'error', '급여 기간이 마감되지 않았습니다. 급여 화면에서 마감을 완료하세요.'))
  }

  for (const line of input.lines) {
    if (line.status === 'needs_review') {
      issues.push(
        issue('W-V-02', 'error', '급여 미확정 — A01 집계에서 제외됩니다.', line.employeeKey),
      )
    }
  }

  // JC-013 가이드 ④⑤ = 기간 요약, ⑥ = 확정 라인 소득세 합계
  if (
    input.periodEmployeeCount !== input.guideEmployeeCount
    || input.periodGrossPayKrw !== input.guideGrossPayKrw
    || input.confirmedIncomeTaxKrw !== input.guideIncomeTaxKrw
  ) {
    issues.push(
      issue(
        'W-V-04',
        'error',
        'JC-013 신고 준비값과 A01 집계가 일치하지 않습니다. 급여·지방소득세 집계를 다시 확인하세요.',
      ),
    )
  }

  if (input.periodGrossPayKrw !== input.confirmedGrossPayKrw) {
    issues.push(
      issue(
        'W-V-03',
        'error',
        `확정 급여 총지급액(${input.confirmedGrossPayKrw.toLocaleString('ko-KR')}원)이 기간 요약(${input.periodGrossPayKrw.toLocaleString('ko-KR')}원)과 다릅니다.`,
      ),
    )
  }

  if (input.periodEmployeeCount !== input.confirmedEmployeeCount) {
    issues.push(
      issue(
        'W-V-03',
        'error',
        `확정 인원(${input.confirmedEmployeeCount}명)이 기간 요약 인원(${input.periodEmployeeCount}명)과 다릅니다.`,
      ),
    )
  }

  const regDigits = digitsOnly(input.businessRegistrationNumber)
  if (regDigits.length !== 10) {
    issues.push(issue('W-V-05', 'error', '사업자등록번호(10자리)가 필요합니다.'))
  }

  if (!input.businessName.trim()) {
    issues.push(issue('W-V-05', 'error', '상호가 필요합니다.'))
  }

  if (!input.representativeName.trim()) {
    issues.push(issue('W-V-05', 'error', '대표자명이 필요합니다.'))
  }

  return issues
}
