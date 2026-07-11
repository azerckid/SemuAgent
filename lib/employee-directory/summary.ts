import { and, asc, eq } from 'drizzle-orm'
import { client, employeeProfile, payrollEmployeeLine, payrollPeriodSummary, tenant } from '@/lib/db/schema'

export type EmployeeStatus = 'active' | 'leave' | 'terminated'
export type PayrollEligibility = 'eligible' | 'excluded'
export type InsuranceEnrollmentStatus = 'not_checked' | 'enrolled' | 'needs_review' | 'not_applicable'
export type EmployeeTone = 'ok' | 'warn' | 'danger' | 'muted' | 'accent'

export type EmployeeDirectoryStats = {
  activeCount: number
  payrollEligibleCount: number
  needsReviewCount: number
  terminatedCount: number
}

export type EmployeeDirectoryRow = {
  id: string
  employeeCode: string | null
  displayName: string
  department: string | null
  jobTitle: string | null
  employeeStatus: EmployeeStatus
  employeeStatusLabel: string
  employeeStatusTone: EmployeeTone
  payrollEligibility: PayrollEligibility
  payrollEligibilityLabel: string
  insuranceEnrollmentStatus: InsuranceEnrollmentStatus
  insuranceEnrollmentLabel: string
  insuranceEnrollmentTone: EmployeeTone
  // 고용형태에서 유래한 보조 표기(예: 일용직 '고용보험만'). 없으면 null.
  insuranceEnrollmentNote: string | null
  hireDate: string | null
  terminationDate: string | null
  workEmail: string | null
  notificationEnabled: boolean
  latestPayrollPeriod: string | null
  issueLabel: string | null
}

export type EmployeeDirectorySummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  canViewEmployeeNames: boolean
  stats: EmployeeDirectoryStats
  employees: EmployeeDirectoryRow[]
}

type EmployeeProfileInput = {
  id: string
  employeeCode: string | null
  displayName: string
  department: string | null
  jobTitle: string | null
  employeeStatus: string
  payrollEligibility: string
  insuranceEnrollmentStatus: string
  hireDate: string | null
  terminationDate: string | null
  workEmail: string | null
  notificationEnabled: boolean
}

const DEFAULT_TZ = 'Asia/Seoul'

const STATUS_RANK: Record<EmployeeStatus, number> = { active: 0, leave: 1, terminated: 2 }

export function normalizeEmployeeStatus(value: string): EmployeeStatus {
  if (value === 'leave' || value === 'terminated') return value
  return 'active'
}

export function normalizePayrollEligibility(value: string): PayrollEligibility {
  return value === 'excluded' ? 'excluded' : 'eligible'
}

export function normalizeInsuranceEnrollmentStatus(value: string): InsuranceEnrollmentStatus {
  if (value === 'enrolled' || value === 'needs_review' || value === 'not_applicable') return value
  return 'not_checked'
}

export function maskEmployeeName(name: string, canViewEmployeeNames: boolean): string {
  if (canViewEmployeeNames) return name
  const trimmed = name.trim()
  if (trimmed.length <= 1) return '*'
  return `${trimmed[0]}${'*'.repeat(Math.max(1, trimmed.length - 1))}`
}

export function employeeStatusLabel(status: EmployeeStatus): string {
  return status === 'active' ? '재직' : status === 'leave' ? '휴직' : '퇴사'
}

export function employeeStatusTone(status: EmployeeStatus): EmployeeTone {
  return status === 'active' ? 'ok' : status === 'leave' ? 'warn' : 'muted'
}

export function payrollEligibilityLabel(eligibility: PayrollEligibility): string {
  return eligibility === 'eligible' ? '대상' : '제외'
}

export function insuranceEnrollmentLabel(status: InsuranceEnrollmentStatus): string {
  switch (status) {
    case 'enrolled': return '가입 확인'
    case 'needs_review': return '확인 필요'
    case 'not_applicable': return '해당 없음'
    default: return '미확인'
  }
}

export function insuranceEnrollmentTone(status: InsuranceEnrollmentStatus): EmployeeTone {
  switch (status) {
    case 'enrolled': return 'ok'
    case 'needs_review': return 'warn'
    case 'not_applicable': return 'muted'
    default: return 'muted'
  }
}

// 일용직은 국민연금·건강보험 미적용, 고용보험(+산재)만 대상이라 '가입'이어도 범위를 명시한다.
export function insuranceEnrollmentNote(
  status: InsuranceEnrollmentStatus,
  employmentType: string | null,
): string | null {
  if (status === 'enrolled' && employmentType === '일용직') return '고용보험만'
  return null
}

export function buildEmployeeDirectoryStats(rows: EmployeeProfileInput[]): EmployeeDirectoryStats {
  return rows.reduce<EmployeeDirectoryStats>((stats, row) => {
    const status = normalizeEmployeeStatus(row.employeeStatus)
    const eligibility = normalizePayrollEligibility(row.payrollEligibility)
    const insurance = normalizeInsuranceEnrollmentStatus(row.insuranceEnrollmentStatus)
    if (status === 'active') stats.activeCount += 1
    if (status === 'terminated') stats.terminatedCount += 1
    if (status !== 'terminated' && eligibility === 'eligible') stats.payrollEligibleCount += 1
    if (status !== 'terminated' && insurance === 'needs_review') stats.needsReviewCount += 1
    return stats
  }, { activeCount: 0, payrollEligibleCount: 0, needsReviewCount: 0, terminatedCount: 0 })
}

export function buildEmployeeDirectoryRow(
  row: EmployeeProfileInput,
  latestPayrollPeriod: string | null,
  canViewEmployeeNames = true,
  employmentType: string | null = null,
): EmployeeDirectoryRow {
  const employeeStatus = normalizeEmployeeStatus(row.employeeStatus)
  const payrollEligibility = normalizePayrollEligibility(row.payrollEligibility)
  const insuranceEnrollmentStatus = normalizeInsuranceEnrollmentStatus(row.insuranceEnrollmentStatus)
  const issueLabel = employeeStatus !== 'terminated' && insuranceEnrollmentStatus === 'needs_review'
    ? '4대보험 확인 필요'
    : null

  return {
    id: row.id,
    employeeCode: row.employeeCode,
    displayName: maskEmployeeName(row.displayName, canViewEmployeeNames),
    department: row.department,
    jobTitle: row.jobTitle,
    employeeStatus,
    employeeStatusLabel: employeeStatusLabel(employeeStatus),
    employeeStatusTone: employeeStatusTone(employeeStatus),
    payrollEligibility,
    payrollEligibilityLabel: payrollEligibilityLabel(payrollEligibility),
    insuranceEnrollmentStatus,
    insuranceEnrollmentLabel: insuranceEnrollmentLabel(insuranceEnrollmentStatus),
    insuranceEnrollmentTone: insuranceEnrollmentTone(insuranceEnrollmentStatus),
    insuranceEnrollmentNote: insuranceEnrollmentNote(insuranceEnrollmentStatus, employmentType),
    hireDate: row.hireDate,
    terminationDate: row.terminationDate,
    workEmail: row.workEmail,
    notificationEnabled: row.notificationEnabled,
    latestPayrollPeriod,
    issueLabel,
  }
}

export function sortEmployeeRows(rows: EmployeeDirectoryRow[]): EmployeeDirectoryRow[] {
  return [...rows].sort((a, b) => {
    const rank = STATUS_RANK[a.employeeStatus] - STATUS_RANK[b.employeeStatus]
    if (rank !== 0) return rank
    return (a.employeeCode ?? '').localeCompare(b.employeeCode ?? '', 'ko')
  })
}

type LoadEmployeeDirectoryParams = {
  tenantId: string
  canViewEmployeeNames?: boolean
}

export async function loadEmployeeDirectorySummary({
  tenantId,
  canViewEmployeeNames = true,
}: LoadEmployeeDirectoryParams): Promise<EmployeeDirectorySummary> {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }

  const businessEntityRows = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  const businessEntity = businessEntityRows[0] ?? null
  const base = { tenant: tenantRow, businessEntity, canViewEmployeeNames }

  if (!businessEntity) {
    return {
      ...base,
      stats: buildEmployeeDirectoryStats([]),
      employees: [],
    }
  }

  const [profileRows, payrollLineRows] = await Promise.all([
    db
      .select({
        id: employeeProfile.id,
        employeeCode: employeeProfile.employeeCode,
        displayName: employeeProfile.displayName,
        department: employeeProfile.department,
        jobTitle: employeeProfile.jobTitle,
        employeeStatus: employeeProfile.employeeStatus,
        payrollEligibility: employeeProfile.payrollEligibility,
        insuranceEnrollmentStatus: employeeProfile.insuranceEnrollmentStatus,
        hireDate: employeeProfile.hireDate,
        terminationDate: employeeProfile.terminationDate,
        workEmail: employeeProfile.workEmail,
        notificationEnabled: employeeProfile.notificationEnabled,
      })
      .from(employeeProfile)
      .where(and(
        eq(employeeProfile.tenantId, tenantId),
        eq(employeeProfile.clientId, businessEntity.id),
      ))
      .orderBy(asc(employeeProfile.employeeCode), asc(employeeProfile.displayName)),
    db
      .select({
        employeeCode: payrollEmployeeLine.employeeCode,
        payrollPeriod: payrollPeriodSummary.payrollPeriod,
        jobType: payrollEmployeeLine.jobType,
      })
      .from(payrollEmployeeLine)
      .innerJoin(payrollPeriodSummary, eq(payrollEmployeeLine.periodSummaryId, payrollPeriodSummary.id))
      .where(and(
        eq(payrollEmployeeLine.tenantId, tenantId),
        eq(payrollEmployeeLine.clientId, businessEntity.id),
      )),
  ])

  // employee_code 기준 최근 급여 귀속월(읽기 전용 매칭). 별도 수동 연결 mutation은 없다.
  // 같은 매칭에서 고용형태(jobType)도 끌어와 4대보험 보조 표기(일용직 '고용보험만')에 쓴다.
  const latestPayrollByCode = new Map<string, string>()
  const jobTypeByCode = new Map<string, string | null>()
  for (const line of payrollLineRows) {
    if (!line.employeeCode || !line.payrollPeriod) continue
    const current = latestPayrollByCode.get(line.employeeCode)
    if (!current || line.payrollPeriod > current) {
      latestPayrollByCode.set(line.employeeCode, line.payrollPeriod)
      jobTypeByCode.set(line.employeeCode, line.jobType)
    }
  }

  const employees = sortEmployeeRows(profileRows.map((row) => buildEmployeeDirectoryRow(
    row,
    row.employeeCode ? latestPayrollByCode.get(row.employeeCode) ?? null : null,
    canViewEmployeeNames,
    row.employeeCode ? jobTypeByCode.get(row.employeeCode) ?? null : null,
  )))

  return {
    ...base,
    stats: buildEmployeeDirectoryStats(profileRows),
    employees,
  }
}
