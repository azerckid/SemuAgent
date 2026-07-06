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
 * Slice 1a — A01 서식·JC-013 가이드 정합성 검증. PII·바이너리 레코드는 범위 밖.
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

  if (
    input.confirmedIncomeTaxKrw !== input.guideIncomeTaxKrw
    || input.confirmedGrossPayKrw !== input.guideGrossPayKrw
    || input.confirmedEmployeeCount !== input.guideEmployeeCount
  ) {
    issues.push(
      issue(
        'W-V-04',
        'error',
        'JC-013 입력 가이드 값과 A01 집계가 일치하지 않습니다. 급여·지방소득세 집계를 다시 확인하세요.',
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

export function pendingSubmissionMetaIssues(): ValidationIssue[] {
  return [
    issue('W-V-09', 'warn', '세무서코드(3자리) — 바이너리 스펙 확정 후 파일 생성 시 입력 필요'),
    issue('W-V-09', 'warn', '담당자 연락처 — 바이너리 스펙 확정 후 파일 생성 시 입력 필요'),
  ]
}

export function pendingBinaryLayoutIssue(): ValidationIssue {
  return issue(
    'W-V-06',
    'warn',
    '바이너리 전자신고 레이아웃 미입수 — 파일 다운로드는 전자신고 이용안내·변환프로그램 번들 확정 후 가능',
  )
}
