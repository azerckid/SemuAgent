import type { FilingTone } from '@/lib/filing-support/summary'
import { digitsOnly, formatPayrollPeriodLabel } from './format'
import type { ValidateWithholdingPanelInput, ValidationIssue, WithholdingFormA01 } from './types'
import { hasBlockingIssues } from './validate'
import { validateWithholdingPanel } from './validate-panel'

export type EfilingPanelTone = FilingTone

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
  paymentPeriodKey: string | null
  paymentLabel: string
  a01: WithholdingFormA01
  stats: {
    confirmedCount: number
    attentionCount: number
    totalLines: number
  }
  validationItems: EfilingValidationDisplayItem[]
  hasBlockingDataIssues: boolean
  businessRegistrationMasked: string | null
  businessName: string
  representativeName: string | null
  downloadAvailable: false
  binaryLayoutReady: false
  // 참고용(A01 서식 밖) — 원천세 특별징수분 지방소득세.
  localIncomeTaxKrw: number
}

function paymentPeriodKeyOf(paymentDate: string | null): string | null {
  if (!paymentDate) return null
  const matched = /^(\d{4})-(\d{2})/.exec(paymentDate)
  return matched ? `${matched[1]}-${matched[2]}` : null
}

function formatMonthLabel(periodKey: string): string {
  const [year, month] = periodKey.split('-')
  if (!year || !month) return periodKey
  return `${year}년 ${Number(month)}월`
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
  const paymentPeriodKey = paymentPeriodKeyOf(panelInput.paymentDate)

  return {
    payrollPeriodKey: panelInput.payrollPeriodKey,
    payrollLabel: formatPayrollPeriodLabel(panelInput.payrollPeriodKey),
    paymentPeriodKey,
    paymentLabel: paymentPeriodKey ? formatMonthLabel(paymentPeriodKey) : '급여 지급일 확인 필요',
    // A01 ④⑤⑥은 모두 확정 라인(needs_review 제외) 기준으로 통일한다.
    // 미확정 직원은 A01 집계에서 빠지므로(W-V-02), 인원·총지급액·소득세가 같은
    // 모집단이어야 그대로 홈택스에 입력해도 서로 어긋나지 않는다. 기간요약과의
    // 차이는 W-V-02/W-V-03 경고로 사용자에게 별도 고지된다.
    a01: {
      employeeCount: panelInput.confirmedEmployeeCount,
      grossPayKrw: panelInput.confirmedGrossPayKrw,
      incomeTaxKrw: panelInput.confirmedIncomeTaxKrw,
    },
    stats: {
      confirmedCount: panelInput.confirmedEmployeeCount,
      attentionCount,
      totalLines: panelInput.lines.length,
    },
    validationItems,
    hasBlockingDataIssues: hasBlockingIssues(dataIssues),
    businessRegistrationMasked: business.maskedBusinessRegistrationNumber,
    businessName: business.businessName,
    representativeName: business.representativeName,
    downloadAvailable: false,
    binaryLayoutReady: false,
    localIncomeTaxKrw: panelInput.localIncomeTaxKrw,
  }
}
