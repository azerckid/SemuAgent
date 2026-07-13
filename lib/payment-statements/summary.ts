import { and, asc, eq, inArray } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { client, employeeProfile, payrollEmployeeLine, payrollPeriodSummary, tenant } from '@/lib/db/schema'
import { now } from '@/lib/time'

const DEFAULT_TZ = 'Asia/Seoul'

// ---------------------------------------------------------------------------
// JC-024 지급명세서·연말정산 준비 검토 read model — read-only 집계.
// 급여(payroll_*)·직원 명부(employee_profile)를 반기/연 단위로 집계한다.
// 신규 테이블/엔진/세액계산 없음. 정산액 계산·전자신고 파일 생성은 범위 밖.
// 원천징수세액 = incomeTaxKrw(근로소득세만). 지방소득세는 지방소득세 트랙.
// 인적사항 확인은 저장 필드(hireDate·명부 매칭)로만. 주민번호는 저장/검증하지 않는다.
// ---------------------------------------------------------------------------

export type PaymentStatementTone = 'ok' | 'warn' | 'danger' | 'muted'
export type SimplifiedStatus = 'ready' | 'period_open' | 'needs_review' | 'missing_months' | 'profile_incomplete'
export type YearEndStatus = 'ready' | 'period_open' | 'payroll_action_required' | 'special_case_review'
export type EmployeeStatus = 'active' | 'leave' | 'terminated'
export type ReportingPeriodStatus = 'completed' | 'open'
export type PayrollPeriodCloseStatus = 'open' | 'blocked' | 'closed'
export type YearEndReasonCode =
  | 'missing_profile'
  | 'missing_hire_date'
  | 'missing_month'
  | 'duplicate_month'
  | 'unexpected_payroll_month'
  | 'period_not_closed'
  | 'line_not_closed'
  | 'gross_mismatch'
  | 'mid_year_hire'
  | 'mid_year_termination'

export type ReportingContext = {
  year: number
  half: 1 | 2
  halfMonths: string[]
  requiredMonths: string[]
  yearMonths: string[]
  yearRequiredMonths: string[]
  halfLabel: string
  halfRangeLabel: string
  periodStatus: ReportingPeriodStatus
  yearPeriodStatus: ReportingPeriodStatus
}

// 순수 함수 입력(테스트용 평면 행)
export type PayrollLineInput = {
  employeeCode: string | null
  employeeName: string
  period: string // YYYY-MM
  grossPayKrw: number
  incomeTaxKrw: number
  status: 'ready' | 'needs_review' | 'closed'
}

export type AnnualPayrollLineInput = PayrollLineInput & {
  periodCloseStatus: PayrollPeriodCloseStatus
  baseSalaryKrw: number
  mealAllowanceKrw: number
  allowanceKrw: number
  localIncomeTaxKrw: number
  nationalPensionKrw: number
  healthInsuranceKrw: number
  longTermCareKrw: number
  employmentInsuranceKrw: number
}

export type EmployeeProfileInput = {
  employeeCode: string | null
  displayName: string
  employeeStatus: EmployeeStatus
  payrollEligibility?: 'eligible' | 'excluded'
  hireDate: string | null
  terminationDate: string | null
}

export type SimplifiedRow = {
  employeeKey: string
  employeeName: string
  employeeCode: string | null
  periodLabel: string
  grossPayKrw: number
  withholdingTaxKrw: number
  status: SimplifiedStatus
  statusLabel: string
  tone: PaymentStatementTone
}

export type YearEndRow = {
  employeeKey: string
  employeeName: string
  employeeCode: string | null
  employeeStatus: EmployeeStatus
  employeeStatusLabel: string
  workPeriodLabel: string
  workPeriodDetail: string
  annualBaseSalaryKrw: number | null
  annualAllowanceKrw: number | null
  annualMealAllowanceKrw: number | null
  annualGrossPayKrw: number | null
  annualNationalPensionKrw: number | null
  annualHealthInsuranceKrw: number | null
  annualLongTermCareKrw: number | null
  annualEmploymentInsuranceKrw: number | null
  annualWithholdingTaxKrw: number | null
  annualLocalIncomeTaxKrw: number | null
  payrollSummaryLabel: string
  hometaxCheckLabel: string
  hometaxCheckDetail: string
  reasonCodes: YearEndReasonCode[]
  issueLabels: string[]
  status: YearEndStatus
  statusLabel: string
  tone: PaymentStatementTone
}

export type YearEndSettlementHero = {
  totalEmployees: number
  readyCount: number
  payrollActionCount: number
  specialCaseCount: number
  periodOpenCount: number
}

export type PaymentStatementBlocker = {
  id: string
  title: string
  description: string
  tone: 'warn' | 'danger'
  href: string
  ctaLabel: string
}

export type PaymentStatementHero = {
  totalEmployees: number
  attentionCount: number
  readyCount: number
  periodOpenCount: number
  readinessPercent: number
}

export type PaymentStatementSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  context: ReportingContext
  hero: PaymentStatementHero
  blockers: PaymentStatementBlocker[]
  simplified: SimplifiedRow[]
  yearEnd: YearEndRow[]
}

// ---------------------------------------------------------------------------
// 순수 함수 (단위 테스트 대상)
// ---------------------------------------------------------------------------

function mm(month: number): string {
  return String(month).padStart(2, '0')
}

// periodKey가 없으면 가장 최근에 끝난 반기를 기본 선택한다. 명시적으로 진행 중인
// 반기를 열면 완료된 월까지만 필수 월로 삼아 미래 월을 누락으로 오인하지 않는다.
export function resolveReportingContext(today: DateTime, periodKey?: string | null): ReportingContext {
  const halfMatch = periodKey ? periodKey.match(/-H([12])/) : null
  const hasExplicitHalf = Boolean(periodKey && /^\d{4}/.test(periodKey) && halfMatch)
  const year = hasExplicitHalf
    ? Number(periodKey?.slice(0, 4))
    : today.month >= 7
      ? today.year
      : today.year - 1
  const half: 1 | 2 = hasExplicitHalf
    ? (Number(halfMatch?.[1]) as 1 | 2)
    : today.month >= 7
      ? 1
      : 2
  const startMonth = half === 1 ? 1 : 7
  const halfMonths = Array.from({ length: 6 }, (_, i) => `${year}-${mm(startMonth + i)}`)
  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${mm(1 + i)}`)
  const currentMonth = today.toFormat('yyyy-MM')
  const periodStatus: ReportingPeriodStatus = halfMonths[halfMonths.length - 1] < currentMonth ? 'completed' : 'open'
  const requiredMonths = periodStatus === 'completed'
    ? halfMonths
    : halfMonths.filter((month) => month < currentMonth)
  const yearPeriodStatus: ReportingPeriodStatus = year < today.year ? 'completed' : 'open'
  const yearRequiredMonths = yearPeriodStatus === 'completed'
    ? yearMonths
    : yearMonths.filter((month) => month < currentMonth)
  return {
    year,
    half,
    halfMonths,
    requiredMonths,
    yearMonths,
    yearRequiredMonths,
    halfLabel: `${year}년 ${half === 1 ? '상반기' : '하반기'}`,
    halfRangeLabel: `${halfMonths[0]} ~ ${halfMonths[halfMonths.length - 1]}`,
    periodStatus,
    yearPeriodStatus,
  }
}

// 연말정산은 반기가 아니라 완료된 연도 단위다. 기간을 명시하지 않으면 현재
// 진행 중인 연도를 준비 완료로 오인하지 않도록 직전 완료 연도를 선택한다.
export function resolveYearEndPeriodKey(today: DateTime, periodKey?: string | null): string {
  const explicitYear = periodKey?.match(/^(\d{4})/)?.[1]
  const year = explicitYear ? Number(explicitYear) : today.year - 1
  return `${year}-H2`
}

// 직원 식별 키: employeeCode 우선, 없으면 이름.
export function employeeKeyOf(row: { employeeCode: string | null; employeeName?: string; displayName?: string }): string {
  if (row.employeeCode && row.employeeCode.trim()) return `code:${row.employeeCode.trim()}`
  const name = row.employeeName ?? row.displayName ?? ''
  return `name:${name.trim()}`
}

function monthOf(dateStr: string | null): string | null {
  if (!dateStr || !/^\d{4}-\d{2}/.test(dateStr)) return null
  return dateStr.slice(0, 7)
}

// 반기 기준 해당 직원이 급여 line을 가져야 할 월(입사·퇴사 반영).
function expectedMonths(halfMonths: string[], profile?: EmployeeProfileInput): string[] {
  const hire = profile ? monthOf(profile.hireDate) : null
  const term = profile && profile.employeeStatus === 'terminated' ? monthOf(profile.terminationDate) : null
  return halfMonths.filter((m) => (!hire || m >= hire) && (!term || m <= term))
}

const SIMPLIFIED_LABEL: Record<SimplifiedStatus, { label: string; tone: PaymentStatementTone }> = {
  ready: { label: '준비 완료', tone: 'ok' },
  period_open: { label: '기간 진행 중', tone: 'muted' },
  needs_review: { label: '급여 미확정', tone: 'warn' },
  missing_months: { label: '월 급여 누락', tone: 'warn' },
  profile_incomplete: { label: '인적사항 확인', tone: 'danger' },
}

export function buildSimplifiedRow(params: {
  employeeKey: string
  employeeName: string
  employeeCode: string | null
  lines: PayrollLineInput[] // 반기 내 해당 직원 line
  halfMonths: string[]
  requiredMonths?: string[]
  periodStatus?: ReportingPeriodStatus
  profile?: EmployeeProfileInput
}): SimplifiedRow {
  const { lines, halfMonths, profile } = params
  const grossPayKrw = lines.reduce((sum, l) => sum + l.grossPayKrw, 0)
  const withholdingTaxKrw = lines.reduce((sum, l) => sum + l.incomeTaxKrw, 0)
  const monthsPresent = new Set(lines.map((l) => l.period))
  const expected = expectedMonths(params.requiredMonths ?? halfMonths, profile)
  const hasNeedsReview = lines.some((l) => l.status === 'needs_review')
  const profileIncomplete = !profile || !profile.hireDate

  // profile_incomplete를 missing_months보다 먼저 판정한다: hireDate가 없으면
  // expectedMonths()가 반기 전체를 기대값으로 잡아 신뢰할 수 없다. 그 상태에서
  // missing_months(→급여 화면)로 보내면, 실제 수정 위치(직원 명부)가 아닌 곳으로
  // 오라우팅된다.
  let status: SimplifiedStatus
  if (hasNeedsReview) status = 'needs_review'
  else if (profileIncomplete) status = 'profile_incomplete'
  else if (expected.some((m) => !monthsPresent.has(m))) status = 'missing_months'
  else if (params.periodStatus === 'open') status = 'period_open'
  else status = 'ready'

  const presentMonths = [...monthsPresent].sort()
  const periodLabel = presentMonths.length > 0
    ? `${presentMonths[0].slice(5)}~${presentMonths[presentMonths.length - 1].slice(5)}월 (${presentMonths.length}개월)`
    : '급여 없음'

  return {
    employeeKey: params.employeeKey,
    employeeName: params.employeeName,
    employeeCode: params.employeeCode,
    periodLabel,
    grossPayKrw,
    withholdingTaxKrw,
    status,
    statusLabel: SIMPLIFIED_LABEL[status].label,
    tone: SIMPLIFIED_LABEL[status].tone,
  }
}

const EMPLOYEE_STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: '재직',
  leave: '휴직',
  terminated: '중도퇴사',
}

const YEAR_END_LABEL: Record<YearEndStatus, { label: string; tone: PaymentStatementTone }> = {
  ready: { label: '급여 준비 완료', tone: 'ok' },
  period_open: { label: '연도 진행 중', tone: 'muted' },
  payroll_action_required: { label: '급여 보완', tone: 'warn' },
  special_case_review: { label: '특례 확인', tone: 'warn' },
}

function parsedDate(value: string | null | undefined): DateTime | null {
  if (!value) return null
  const parsed = DateTime.fromISO(value, { zone: DEFAULT_TZ })
  return parsed.isValid ? parsed : null
}

export function isEmployeeProfileRelevantForYear(profile: EmployeeProfileInput, year: number): boolean {
  if (profile.payrollEligibility === 'excluded') return false
  const yearStart = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: DEFAULT_TZ })
  const yearEnd = DateTime.fromObject({ year, month: 12, day: 31 }, { zone: DEFAULT_TZ })
  const hire = parsedDate(profile.hireDate)
  const termination = parsedDate(profile.terminationDate)
  if (hire && hire.toMillis() > yearEnd.toMillis()) return false
  if (termination && termination.toMillis() < yearStart.toMillis()) return false
  return true
}

function formatMonthList(months: string[]): string {
  return months.map((month) => `${Number(month.slice(5))}월`).join('·')
}

function workPeriodDisplay(params: {
  yearMonths: string[]
  requiredMonths: string[]
  periodStatus: ReportingPeriodStatus
  profile?: EmployeeProfileInput
  midYearHire: boolean
  midYearTermination: boolean
}): { label: string; detail: string } {
  const sourceMonths = params.periodStatus === 'open' ? params.requiredMonths : params.yearMonths
  const months = expectedMonths(sourceMonths, params.profile)
  if (months.length === 0) return { label: '집계 대기', detail: '완료 월 발생 전' }
  const start = Number(months[0].slice(5))
  const end = Number(months[months.length - 1].slice(5))
  const label = start === end ? `${start}월` : `${start}~${end}월`
  const notes = [
    params.midYearHire ? '중도입사' : null,
    params.midYearTermination ? '중도퇴사' : null,
  ].filter((value): value is string => Boolean(value))
  return {
    label,
    detail: `${months.length}개월${notes.length > 0 ? ` · ${notes.join('·')}` : ''}`,
  }
}

function nullableSum(
  lines: AnnualPayrollLineInput[],
  field: keyof Pick<
    AnnualPayrollLineInput,
    | 'baseSalaryKrw'
    | 'allowanceKrw'
    | 'mealAllowanceKrw'
    | 'grossPayKrw'
    | 'nationalPensionKrw'
    | 'healthInsuranceKrw'
    | 'longTermCareKrw'
    | 'employmentInsuranceKrw'
    | 'incomeTaxKrw'
    | 'localIncomeTaxKrw'
  >,
  canDisplay: boolean,
): number | null {
  return canDisplay ? lines.reduce((sum, line) => sum + line[field], 0) : null
}

export function buildYearEndRow(params: {
  employeeKey: string
  employeeName: string
  employeeCode: string | null
  lines: AnnualPayrollLineInput[] // 연간 해당 직원 line
  yearMonths?: string[]
  requiredMonths?: string[]
  periodStatus?: ReportingPeriodStatus
  profile?: EmployeeProfileInput
}): YearEndRow {
  const { profile } = params
  const employeeStatus: EmployeeStatus = profile?.employeeStatus ?? 'active'
  const requiredMonths = params.requiredMonths ?? params.yearMonths ?? params.lines.map((line) => line.period)
  const yearMonths = params.yearMonths ?? requiredMonths
  const periodStatus = params.periodStatus ?? 'completed'
  const reportingYear = Number(yearMonths[0]?.slice(0, 4) ?? requiredMonths[0]?.slice(0, 4))
  const hire = parsedDate(profile?.hireDate)
  const termination = parsedDate(profile?.terminationDate)
  const midYearHire = Boolean(hire && hire.year === reportingYear && hire.month > 1)
  const midYearTermination = Boolean(
    employeeStatus === 'terminated'
    && termination
    && termination.year === reportingYear
    && termination.month < 12,
  )
  const expected = expectedMonths(requiredMonths, profile)
  const expectedSet = new Set(expected)
  const scopedLines = params.lines.filter((line) => requiredMonths.includes(line.period))
  const linesByMonth = new Map<string, AnnualPayrollLineInput[]>()
  for (const line of scopedLines) {
    const monthLines = linesByMonth.get(line.period) ?? []
    monthLines.push(line)
    linesByMonth.set(line.period, monthLines)
  }

  const reasonCodes: YearEndReasonCode[] = []
  const issueLabels: string[] = []
  const addReason = (code: YearEndReasonCode, label: string) => {
    if (!reasonCodes.includes(code)) reasonCodes.push(code)
    if (!issueLabels.includes(label)) issueLabels.push(label)
  }

  if (!profile) addReason('missing_profile', '직원 명부 연결 필요')
  else if (!profile.hireDate) addReason('missing_hire_date', '입사일 확인 필요')

  const missingMonths = expected.filter((month) => !linesByMonth.has(month))
  if (missingMonths.length > 0) {
    addReason(
      'missing_month',
      missingMonths.length === expected.length ? '연간 확정 급여 없음' : `${formatMonthList(missingMonths)} 급여 누락`,
    )
  }

  const duplicateMonths = expected.filter((month) => (linesByMonth.get(month)?.length ?? 0) > 1)
  if (duplicateMonths.length > 0) addReason('duplicate_month', `${formatMonthList(duplicateMonths)} 급여 중복 확인`)

  const unexpectedMonths = [...linesByMonth.keys()].filter((month) => !expectedSet.has(month))
  if (unexpectedMonths.length > 0) addReason('unexpected_payroll_month', `${formatMonthList(unexpectedMonths)} 근무기간 밖 급여 확인`)

  const singleExpectedLines = expected.flatMap((month) => {
    const monthLines = linesByMonth.get(month) ?? []
    return monthLines.length === 1 ? monthLines : []
  })
  const periodNotClosed = singleExpectedLines.filter((line) => line.periodCloseStatus !== 'closed').map((line) => line.period)
  if (periodNotClosed.length > 0) addReason('period_not_closed', `${formatMonthList(periodNotClosed)} 급여 마감 필요`)

  const lineNotClosed = singleExpectedLines.filter((line) => line.status !== 'closed').map((line) => line.period)
  if (lineNotClosed.length > 0) addReason('line_not_closed', `${formatMonthList(lineNotClosed)} 직원 급여 확정 필요`)

  const grossMismatch = singleExpectedLines
    .filter((line) => line.baseSalaryKrw + line.allowanceKrw + line.mealAllowanceKrw !== line.grossPayKrw)
    .map((line) => line.period)
  if (grossMismatch.length > 0) addReason('gross_mismatch', `${formatMonthList(grossMismatch)} 급여 항목 합계 확인`)

  const payrollIssueCodes = new Set<YearEndReasonCode>([
    'missing_profile',
    'missing_hire_date',
    'missing_month',
    'duplicate_month',
    'unexpected_payroll_month',
    'period_not_closed',
    'line_not_closed',
    'gross_mismatch',
  ])
  const hasPayrollIssue = reasonCodes.some((code) => payrollIssueCodes.has(code))

  if (midYearHire) addReason('mid_year_hire', '귀속연도 중도입사')
  if (midYearTermination) addReason('mid_year_termination', '귀속연도 중도퇴사')

  let status: YearEndStatus
  if (hasPayrollIssue) status = 'payroll_action_required'
  else if (periodStatus === 'open') status = 'period_open'
  else if (midYearHire || midYearTermination) status = 'special_case_review'
  else status = 'ready'

  const canDisplayAmounts = !hasPayrollIssue && expected.length > 0 && singleExpectedLines.length === expected.length
  const workPeriod = workPeriodDisplay({
    yearMonths,
    requiredMonths,
    periodStatus,
    profile,
    midYearHire,
    midYearTermination,
  })

  let payrollSummaryLabel = '보험·기납부세액 집계 완료'
  let hometaxCheckLabel = '주민번호 · 공제신고서'
  let hometaxCheckDetail = '홈택스에서 직접 확인'
  if (status === 'payroll_action_required') {
    payrollSummaryLabel = issueLabels[0] ?? '급여 자료 보완 필요'
    hometaxCheckLabel = '급여 확정 후 확인'
    hometaxCheckDetail = '홈택스 확인 항목은 그대로 유지'
  } else if (status === 'period_open') {
    payrollSummaryLabel = expected.length > 0 ? `${expected.length}개월 확정 급여 집계` : '완료 월 발생 전'
  } else if (midYearHire && midYearTermination) {
    payrollSummaryLabel = '현 근무지 급여 집계 완료'
    hometaxCheckLabel = '종전근무지 · 중도정산'
    hometaxCheckDetail = '홈택스 최종 반영 여부 확인'
  } else if (midYearHire) {
    payrollSummaryLabel = '현 근무지 급여 집계 완료'
    hometaxCheckLabel = '종전근무지 · 공제신고서'
    hometaxCheckDetail = '전 직장 원천징수영수증 확인'
  } else if (midYearTermination) {
    payrollSummaryLabel = '퇴사월까지 집계 완료'
    hometaxCheckLabel = '중도정산 · 공제신고서'
    hometaxCheckDetail = '홈택스 최종 반영 여부 확인'
  }

  return {
    employeeKey: params.employeeKey,
    employeeName: params.employeeName,
    employeeCode: params.employeeCode,
    employeeStatus,
    employeeStatusLabel: EMPLOYEE_STATUS_LABEL[employeeStatus],
    workPeriodLabel: workPeriod.label,
    workPeriodDetail: workPeriod.detail,
    annualBaseSalaryKrw: nullableSum(singleExpectedLines, 'baseSalaryKrw', canDisplayAmounts),
    annualAllowanceKrw: nullableSum(singleExpectedLines, 'allowanceKrw', canDisplayAmounts),
    annualMealAllowanceKrw: nullableSum(singleExpectedLines, 'mealAllowanceKrw', canDisplayAmounts),
    annualGrossPayKrw: nullableSum(singleExpectedLines, 'grossPayKrw', canDisplayAmounts),
    annualNationalPensionKrw: nullableSum(singleExpectedLines, 'nationalPensionKrw', canDisplayAmounts),
    annualHealthInsuranceKrw: nullableSum(singleExpectedLines, 'healthInsuranceKrw', canDisplayAmounts),
    annualLongTermCareKrw: nullableSum(singleExpectedLines, 'longTermCareKrw', canDisplayAmounts),
    annualEmploymentInsuranceKrw: nullableSum(singleExpectedLines, 'employmentInsuranceKrw', canDisplayAmounts),
    annualWithholdingTaxKrw: nullableSum(singleExpectedLines, 'incomeTaxKrw', canDisplayAmounts),
    annualLocalIncomeTaxKrw: nullableSum(singleExpectedLines, 'localIncomeTaxKrw', canDisplayAmounts),
    payrollSummaryLabel,
    hometaxCheckLabel,
    hometaxCheckDetail,
    reasonCodes,
    issueLabels,
    status,
    statusLabel: YEAR_END_LABEL[status].label,
    tone: YEAR_END_LABEL[status].tone,
  }
}

export function buildSimplifiedStatementBlockers(rows: SimplifiedRow[]): PaymentStatementBlocker[] {
  const blockers: PaymentStatementBlocker[] = []
  const payrollCount = rows.filter((row) => row.status === 'needs_review' || row.status === 'missing_months').length
  const profileCount = rows.filter((row) => row.status === 'profile_incomplete').length

  if (payrollCount > 0) {
    blockers.push({
      id: 'payroll',
      title: `급여 미확정·누락 ${payrollCount}명`,
      description: '해당 월 급여를 확정해야 반기 지급총액·원천세가 집계됩니다.',
      tone: 'danger',
      href: '/dashboard/payroll',
      ctaLabel: '급여 열기',
    })
  }
  if (profileCount > 0) {
    blockers.push({
      id: 'profile',
      title: `인적사항 확인 필요 ${profileCount}명 (입사일·명부 매칭)`,
      description: '신고 준비 데이터에 필요한 입사일과 직원 명부 매칭 상태를 확인하세요.',
      tone: 'warn',
      href: '/dashboard/employees',
      ctaLabel: '직원 명부 열기',
    })
  }
  return blockers
}

export function buildPaymentStatementBlockers(params: {
  simplified: SimplifiedRow[]
  yearEnd: YearEndRow[]
}): PaymentStatementBlocker[] {
  return buildSimplifiedStatementBlockers(params.simplified)
}

function buildSectionHero(params: {
  totalEmployees: number
  readyCount: number
  periodOpenCount?: number
}): PaymentStatementHero {
  const periodOpenCount = params.periodOpenCount ?? 0
  const attentionCount = params.totalEmployees - params.readyCount - periodOpenCount
  const readinessPercent = params.totalEmployees === 0
    ? 0
    : Math.round((params.readyCount / params.totalEmployees) * 100)
  return {
    totalEmployees: params.totalEmployees,
    attentionCount,
    readyCount: params.readyCount,
    periodOpenCount,
    readinessPercent,
  }
}

export function buildSimplifiedStatementHero(rows: SimplifiedRow[]): PaymentStatementHero {
  return buildSectionHero({
    totalEmployees: rows.length,
    readyCount: rows.filter((row) => row.status === 'ready').length,
    periodOpenCount: rows.filter((row) => row.status === 'period_open').length,
  })
}

export function buildYearEndSettlementHero(rows: YearEndRow[]): YearEndSettlementHero {
  return {
    totalEmployees: rows.length,
    readyCount: rows.filter((row) => row.status === 'ready').length,
    payrollActionCount: rows.filter((row) => row.status === 'payroll_action_required').length,
    specialCaseCount: rows.filter((row) => row.status === 'special_case_review').length,
    periodOpenCount: rows.filter((row) => row.status === 'period_open').length,
  }
}

// 준비 완료는 반기(simplified)와 연말정산(yearEnd) 둘 다 ready일 때만이다.
// yearEnd의 급여 보완·특례 확인도 허브 attention에 반영해 화면과 공통 상태가
// 어긋나 보이지 않게 한다. 진행 중 연도는 attention과 ready 양쪽에서 제외한다.
export function buildPaymentStatementHero(simplified: SimplifiedRow[], yearEnd: YearEndRow[]): PaymentStatementSummary['hero'] {
  const totalEmployees = simplified.length
  const yearEndByKey = new Map(yearEnd.map((r) => [r.employeeKey, r]))
  const readyCount = simplified.filter((r) => {
    const ye = yearEndByKey.get(r.employeeKey)
    return r.status === 'ready' && (!ye || ye.status === 'ready' || ye.status === 'period_open')
  }).length
  const periodOpenCount = simplified.filter((r) => {
    const ye = yearEndByKey.get(r.employeeKey)
    return r.status === 'period_open' && (!ye || ye.status === 'ready' || ye.status === 'period_open')
  }).length
  return buildSectionHero({ totalEmployees, readyCount, periodOpenCount })
}

// ---------------------------------------------------------------------------
// Read model 로더
// ---------------------------------------------------------------------------

type LoadParams = { tenantId: string; periodKey?: string | null; today?: DateTime }

async function loadRows(tenantId: string, context: ReportingContext) {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }

  const entityRows = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  const businessEntity = entityRows[0] ?? null
  if (!businessEntity) return { tenantRow, businessEntity: null, lines: [], profiles: [] }

  const periodRows = await db
    .select({
      id: payrollPeriodSummary.id,
      period: payrollPeriodSummary.payrollPeriod,
      closeStatus: payrollPeriodSummary.closeStatus,
    })
    .from(payrollPeriodSummary)
    .where(and(
      eq(payrollPeriodSummary.tenantId, tenantId),
      eq(payrollPeriodSummary.clientId, businessEntity.id),
      inArray(payrollPeriodSummary.payrollPeriod, context.yearMonths),
    ))
  const periodById = new Map(periodRows.map((r) => [r.id, r.period]))
  const periodCloseStatusById = new Map(periodRows.map((r) => [r.id, r.closeStatus]))

  const lineRows = periodRows.length > 0
    ? await db
        .select({
          periodSummaryId: payrollEmployeeLine.periodSummaryId,
          employeeCode: payrollEmployeeLine.employeeCode,
          employeeName: payrollEmployeeLine.employeeName,
          baseSalaryKrw: payrollEmployeeLine.baseSalaryKrw,
          mealAllowanceKrw: payrollEmployeeLine.mealAllowanceKrw,
          allowanceKrw: payrollEmployeeLine.allowanceKrw,
          grossPayKrw: payrollEmployeeLine.grossPayKrw,
          incomeTaxKrw: payrollEmployeeLine.incomeTaxKrw,
          localIncomeTaxKrw: payrollEmployeeLine.localIncomeTaxKrw,
          nationalPensionKrw: payrollEmployeeLine.nationalPensionKrw,
          healthInsuranceKrw: payrollEmployeeLine.healthInsuranceKrw,
          longTermCareKrw: payrollEmployeeLine.longTermCareKrw,
          employmentInsuranceKrw: payrollEmployeeLine.employmentInsuranceKrw,
          status: payrollEmployeeLine.status,
        })
        .from(payrollEmployeeLine)
        .where(and(
          eq(payrollEmployeeLine.tenantId, tenantId),
          eq(payrollEmployeeLine.clientId, businessEntity.id),
          inArray(payrollEmployeeLine.periodSummaryId, [...periodById.keys()]),
        ))
    : []

  const lines: AnnualPayrollLineInput[] = lineRows.map((r) => ({
    employeeCode: r.employeeCode,
    employeeName: r.employeeName,
    period: periodById.get(r.periodSummaryId) ?? '',
    periodCloseStatus: periodCloseStatusById.get(r.periodSummaryId) ?? 'open',
    baseSalaryKrw: r.baseSalaryKrw,
    mealAllowanceKrw: r.mealAllowanceKrw,
    allowanceKrw: r.allowanceKrw,
    grossPayKrw: r.grossPayKrw,
    incomeTaxKrw: r.incomeTaxKrw,
    localIncomeTaxKrw: r.localIncomeTaxKrw,
    nationalPensionKrw: r.nationalPensionKrw,
    healthInsuranceKrw: r.healthInsuranceKrw,
    longTermCareKrw: r.longTermCareKrw,
    employmentInsuranceKrw: r.employmentInsuranceKrw,
    status: r.status,
  }))

  const profileRows = await db
    .select({
      employeeCode: employeeProfile.employeeCode,
      displayName: employeeProfile.displayName,
      employeeStatus: employeeProfile.employeeStatus,
      payrollEligibility: employeeProfile.payrollEligibility,
      hireDate: employeeProfile.hireDate,
      terminationDate: employeeProfile.terminationDate,
    })
    .from(employeeProfile)
    .where(and(
      eq(employeeProfile.tenantId, tenantId),
      eq(employeeProfile.clientId, businessEntity.id),
    ))
  const profiles: EmployeeProfileInput[] = profileRows

  return { tenantRow, businessEntity, lines, profiles }
}

type EmployeeGroup = {
  employeeKey: string
  employeeName: string
  employeeCode: string | null
  lines: AnnualPayrollLineInput[]
  profile?: EmployeeProfileInput
}

// employeeCode 우선 매칭 + 이름 fallback으로 급여 line과 명부를 하나의 그룹으로 묶는다.
// 급여 line에 employeeCode가 비어 있어도(레거시 데이터), 이름이 명부와 일치하면
// 명부의 code를 그룹 키로 채택해 한 사람이 두 행으로 갈라지지 않게 한다.
export function resolveEmployeeGroupKey(
  entry: { employeeCode: string | null; name: string },
  profileByCode: Map<string, EmployeeProfileInput>,
  profileByName: Map<string, EmployeeProfileInput>,
): { key: string; profile?: EmployeeProfileInput } {
  const code = entry.employeeCode?.trim()
  if (code && profileByCode.has(code)) {
    return { key: `code:${code}`, profile: profileByCode.get(code) }
  }
  const name = entry.name.trim()
  const byName = profileByName.get(name)
  if (byName) {
    const byNameCode = byName.employeeCode?.trim()
    return { key: byNameCode ? `code:${byNameCode}` : `name:${name}`, profile: byName }
  }
  return { key: code ? `code:${code}` : `name:${name}` }
}

function assemble(lines: AnnualPayrollLineInput[], profiles: EmployeeProfileInput[], context: ReportingContext) {
  const profileByCode = new Map<string, EmployeeProfileInput>()
  const profileByName = new Map<string, EmployeeProfileInput>()
  for (const p of profiles) {
    const code = p.employeeCode?.trim()
    if (code) profileByCode.set(code, p)
    profileByName.set(p.displayName.trim(), p)
  }

  const groups = new Map<string, EmployeeGroup>()

  for (const line of lines) {
    const { key, profile } = resolveEmployeeGroupKey({ employeeCode: line.employeeCode, name: line.employeeName }, profileByCode, profileByName)
    const existing = groups.get(key)
    if (existing) {
      existing.lines.push(line)
      if (!existing.profile && profile) existing.profile = profile
    } else {
      groups.set(key, {
        employeeKey: key,
        employeeName: line.employeeName,
        employeeCode: line.employeeCode ?? profile?.employeeCode ?? null,
        lines: [line],
        profile,
      })
    }
  }

  // 급여 line이 아직 없는 직원(명부에만 존재)도 반영한다.
  for (const p of profiles) {
    if (!isEmployeeProfileRelevantForYear(p, context.year)) continue
    const { key } = resolveEmployeeGroupKey({ employeeCode: p.employeeCode, name: p.displayName }, profileByCode, profileByName)
    const existing = groups.get(key)
    if (existing) {
      if (!existing.profile) existing.profile = p
    } else {
      groups.set(key, { employeeKey: key, employeeName: p.displayName, employeeCode: p.employeeCode, lines: [], profile: p })
    }
  }

  const simplified: SimplifiedRow[] = []
  const yearEnd: YearEndRow[] = []

  for (const group of groups.values()) {
    if (group.profile?.payrollEligibility === 'excluded') continue
    simplified.push(buildSimplifiedRow({
      employeeKey: group.employeeKey,
      employeeName: group.employeeName,
      employeeCode: group.employeeCode,
      lines: group.lines.filter((l) => context.halfMonths.includes(l.period)),
      halfMonths: context.halfMonths,
      requiredMonths: context.requiredMonths,
      periodStatus: context.periodStatus,
      profile: group.profile,
    }))
    yearEnd.push(buildYearEndRow({
      employeeKey: group.employeeKey,
      employeeName: group.employeeName,
      employeeCode: group.employeeCode,
      lines: group.lines,
      yearMonths: context.yearMonths,
      requiredMonths: context.yearRequiredMonths,
      periodStatus: context.yearPeriodStatus,
      profile: group.profile,
    }))
  }

  const sortByName = (a: { employeeName: string }, b: { employeeName: string }) => a.employeeName.localeCompare(b.employeeName, 'ko')
  simplified.sort(sortByName)
  yearEnd.sort(sortByName)
  return { simplified, yearEnd }
}

export async function loadPaymentStatementSummary({ tenantId, periodKey, today }: LoadParams): Promise<PaymentStatementSummary> {
  const current = today ?? now(DEFAULT_TZ)
  const context = resolveReportingContext(current, periodKey)
  const { tenantRow, businessEntity, lines, profiles } = await loadRows(tenantId, context)

  if (!businessEntity) {
    return {
      tenant: tenantRow,
      businessEntity: null,
      context,
      hero: { totalEmployees: 0, attentionCount: 0, readyCount: 0, periodOpenCount: 0, readinessPercent: 0 },
      blockers: [],
      simplified: [],
      yearEnd: [],
    }
  }

  const { simplified, yearEnd } = assemble(lines, profiles, context)
  return {
    tenant: tenantRow,
    businessEntity,
    context,
    hero: buildPaymentStatementHero(simplified, yearEnd),
    blockers: buildPaymentStatementBlockers({ simplified, yearEnd }),
    simplified,
    yearEnd,
  }
}

export async function loadYearEndSettlementSummary(params: LoadParams): Promise<PaymentStatementSummary> {
  const current = params.today ?? now(DEFAULT_TZ)
  return loadPaymentStatementSummary({
    ...params,
    today: current,
    periodKey: resolveYearEndPeriodKey(current, params.periodKey),
  })
}

// 신고 준비 허브 트랙 live용 경량 카운트.
export async function loadPaymentStatementAttentionCount(tenantId: string): Promise<{ total: number; attention: number }> {
  const summary = await loadPaymentStatementSummary({ tenantId })
  return { total: summary.hero.totalEmployees, attention: summary.hero.attentionCount }
}
