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
export type SimplifiedStatus = 'ready' | 'needs_review' | 'missing_months' | 'profile_incomplete'
export type YearEndStatus = 'ready' | 'needs_payroll' | 'mid_year_settlement' | 'profile_incomplete'
export type EmployeeStatus = 'active' | 'leave' | 'terminated'

export type ReportingContext = {
  year: number
  half: 1 | 2
  halfMonths: string[]
  yearMonths: string[]
  halfLabel: string
  halfRangeLabel: string
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

export type EmployeeProfileInput = {
  employeeCode: string | null
  displayName: string
  employeeStatus: EmployeeStatus
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
  annualGrossPayKrw: number | null
  annualWithholdingTaxKrw: number | null
  missingLabel: string
  status: YearEndStatus
  statusLabel: string
  tone: PaymentStatementTone
}

export type PaymentStatementBlocker = {
  id: string
  title: string
  description: string
  tone: 'warn' | 'danger'
  href: string
  ctaLabel: string
}

export type PaymentStatementSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  context: ReportingContext
  hero: { totalEmployees: number; attentionCount: number; readyCount: number; readinessPercent: number }
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

// 반기/연 귀속 컨텍스트. periodKey(YYYY-H1/H2/그 외)나 today에서 파생한다.
export function resolveReportingContext(today: DateTime, periodKey?: string | null): ReportingContext {
  const year = periodKey && /^\d{4}/.test(periodKey) ? Number(periodKey.slice(0, 4)) : today.year
  const halfMatch = periodKey ? periodKey.match(/-H([12])/) : null
  const half: 1 | 2 = halfMatch ? (Number(halfMatch[1]) as 1 | 2) : today.month <= 6 ? 1 : 2
  const startMonth = half === 1 ? 1 : 7
  const halfMonths = Array.from({ length: 6 }, (_, i) => `${year}-${mm(startMonth + i)}`)
  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${mm(1 + i)}`)
  return {
    year,
    half,
    halfMonths,
    yearMonths,
    halfLabel: `${year}년 ${half === 1 ? '상반기' : '하반기'}`,
    halfRangeLabel: `${halfMonths[0]} ~ ${halfMonths[halfMonths.length - 1]}`,
  }
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
  profile?: EmployeeProfileInput
}): SimplifiedRow {
  const { lines, halfMonths, profile } = params
  const grossPayKrw = lines.reduce((sum, l) => sum + l.grossPayKrw, 0)
  const withholdingTaxKrw = lines.reduce((sum, l) => sum + l.incomeTaxKrw, 0)
  const monthsPresent = new Set(lines.map((l) => l.period))
  const expected = expectedMonths(halfMonths, profile)
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
  ready: { label: '검토 준비', tone: 'ok' },
  needs_payroll: { label: '월 급여 확정 필요', tone: 'warn' },
  mid_year_settlement: { label: '중도정산 검토', tone: 'warn' },
  profile_incomplete: { label: '인적사항 확인', tone: 'danger' },
}

export function buildYearEndRow(params: {
  employeeKey: string
  employeeName: string
  employeeCode: string | null
  lines: PayrollLineInput[] // 연간 해당 직원 line
  profile?: EmployeeProfileInput
}): YearEndRow {
  const { lines, profile } = params
  const employeeStatus: EmployeeStatus = profile?.employeeStatus ?? 'active'
  const hasNeedsReview = lines.some((l) => l.status === 'needs_review')
  const hasPayroll = lines.length > 0
  const profileIncomplete = !profile || !profile.hireDate

  const annualGrossPayKrw = hasPayroll ? lines.reduce((sum, l) => sum + l.grossPayKrw, 0) : null
  const annualWithholdingTaxKrw = hasPayroll ? lines.reduce((sum, l) => sum + l.incomeTaxKrw, 0) : null

  let status: YearEndStatus
  const missingParts: string[] = []
  if (hasNeedsReview || !hasPayroll) missingParts.push('월 급여 미확정')
  if (profileIncomplete) missingParts.push('인적사항')

  if (employeeStatus === 'terminated') status = 'mid_year_settlement'
  else if (hasNeedsReview || !hasPayroll) status = 'needs_payroll'
  else if (profileIncomplete) status = 'profile_incomplete'
  else status = 'ready'

  if (employeeStatus === 'terminated' && missingParts.length === 0) missingParts.push('퇴사 정산 확인')

  return {
    employeeKey: params.employeeKey,
    employeeName: params.employeeName,
    employeeCode: params.employeeCode,
    employeeStatus,
    employeeStatusLabel: EMPLOYEE_STATUS_LABEL[employeeStatus],
    annualGrossPayKrw,
    annualWithholdingTaxKrw,
    missingLabel: missingParts.length > 0 ? missingParts.join(' · ') : '없음',
    status,
    statusLabel: YEAR_END_LABEL[status].label,
    tone: YEAR_END_LABEL[status].tone,
  }
}

export function buildPaymentStatementBlockers(params: {
  simplified: SimplifiedRow[]
  yearEnd: YearEndRow[]
}): PaymentStatementBlocker[] {
  const blockers: PaymentStatementBlocker[] = []
  const payrollCount = params.simplified.filter((r) => r.status === 'needs_review' || r.status === 'missing_months').length
  const profileCount = params.simplified.filter((r) => r.status === 'profile_incomplete').length

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

// 준비 완료는 반기(simplified)와 연말정산(yearEnd) 둘 다 ready일 때만이다.
// yearEnd만 보는 것(예: 중도퇴사 → mid_year_settlement)도 hero/허브 attention에
// 반영해야, 연말정산 표의 "중도정산 검토"가 hero·허브 트랙에서 "데이터 준비"로
// 어긋나 보이지 않는다.
export function buildPaymentStatementHero(simplified: SimplifiedRow[], yearEnd: YearEndRow[]): PaymentStatementSummary['hero'] {
  const totalEmployees = simplified.length
  const yearEndByKey = new Map(yearEnd.map((r) => [r.employeeKey, r]))
  const readyCount = simplified.filter((r) => {
    const ye = yearEndByKey.get(r.employeeKey)
    return r.status === 'ready' && (!ye || ye.status === 'ready')
  }).length
  const attentionCount = totalEmployees - readyCount
  const readinessPercent = totalEmployees === 0 ? 0 : Math.round((readyCount / totalEmployees) * 100)
  return { totalEmployees, attentionCount, readyCount, readinessPercent }
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
    .select({ id: payrollPeriodSummary.id, period: payrollPeriodSummary.payrollPeriod })
    .from(payrollPeriodSummary)
    .where(and(
      eq(payrollPeriodSummary.tenantId, tenantId),
      eq(payrollPeriodSummary.clientId, businessEntity.id),
      inArray(payrollPeriodSummary.payrollPeriod, context.yearMonths),
    ))
  const periodById = new Map(periodRows.map((r) => [r.id, r.period]))

  const lineRows = periodRows.length > 0
    ? await db
        .select({
          periodSummaryId: payrollEmployeeLine.periodSummaryId,
          employeeCode: payrollEmployeeLine.employeeCode,
          employeeName: payrollEmployeeLine.employeeName,
          grossPayKrw: payrollEmployeeLine.grossPayKrw,
          incomeTaxKrw: payrollEmployeeLine.incomeTaxKrw,
          status: payrollEmployeeLine.status,
        })
        .from(payrollEmployeeLine)
        .where(and(
          eq(payrollEmployeeLine.tenantId, tenantId),
          eq(payrollEmployeeLine.clientId, businessEntity.id),
          inArray(payrollEmployeeLine.periodSummaryId, [...periodById.keys()]),
        ))
    : []

  const lines: PayrollLineInput[] = lineRows.map((r) => ({
    employeeCode: r.employeeCode,
    employeeName: r.employeeName,
    period: periodById.get(r.periodSummaryId) ?? '',
    grossPayKrw: r.grossPayKrw,
    incomeTaxKrw: r.incomeTaxKrw,
    status: r.status,
  }))

  const profileRows = await db
    .select({
      employeeCode: employeeProfile.employeeCode,
      displayName: employeeProfile.displayName,
      employeeStatus: employeeProfile.employeeStatus,
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
  lines: PayrollLineInput[]
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

function assemble(lines: PayrollLineInput[], profiles: EmployeeProfileInput[], context: ReportingContext) {
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
    simplified.push(buildSimplifiedRow({
      employeeKey: group.employeeKey,
      employeeName: group.employeeName,
      employeeCode: group.employeeCode,
      lines: group.lines.filter((l) => context.halfMonths.includes(l.period)),
      halfMonths: context.halfMonths,
      profile: group.profile,
    }))
    yearEnd.push(buildYearEndRow({
      employeeKey: group.employeeKey,
      employeeName: group.employeeName,
      employeeCode: group.employeeCode,
      lines: group.lines,
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
      hero: { totalEmployees: 0, attentionCount: 0, readyCount: 0, readinessPercent: 0 },
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

// 신고 준비 허브 트랙 live용 경량 카운트.
export async function loadPaymentStatementAttentionCount(tenantId: string): Promise<{ total: number; attention: number }> {
  const summary = await loadPaymentStatementSummary({ tenantId })
  return { total: summary.hero.totalEmployees, attention: summary.hero.attentionCount }
}
