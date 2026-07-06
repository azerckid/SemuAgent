import type { PaymentStatementTone } from '@/lib/payment-statements/summary'
import type { PaymentStatementSummary, ReportingContext } from '@/lib/payment-statements/summary'
import { buildFileName, digitsOnly } from './format'
import type { BuildSimplifiedWageInput, SubmitterKind, ValidationIssue } from './types'
import { hasBlockingIssues } from './validate'
import { pendingPiiIssue, pendingSubmissionMetaIssues, validateDataReadiness } from './validate-panel'

export type EfilingPanelTone = PaymentStatementTone

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

export type SimplifiedWageEfilingSummary = {
  context: ReportingContext
  stats: {
    readyCount: number
    attentionCount: number
    piiInputCount: number
    totalEmployees: number
  }
  readyEmployees: Array<{ employeeKey: string; employeeName: string }>
  activeStep: 1
  formatChecks: EfilingFormatCheck[]
  validationItems: EfilingValidationDisplayItem[]
  hasBlockingDataIssues: boolean
  fileNamePreview: string | null
  businessRegistrationMasked: string | null
  submitterKind: SubmitterKind | null
  downloadAvailable: false
}

export type EfilingBusinessContext = {
  businessRegistrationNumber: string | null
  businessName: string
  representativeName: string | null
  submitterKind: SubmitterKind | null
  maskedBusinessRegistrationNumber: string | null
}

function issueToDisplay(
  issue: ValidationIssue,
  employeeNameByKey: Map<string, string>,
): EfilingValidationDisplayItem {
  const tone: EfilingPanelTone =
    issue.severity === 'error' ? 'danger' : 'warn'

  return {
    id: `${issue.ruleId}:${issue.employeeKey ?? 'global'}:${issue.message}`,
    tone,
    message: issue.message,
    employeeName: issue.employeeKey ? employeeNameByKey.get(issue.employeeKey) : undefined,
    ruleId: issue.ruleId,
  }
}

function simplifiedStatusMessage(status: string): string {
  switch (status) {
    case 'needs_review':
      return '급여 미확정'
    case 'missing_months':
      return '월 급여 누락'
    case 'profile_incomplete':
      return '인적사항 확인 필요'
    default:
      return '준비 미완료'
  }
}

export function buildSimplifiedWageEfilingSummary(params: {
  paymentSummary: PaymentStatementSummary
  business: EfilingBusinessContext
  employees: BuildSimplifiedWageInput['employees']
  missingPayrollMonths: string[]
  submittedOn: string
}): SimplifiedWageEfilingSummary {
  const { paymentSummary, business, employees, missingPayrollMonths: missingMonths, submittedOn } = params
  const { context, simplified } = paymentSummary

  const readyCount = simplified.filter((r) => r.status === 'ready').length
  const attentionCount = simplified.length - readyCount
  const piiInputCount = readyCount

  const employeeNameByKey = new Map(simplified.map((r) => [r.employeeKey, r.employeeName]))

  const draftInput: BuildSimplifiedWageInput = {
    year: context.year,
    half: context.half,
    submittedOn,
    taxOfficeCode: '',
    submitterKind: business.submitterKind ?? 'individual',
    businessRegistrationNumber: business.businessRegistrationNumber ?? '',
    businessName: business.businessName,
    representativeName: business.representativeName ?? '',
    obligorRegistrationId: '',
    contactDepartment: '',
    contactName: '',
    contactPhone: '',
    employees,
    missingPayrollMonths: missingMonths,
  }

  const dataIssues = validateDataReadiness(draftInput)
  const metaIssues = pendingSubmissionMetaIssues()
  const piiIssue = pendingPiiIssue(readyCount)

  const validationItems: EfilingValidationDisplayItem[] = []

  for (const row of simplified) {
    if (row.status !== 'ready') {
      validationItems.push({
        id: `row:${row.employeeKey}`,
        tone: row.tone === 'danger' ? 'danger' : 'warn',
        message: `${simplifiedStatusMessage(row.status)}`,
        employeeName: row.employeeName,
        ruleId: 'V-07',
      })
    }
  }

  for (const issue of dataIssues) {
    if (issue.ruleId === 'V-07' && issue.employeeKey) continue
    validationItems.push(issueToDisplay(issue, employeeNameByKey))
  }

  if (piiIssue) {
    validationItems.push(issueToDisplay(piiIssue, employeeNameByKey))
  }

  for (const issue of metaIssues) {
    validationItems.push(issueToDisplay(issue, employeeNameByKey))
  }

  const regDigits = business.businessRegistrationNumber ? digitsOnly(business.businessRegistrationNumber) : ''
  const structuralOk =
    regDigits.length === 10 &&
    business.businessName.trim().length > 0 &&
    (business.representativeName?.trim().length ?? 0) > 0

  if (structuralOk) {
    validationItems.push({
      id: 'structural:reg-period',
      tone: 'ok',
      message: '사업자등록번호·귀속기간 형식 — 문제 없음',
    })
  }

  const formatChecks: EfilingFormatCheck[] = [
    { id: 'target', label: '대상 세목: 근로소득 간이지급명세서 (반기)', tone: 'ok' },
    {
      id: 'period',
      label: `귀속기간: ${context.halfRangeLabel} · 제출 주기 반기`,
      tone: 'ok',
    },
    { id: 'layout', label: '공식 레이아웃 입수 경로 확정 (홈택스 자료실)', tone: 'ok' },
    { id: 'mapping', label: '필드 매핑·Pre-Code Brief 확정', tone: 'ok' },
    {
      id: 'conformance',
      label: '적합성 검정 전 — 「국세청 검증 완료」 표시 금지',
      tone: 'muted',
    },
  ]

  const fileNamePreview =
    regDigits.length === 10 ? buildFileName(business.businessRegistrationNumber!) : null

  return {
    context,
    stats: {
      readyCount,
      attentionCount,
      piiInputCount,
      totalEmployees: simplified.length,
    },
    readyEmployees: simplified
      .filter((r) => r.status === 'ready')
      .map((r) => ({ employeeKey: r.employeeKey, employeeName: r.employeeName })),
    activeStep: 1,
    formatChecks,
    validationItems,
    hasBlockingDataIssues: hasBlockingIssues(dataIssues) || attentionCount > 0,
    fileNamePreview,
    businessRegistrationMasked: business.maskedBusinessRegistrationNumber,
    submitterKind: business.submitterKind,
    downloadAvailable: false,
  }
}
