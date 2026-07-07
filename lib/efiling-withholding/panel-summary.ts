import type { FilingTone } from '@/lib/filing-support/summary'
import { digitsOnly, formatPayrollPeriodLabel } from './format'
import type { ValidateWithholdingPanelInput, ValidationIssue, WithholdingFormA01 } from './types'
import { hasBlockingIssues } from './validate'
import { pendingBinaryLayoutIssue, pendingSubmissionMetaIssues, validateWithholdingPanel } from './validate-panel'

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
  activeStep: 1
  formatChecks: EfilingFormatCheck[]
  validationItems: EfilingValidationDisplayItem[]
  hasBlockingDataIssues: boolean
  businessRegistrationMasked: string | null
  downloadAvailable: false
  binaryLayoutReady: false
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
  const metaIssues = pendingSubmissionMetaIssues()
  const binaryIssue = pendingBinaryLayoutIssue()

  const validationItems: EfilingValidationDisplayItem[] = []

  for (const issue of dataIssues) {
    validationItems.push(issueToDisplay(issue, employeeNameByKey))
  }

  for (const issue of metaIssues) {
    validationItems.push(issueToDisplay(issue, employeeNameByKey))
  }

  validationItems.push(issueToDisplay(binaryIssue, employeeNameByKey))

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
      message: 'A01 ④⑤⑥ — JC-013 신고 준비값과 일치 · 서식 집계 준비됨',
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
      label: '바이너리 레이아웃 미입수 — 전자신고 이용안내·변환프로그램 번들 필요',
      tone: 'warn',
    },
    {
      id: 'conformance',
      label: '적합성 검정 전 — 「국세청 검증 완료」 표시 금지',
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
    activeStep: 1,
    formatChecks,
    validationItems,
    hasBlockingDataIssues: hasBlockingIssues(dataIssues),
    businessRegistrationMasked: business.maskedBusinessRegistrationNumber,
    downloadAvailable: false,
    binaryLayoutReady: false,
  }
}
