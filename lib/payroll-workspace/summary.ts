import { and, asc, desc, eq } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { client, payrollEmployeeLine, payrollPeriodSummary, tenant } from '@/lib/db/schema'

export type PayrollTone = 'ok' | 'warn' | 'danger' | 'muted' | 'info'
export type PayrollCloseStatus = 'open' | 'blocked' | 'closed'
export type PayrollLineStatus = 'ready' | 'needs_review' | 'closed'
export type PayrollNoticeMatchStatus = 'matched' | 'missing_notice' | 'ambiguous' | 'unmatched'
export type PayrollDocumentStatus = 'not_generated' | 'ready' | 'generated' | 'failed'

export type PayrollPeriod = {
  key: string
  payrollMonth: string
  paymentDate: string | null
  label: string
}

export type PayrollSummaryTotals = {
  employeeCount: number
  grossPayKrw: number
  withholdingTaxKrw: number
  socialInsuranceKrw: number
  deductionTotalKrw: number
  netPayKrw: number
  issueCount: number
  closeStatus: PayrollCloseStatus
}

export type PayrollIssueAlert = {
  visible: boolean
  title: string
  description: string
  targetEmployeeLineId: string | null
}

export type PayrollRegisterRow = {
  id: string
  employeeCode: string | null
  employeeName: string
  displayName: string
  department: string | null
  jobTitle: string | null
  jobType: string | null
  baseSalaryKrw: number
  mealAllowanceKrw: number
  allowanceKrw: number
  grossPayKrw: number
  incomeTaxKrw: number
  localIncomeTaxKrw: number
  withholdingTaxKrw: number
  nationalPensionKrw: number
  healthInsuranceKrw: number
  longTermCareKrw: number
  employmentInsuranceKrw: number
  socialInsuranceKrw: number
  otherDeductionKrw: number
  deductionTotalKrw: number
  netPayKrw: number
  status: PayrollLineStatus
  issueLabel: string | null
  noticeMatchStatus: PayrollNoticeMatchStatus
}

export type PayrollDeductionBreakdownItem = {
  id:
    | 'income_tax'
    | 'local_income_tax'
    | 'national_pension'
    | 'health_insurance'
    | 'long_term_care'
    | 'employment_insurance'
  label: string
  amountKrw: number
  source: 'calculated' | 'notice' | 'manual'
  tone: PayrollTone
}

export type PayrollDocumentPreview = {
  id: 'payslip' | 'withholding_statement' | 'insurance_statement'
  title: string
  description: string
  statusLabel: string
  tone: PayrollTone
}

export type PayrollCloseAction = {
  locked: boolean
  lockReason: string | null
  canClose: boolean
}

export type PayrollWorkspaceSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: PayrollPeriod
  summary: PayrollSummaryTotals
  issueAlert: PayrollIssueAlert
  registerRows: PayrollRegisterRow[]
  deductionBreakdown: PayrollDeductionBreakdownItem[]
  documents: PayrollDocumentPreview[]
  closeAction: PayrollCloseAction
}

type PayrollPeriodSummaryInput = {
  employeeCount: number
  issueCount: number
  grossPayKrw: number
  withholdingTaxKrw: number
  socialInsuranceKrw: number
  deductionTotalKrw: number
  netPayKrw: number
  noticeImportStatus: 'missing' | 'partial' | 'matched'
  closeStatus: PayrollCloseStatus
  paymentDate: string | null
  payslipStatus: PayrollDocumentStatus
  withholdingStatementStatus: PayrollDocumentStatus
  insuranceStatementStatus: PayrollDocumentStatus
}

type PayrollEmployeeLineInput = {
  id: string
  employeeCode: string | null
  employeeName: string
  department: string | null
  jobTitle: string | null
  jobType: string | null
  baseSalaryKrw: number
  mealAllowanceKrw: number
  allowanceKrw: number
  incomeTaxKrw: number
  localIncomeTaxKrw: number
  nationalPensionKrw: number
  healthInsuranceKrw: number
  longTermCareKrw: number
  employmentInsuranceKrw: number
  otherDeductionKrw: number
  noticeMatchStatus: string
  status: string
  issueCode: string | null
  issueMessage: string | null
}

type LoadPayrollWorkspaceSummaryParams = {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
  canViewEmployeeNames?: boolean
}

const DEFAULT_TZ = 'Asia/Seoul'
const PAYROLL_PERIOD_KEY_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])$/
const EMPTY_PERIOD_SUMMARY: PayrollPeriodSummaryInput = {
  employeeCount: 0,
  issueCount: 0,
  grossPayKrw: 0,
  withholdingTaxKrw: 0,
  socialInsuranceKrw: 0,
  deductionTotalKrw: 0,
  netPayKrw: 0,
  noticeImportStatus: 'missing',
  closeStatus: 'open',
  paymentDate: null,
  payslipStatus: 'not_generated',
  withholdingStatementStatus: 'not_generated',
  insuranceStatementStatus: 'not_generated',
}

function padMonth(value: number) {
  return String(value).padStart(2, '0')
}

export function isPayrollPeriodKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && PAYROLL_PERIOD_KEY_PATTERN.test(value)
}

export function resolvePayrollPeriodKey({
  periodKey,
  latestPeriodKey,
  today,
  timezone = DEFAULT_TZ,
}: {
  periodKey?: string | null
  latestPeriodKey?: string | null
  today?: DateTime
  timezone?: string
}) {
  if (isPayrollPeriodKey(periodKey)) return periodKey
  if (isPayrollPeriodKey(latestPeriodKey)) return latestPeriodKey

  const now = today ?? DateTime.now().setZone(timezone)
  return `${now.year}-${padMonth(now.month)}`
}

export function resolvePayrollPeriod({
  periodKey,
  today,
  timezone = DEFAULT_TZ,
  paymentDate = null,
}: {
  periodKey?: string | null
  today?: DateTime
  timezone?: string
  paymentDate?: string | null
}): PayrollPeriod {
  const key = resolvePayrollPeriodKey({ periodKey, today, timezone })
  const [year, month] = key.split('-')
  const monthNumber = Number(month)
  return {
    key,
    payrollMonth: key,
    paymentDate,
    label: `${year}년 ${monthNumber}월 급여`,
  }
}

export function normalizePayrollLineStatus(value: string): PayrollLineStatus {
  if (value === 'ready' || value === 'closed') return value
  return 'needs_review'
}

export function normalizeNoticeMatchStatus(value: string): PayrollNoticeMatchStatus {
  if (value === 'matched' || value === 'ambiguous' || value === 'unmatched') return value
  return 'missing_notice'
}

export function maskEmployeeName(name: string, canViewEmployeeNames: boolean): string {
  if (canViewEmployeeNames) return name
  const trimmed = name.trim()
  if (trimmed.length <= 1) return '*'
  return `${trimmed[0]}${'*'.repeat(Math.max(1, trimmed.length - 1))}`
}

export function buildPayrollRegisterRow(
  line: PayrollEmployeeLineInput,
  canViewEmployeeNames = true,
): PayrollRegisterRow {
  const baseSalaryKrw = line.baseSalaryKrw
  const mealAllowanceKrw = line.mealAllowanceKrw
  const allowanceKrw = line.allowanceKrw
  const grossPayKrw = baseSalaryKrw + mealAllowanceKrw + allowanceKrw
  const withholdingTaxKrw = line.incomeTaxKrw + line.localIncomeTaxKrw
  const socialInsuranceKrw = (
    line.nationalPensionKrw +
    line.healthInsuranceKrw +
    line.longTermCareKrw +
    line.employmentInsuranceKrw
  )
  const deductionTotalKrw = withholdingTaxKrw + socialInsuranceKrw + line.otherDeductionKrw
  const netPayKrw = grossPayKrw - deductionTotalKrw
  const status = normalizePayrollLineStatus(line.status)

  return {
    id: line.id,
    employeeCode: line.employeeCode,
    employeeName: line.employeeName,
    displayName: maskEmployeeName(line.employeeName, canViewEmployeeNames),
    department: line.department,
    jobTitle: line.jobTitle,
    jobType: line.jobType,
    baseSalaryKrw,
    mealAllowanceKrw,
    allowanceKrw,
    grossPayKrw,
    incomeTaxKrw: line.incomeTaxKrw,
    localIncomeTaxKrw: line.localIncomeTaxKrw,
    withholdingTaxKrw,
    nationalPensionKrw: line.nationalPensionKrw,
    healthInsuranceKrw: line.healthInsuranceKrw,
    longTermCareKrw: line.longTermCareKrw,
    employmentInsuranceKrw: line.employmentInsuranceKrw,
    socialInsuranceKrw,
    otherDeductionKrw: line.otherDeductionKrw,
    deductionTotalKrw,
    netPayKrw,
    status,
    issueLabel: status === 'needs_review' ? line.issueMessage ?? line.issueCode ?? '확인 필요' : null,
    noticeMatchStatus: normalizeNoticeMatchStatus(line.noticeMatchStatus),
  }
}

export function buildPayrollSummaryTotals(
  rows: PayrollRegisterRow[],
  summary: Partial<Pick<PayrollPeriodSummaryInput, 'employeeCount' | 'issueCount' | 'closeStatus'>> = {},
): PayrollSummaryTotals {
  const closeStatus = summary.closeStatus ?? 'open'
  const totals = rows.reduce<PayrollSummaryTotals>((acc, row) => ({
    employeeCount: acc.employeeCount + 1,
    grossPayKrw: acc.grossPayKrw + row.grossPayKrw,
    withholdingTaxKrw: acc.withholdingTaxKrw + row.withholdingTaxKrw,
    socialInsuranceKrw: acc.socialInsuranceKrw + row.socialInsuranceKrw,
    deductionTotalKrw: acc.deductionTotalKrw + row.deductionTotalKrw,
    netPayKrw: acc.netPayKrw + row.netPayKrw,
    issueCount: acc.issueCount + (row.status === 'needs_review' ? 1 : 0),
    closeStatus,
  }), {
    employeeCount: 0,
    grossPayKrw: 0,
    withholdingTaxKrw: 0,
    socialInsuranceKrw: 0,
    deductionTotalKrw: 0,
    netPayKrw: 0,
    issueCount: 0,
    closeStatus,
  })

  return {
    ...totals,
    employeeCount: summary.employeeCount ?? totals.employeeCount,
    issueCount: summary.issueCount ?? totals.issueCount,
  }
}

export function buildPayrollIssueAlert(rows: PayrollRegisterRow[]): PayrollIssueAlert {
  const target = rows.find((row) => row.status === 'needs_review')
  if (!target) {
    return {
      visible: false,
      title: '확인 필요 직원이 없습니다',
      description: '급여 마감 전 확인할 직원 이슈가 없습니다.',
      targetEmployeeLineId: null,
    }
  }

  return {
    visible: true,
    title: '확인 필요 직원 1명 — 마감 전 처리하세요',
    description: `신규 입사자 '${target.displayName}'의 4대보험 취득 기준일이 없어 공제액이 임시 계산되었습니다.`,
    targetEmployeeLineId: target.id,
  }
}

function socialInsuranceSource(rows: PayrollRegisterRow[]): PayrollDeductionBreakdownItem['source'] {
  return rows.some((row) => row.noticeMatchStatus === 'matched') ? 'notice' : 'calculated'
}

export function buildPayrollDeductionBreakdown(rows: PayrollRegisterRow[]): PayrollDeductionBreakdownItem[] {
  const socialSource = socialInsuranceSource(rows)
  const total = (selector: (row: PayrollRegisterRow) => number) => rows.reduce((sum, row) => sum + selector(row), 0)
  return [
    { id: 'income_tax', label: '소득세(원천징수)', amountKrw: total((row) => row.incomeTaxKrw), source: 'calculated', tone: 'danger' },
    { id: 'local_income_tax', label: '지방소득세', amountKrw: total((row) => row.localIncomeTaxKrw), source: 'calculated', tone: 'danger' },
    { id: 'national_pension', label: '국민연금', amountKrw: total((row) => row.nationalPensionKrw), source: socialSource, tone: 'warn' },
    { id: 'health_insurance', label: '건강보험', amountKrw: total((row) => row.healthInsuranceKrw), source: socialSource, tone: 'warn' },
    { id: 'long_term_care', label: '장기요양보험', amountKrw: total((row) => row.longTermCareKrw), source: socialSource, tone: 'warn' },
    { id: 'employment_insurance', label: '고용보험', amountKrw: total((row) => row.employmentInsuranceKrw), source: socialSource, tone: 'warn' },
  ]
}

function documentStatusLabel(status: PayrollDocumentStatus) {
  switch (status) {
    case 'ready':
      return '준비됨'
    case 'generated':
      return '생성됨'
    case 'failed':
      return '오류'
    case 'not_generated':
    default:
      return '대기'
  }
}

function documentStatusTone(status: PayrollDocumentStatus): PayrollTone {
  switch (status) {
    case 'ready':
    case 'generated':
      return 'ok'
    case 'failed':
      return 'danger'
    case 'not_generated':
    default:
      return 'muted'
  }
}

export function buildPayrollDocuments(summary: Pick<
  PayrollPeriodSummaryInput,
  'employeeCount' | 'payslipStatus' | 'withholdingStatementStatus'
>): PayrollDocumentPreview[] {
  return [
    {
      id: 'payslip',
      title: `급여명세서 (직원 ${summary.employeeCount.toLocaleString('ko-KR')}명)`,
      description: '직원별 개별 명세서 일괄 생성',
      statusLabel: documentStatusLabel(summary.payslipStatus),
      tone: documentStatusTone(summary.payslipStatus),
    },
    {
      id: 'withholding_statement',
      title: '원천징수 지급명세서(신고용)',
      description: '신고지원 자료로 전달',
      statusLabel: documentStatusLabel(summary.withholdingStatementStatus),
      tone: documentStatusTone(summary.withholdingStatementStatus),
    },
  ]
}

export function buildPayrollCloseAction(summary: PayrollSummaryTotals): PayrollCloseAction {
  if (summary.closeStatus === 'closed') {
    return { locked: true, lockReason: '이미 마감된 급여입니다', canClose: false }
  }
  if (summary.issueCount > 0 || summary.closeStatus === 'blocked') {
    return {
      locked: true,
      lockReason: `확인 ${summary.issueCount || 1}건 처리 후 활성화`,
      canClose: false,
    }
  }
  return { locked: false, lockReason: null, canClose: true }
}

export async function loadPayrollWorkspaceSummary({
  tenantId,
  periodKey,
  today,
  canViewEmployeeNames = true,
}: LoadPayrollWorkspaceSummaryParams): Promise<PayrollWorkspaceSummary> {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }
  const fallbackPeriod = resolvePayrollPeriod({ periodKey, today, timezone: tenantRow.timezone })

  const businessEntityRows = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  const businessEntity = businessEntityRows[0] ?? null
  const base = { tenant: tenantRow, businessEntity }

  if (!businessEntity) {
    const summaryTotals = buildPayrollSummaryTotals([])
    return {
      ...base,
      period: fallbackPeriod,
      summary: summaryTotals,
      issueAlert: buildPayrollIssueAlert([]),
      registerRows: [],
      deductionBreakdown: buildPayrollDeductionBreakdown([]),
      documents: buildPayrollDocuments(EMPTY_PERIOD_SUMMARY),
      closeAction: buildPayrollCloseAction(summaryTotals),
    }
  }

  const latestPeriodRows = isPayrollPeriodKey(periodKey)
    ? []
    : await db
      .select({ payrollPeriod: payrollPeriodSummary.payrollPeriod })
      .from(payrollPeriodSummary)
      .where(and(
        eq(payrollPeriodSummary.tenantId, tenantId),
        eq(payrollPeriodSummary.clientId, businessEntity.id),
      ))
      .orderBy(desc(payrollPeriodSummary.payrollPeriod), desc(payrollPeriodSummary.createdAt))
      .limit(1)
  const initialPeriod = resolvePayrollPeriod({
    periodKey: resolvePayrollPeriodKey({
      periodKey,
      latestPeriodKey: latestPeriodRows[0]?.payrollPeriod ?? null,
      today,
      timezone: tenantRow.timezone,
    }),
    today,
    timezone: tenantRow.timezone,
  })

  const periodRows = await db
    .select({
      id: payrollPeriodSummary.id,
      employeeCount: payrollPeriodSummary.employeeCount,
      issueCount: payrollPeriodSummary.issueCount,
      grossPayKrw: payrollPeriodSummary.grossPayKrw,
      withholdingTaxKrw: payrollPeriodSummary.withholdingTaxKrw,
      socialInsuranceKrw: payrollPeriodSummary.socialInsuranceKrw,
      deductionTotalKrw: payrollPeriodSummary.deductionTotalKrw,
      netPayKrw: payrollPeriodSummary.netPayKrw,
      noticeImportStatus: payrollPeriodSummary.noticeImportStatus,
      closeStatus: payrollPeriodSummary.closeStatus,
      paymentDate: payrollPeriodSummary.paymentDate,
      payslipStatus: payrollPeriodSummary.payslipStatus,
      withholdingStatementStatus: payrollPeriodSummary.withholdingStatementStatus,
      insuranceStatementStatus: payrollPeriodSummary.insuranceStatementStatus,
    })
    .from(payrollPeriodSummary)
    .where(and(
      eq(payrollPeriodSummary.tenantId, tenantId),
      eq(payrollPeriodSummary.clientId, businessEntity.id),
      eq(payrollPeriodSummary.payrollPeriod, initialPeriod.key),
    ))
    .limit(1)

  const periodSummaryRow = periodRows[0] ?? null
  const period = resolvePayrollPeriod({
    periodKey: initialPeriod.key,
    today,
    timezone: tenantRow.timezone,
    paymentDate: periodSummaryRow?.paymentDate ?? null,
  })

  if (!periodSummaryRow) {
    const summaryTotals = buildPayrollSummaryTotals([])
    return {
      ...base,
      period,
      summary: summaryTotals,
      issueAlert: buildPayrollIssueAlert([]),
      registerRows: [],
      deductionBreakdown: buildPayrollDeductionBreakdown([]),
      documents: buildPayrollDocuments(EMPTY_PERIOD_SUMMARY),
      closeAction: buildPayrollCloseAction(summaryTotals),
    }
  }

  const lineRows = await db
    .select({
      id: payrollEmployeeLine.id,
      employeeCode: payrollEmployeeLine.employeeCode,
      employeeName: payrollEmployeeLine.employeeName,
      department: payrollEmployeeLine.department,
      jobTitle: payrollEmployeeLine.jobTitle,
      jobType: payrollEmployeeLine.jobType,
      baseSalaryKrw: payrollEmployeeLine.baseSalaryKrw,
      mealAllowanceKrw: payrollEmployeeLine.mealAllowanceKrw,
      allowanceKrw: payrollEmployeeLine.allowanceKrw,
      incomeTaxKrw: payrollEmployeeLine.incomeTaxKrw,
      localIncomeTaxKrw: payrollEmployeeLine.localIncomeTaxKrw,
      nationalPensionKrw: payrollEmployeeLine.nationalPensionKrw,
      healthInsuranceKrw: payrollEmployeeLine.healthInsuranceKrw,
      longTermCareKrw: payrollEmployeeLine.longTermCareKrw,
      employmentInsuranceKrw: payrollEmployeeLine.employmentInsuranceKrw,
      otherDeductionKrw: payrollEmployeeLine.otherDeductionKrw,
      noticeMatchStatus: payrollEmployeeLine.noticeMatchStatus,
      status: payrollEmployeeLine.status,
      issueCode: payrollEmployeeLine.issueCode,
      issueMessage: payrollEmployeeLine.issueMessage,
    })
    .from(payrollEmployeeLine)
    .where(and(
      eq(payrollEmployeeLine.tenantId, tenantId),
      eq(payrollEmployeeLine.clientId, businessEntity.id),
      eq(payrollEmployeeLine.periodSummaryId, periodSummaryRow.id),
    ))
    .orderBy(asc(payrollEmployeeLine.employeeCode), asc(payrollEmployeeLine.employeeName), asc(payrollEmployeeLine.id))

  const registerRows = lineRows.map((row) => buildPayrollRegisterRow(row, canViewEmployeeNames))
  const summaryTotals = buildPayrollSummaryTotals(registerRows, {
    employeeCount: periodSummaryRow.employeeCount,
    issueCount: periodSummaryRow.issueCount,
    closeStatus: periodSummaryRow.closeStatus,
  })

  return {
    ...base,
    period,
    summary: summaryTotals,
    issueAlert: buildPayrollIssueAlert(registerRows),
    registerRows,
    deductionBreakdown: buildPayrollDeductionBreakdown(registerRows),
    documents: buildPayrollDocuments(periodSummaryRow),
    closeAction: buildPayrollCloseAction(summaryTotals),
  }
}

export async function loadPayrollSidebarEmployeeCount(tenantId: string): Promise<number> {
  const { db } = await import('@/lib/db')

  const businessEntityRows = await db
    .select({ id: client.id })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  const businessEntity = businessEntityRows[0] ?? null

  if (!businessEntity) return 0

  const latestRows = await db
    .select({ employeeCount: payrollPeriodSummary.employeeCount })
    .from(payrollPeriodSummary)
    .where(and(
      eq(payrollPeriodSummary.tenantId, tenantId),
      eq(payrollPeriodSummary.clientId, businessEntity.id),
    ))
    .orderBy(desc(payrollPeriodSummary.payrollPeriod), desc(payrollPeriodSummary.createdAt))
    .limit(1)

  return latestRows[0]?.employeeCount ?? 0
}
