import type { PaymentStatementTone } from '@/lib/payment-statements/summary'
import type { PaymentStatementSummary, ReportingContext } from '@/lib/payment-statements/summary'
import type { BuildSimplifiedWageInput, SubmitterKind, ValidationIssue } from './types'
import { hasBlockingIssues } from './validate'
import { validateDataReadiness } from './validate-panel'

export type EfilingPanelTone = PaymentStatementTone

export type EfilingValidationDisplayItem = {
  id: string
  tone: EfilingPanelTone
  message: string
  employeeName?: string
  ruleId?: ValidationIssue['ruleId']
}

export type DirectEntryOverviewRow = {
  id: string
  label: string
  value: string
  note?: string
}

export type DirectEntryMonthValue = {
  period: string
  label: string
  grossPayKrw: number
}

export type DirectEntryEmployeeRow = {
  employeeKey: string
  employeeName: string
  workPeriodLabel: string
  monthlyPay: DirectEntryMonthValue[]
  grossPayKrw: number
  recognizedBonusKrw: number
}

export type SimplifiedWageEfilingSummary = {
  context: ReportingContext
  stats: {
    readyCount: number
    attentionCount: number
    periodOpenCount: number
    totalEmployees: number
  }
  validationItems: EfilingValidationDisplayItem[]
  directEntry: {
    overview: DirectEntryOverviewRow[]
    employees: DirectEntryEmployeeRow[]
  }
  hasBlockingDataIssues: boolean
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
  return {
    id: `${issue.ruleId}:${issue.employeeKey ?? 'global'}:${issue.message}`,
    tone: issue.severity === 'error' ? 'danger' : 'warn',
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

function isAttentionStatus(status: string): boolean {
  return status === 'needs_review' || status === 'missing_months' || status === 'profile_incomplete'
}

function formatYmd(value: string): string {
  if (!/^\d{8}$/.test(value)) return value
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
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

  const readyCount = simplified.filter((row) => row.status === 'ready').length
  const attentionCount = simplified.filter((row) => isAttentionStatus(row.status)).length
  const periodOpenCount = simplified.filter((row) => row.status === 'period_open').length
  const employeeNameByKey = new Map(simplified.map((row) => [row.employeeKey, row.employeeName]))

  const dataIssues = validateDataReadiness({
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
  })

  const validationItems: EfilingValidationDisplayItem[] = []
  for (const row of simplified) {
    if (isAttentionStatus(row.status)) {
      validationItems.push({
        id: `row:${row.employeeKey}`,
        tone: row.tone === 'danger' ? 'danger' : 'warn',
        message: simplifiedStatusMessage(row.status),
        employeeName: row.employeeName,
        ruleId: 'V-07',
      })
    }
  }

  for (const issue of dataIssues) {
    if (issue.ruleId === 'V-07' && issue.employeeKey) continue
    validationItems.push(issueToDisplay(issue, employeeNameByKey))
  }

  const readyEmployeeKeys = new Set(
    simplified.filter((row) => row.status === 'ready').map((row) => row.employeeKey),
  )
  const directEntryEmployees: DirectEntryEmployeeRow[] = employees
    .filter((employee) => readyEmployeeKeys.has(employee.employeeKey))
    .map((employee) => ({
      employeeKey: employee.employeeKey,
      employeeName: employee.employeeName,
      workPeriodLabel: `${formatYmd(employee.workPeriodStart)} ~ ${formatYmd(employee.workPeriodEnd)}`,
      monthlyPay: context.halfMonths.map((period) => ({
        period,
        label: `${Number(period.slice(5))}월`,
        grossPayKrw: employee.monthlyGrossPayKrw[period] ?? 0,
      })),
      grossPayKrw: employee.grossPayKrw,
      recognizedBonusKrw: employee.recognizedBonusKrw,
    }))
  const grossPayTotal = directEntryEmployees.reduce((sum, row) => sum + row.grossPayKrw, 0)

  return {
    context,
    stats: {
      readyCount,
      attentionCount,
      periodOpenCount,
      totalEmployees: simplified.length,
    },
    validationItems,
    directEntry: {
      overview: [
        { id: 'form', label: '작성 화면', value: '간이지급명세서(근로소득) 직접작성' },
        { id: 'period', label: '귀속기간', value: context.halfRangeLabel },
        { id: 'business-number', label: '사업자등록번호', value: business.maskedBusinessRegistrationNumber ?? '설정 필요' },
        { id: 'business-name', label: '상호', value: business.businessName || '설정 필요' },
        { id: 'representative-name', label: '대표자', value: business.representativeName || '설정 필요' },
        { id: 'employee-count', label: '소득자 수', value: `${directEntryEmployees.length}명`, note: '준비 완료 직원' },
        { id: 'gross-pay-total', label: '지급총액 합계', value: `${grossPayTotal.toLocaleString('ko-KR')}원` },
      ],
      employees: directEntryEmployees,
    },
    hasBlockingDataIssues: hasBlockingIssues(dataIssues) || attentionCount > 0,
  }
}
