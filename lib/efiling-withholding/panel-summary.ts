import type { FilingTone } from '@/lib/filing-support/summary'
import { digitsOnly, formatPayrollPeriodLabel } from './format'
import type { ValidateWithholdingPanelInput, ValidationIssue, WithholdingFormA01 } from './types'
import { hasBlockingIssues } from './validate'
import { validateWithholdingPanel } from './validate-panel'

export type EfilingPanelTone = FilingTone

export type EfilingFormatCheck = {
  id: string
  label: string
  tone: EfilingPanelTone | 'muted'
}

export type EfilingValidationDisplayItem = {
  id: string
  tone: EfilingPanelTone
  message: string
  employeeName?: string
  ruleId?: ValidationIssue['ruleId']
}

export type WithholdingEfilingSummary = {
  payrollPeriodKey: string
  payrollLabel: string
  a01: WithholdingFormA01
  stats: {
    confirmedCount: number
    attentionCount: number
    totalLines: number
  }
  formatChecks: EfilingFormatCheck[]
  validationItems: EfilingValidationDisplayItem[]
  hasBlockingDataIssues: boolean
  businessRegistrationMasked: string | null
  downloadAvailable: false
  binaryLayoutReady: false
  // 참고용(A01 서식 밖) — 원천세 특별징수분 지방소득세.
  localIncomeTaxKrw: number
}

export type WithholdingBusinessContext = {
  businessRegistrationNumber: string | null
  businessName: string
  representativeName: string | null
  maskedBusinessRegistrationNumber: string | null
}

function issueToDisplay(
  issue: ValidationIssue,
  employeeNameByKey: Map<string, string>,
): EfilingValidationDisplayItem {
  const tone: EfilingPanelTone = issue.severity === 'error' ? 'danger' : 'warn'

  return {
    id: `${issue.ruleId}:${issue.employeeKey ?? 'global'}:${issue.message}`,
    tone,
    message: issue.message,
    employeeName: issue.employeeKey ? employeeNameByKey.get(issue.employeeKey) : undefined,
    ruleId: issue.ruleId,
  }
}

export function buildWithholdingEfilingSummary(params: {
  panelInput: ValidateWithholdingPanelInput
  business: WithholdingBusinessContext
}): WithholdingEfilingSummary {
  const { panelInput, business } = params
  const employeeNameByKey = new Map(panelInput.lines.map((line) => [line.employeeKey, line.employeeName]))

  const dataIssues = validateWithholdingPanel(panelInput)

  const validationItems: EfilingValidationDisplayItem[] = []

  for (const issue of dataIssues) {
    validationItems.push(issueToDisplay(issue, employeeNameByKey))
  }

  const regDigits = business.businessRegistrationNumber ? digitsOnly(business.businessRegistrationNumber) : ''
  const structuralOk =
    regDigits.length === 10
    && business.businessName.trim().length > 0
    && (business.representativeName?.trim().length ?? 0) > 0
    && panelInput.closeStatus === 'closed'
    && !hasBlockingIssues(dataIssues)

  if (structuralOk) {
    validationItems.push({
      id: 'structural:a01-guide',
      tone: 'ok',
      message: 'A01 ④⑤⑥ — JC-013 신고 준비값과 일치 · 직접입력 정리 준비됨',
    })
  }

  const attentionCount = panelInput.lines.filter((line) => line.status === 'needs_review').length

  const formatChecks: EfilingFormatCheck[] = [
    { id: 'target', label: '대상 세목: 원천징수이행상황신고서 (매월 · A01 간이세액)', tone: 'ok' },
    {
      id: 'period',
      label: `귀속연월: ${formatPayrollPeriodLabel(panelInput.payrollPeriodKey)} · 신고구분 매월`,
      tone: 'ok',
    },
    { id: 'mapping', label: '서식 필드 매핑 Part A 확정 (별지 제21호 A01)', tone: 'ok' },
    {
      id: 'layout',
      label: '공식 비암호화 업로드 양식 없음 — 직접입력 정리(1b)로 제공',
      tone: 'ok',
    },
    {
      id: 'conformance',
      label: '적합성 검정 대상 아님(직접입력 정리) — 「국세청 검증 완료」 표시 금지',
      tone: 'muted',
    },
  ]

  return {
    payrollPeriodKey: panelInput.payrollPeriodKey,
    payrollLabel: formatPayrollPeriodLabel(panelInput.payrollPeriodKey),
    a01: {
      employeeCount: panelInput.periodEmployeeCount,
      grossPayKrw: panelInput.periodGrossPayKrw,
      incomeTaxKrw: panelInput.confirmedIncomeTaxKrw,
    },
    stats: {
      confirmedCount: panelInput.confirmedEmployeeCount,
      attentionCount,
      totalLines: panelInput.lines.length,
    },
    formatChecks,
    validationItems,
    hasBlockingDataIssues: hasBlockingIssues(dataIssues),
    businessRegistrationMasked: business.maskedBusinessRegistrationNumber,
    downloadAvailable: false,
    binaryLayoutReady: false,
    localIncomeTaxKrw: panelInput.localIncomeTaxKrw,
  }
}
