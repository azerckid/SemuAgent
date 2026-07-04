import { and, desc, eq } from 'drizzle-orm'
import { employeeProfile, payrollEmployeeLine, payrollPeriodSummary } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// JC-018: payroll 도메인 내부 리마인드의 mixed 수신자 — "그 시점 급여 확인 필요
// (needs_review)인 직원만"을 employeeCode 정확 매칭으로 추린다. 이름 fallback은
// 쓰지 않는다(개인 이메일 오발송 방지 — 매칭 실패는 그 직원만 제외, staff
// 발송에는 영향 없음).
// ---------------------------------------------------------------------------

export type PayrollAttentionEmployee = {
  employeeCode: string
  employeeName: string
  workEmail: string
}

type PayrollLineForAttention = {
  employeeCode: string | null
  status: 'ready' | 'needs_review' | 'closed'
}

type EmployeeProfileForAttention = {
  employeeCode: string | null
  displayName: string
  workEmail: string | null
  notificationEnabled: boolean
  employeeStatus: 'active' | 'leave' | 'terminated'
}

export function resolvePayrollAttentionEmployees(
  lines: PayrollLineForAttention[],
  profiles: EmployeeProfileForAttention[],
): PayrollAttentionEmployee[] {
  const profileByCode = new Map(
    profiles
      .filter((p) => p.employeeCode?.trim())
      .map((p) => [p.employeeCode!.trim(), p]),
  )
  const needsReviewCodes = new Set(
    lines
      .filter((l) => l.status === 'needs_review' && l.employeeCode?.trim())
      .map((l) => l.employeeCode!.trim()),
  )

  const result: PayrollAttentionEmployee[] = []
  for (const code of needsReviewCodes) {
    const profile = profileByCode.get(code)
    if (!profile) continue // 명부 미매칭 → 제외
    if (profile.employeeStatus === 'terminated') continue // 퇴사자 제외
    if (!profile.notificationEnabled) continue // 알림 꺼짐 제외
    const email = profile.workEmail?.trim()
    if (!email) continue // 이메일 없음 제외
    result.push({ employeeCode: code, employeeName: profile.displayName, workEmail: email })
  }
  return result.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ko'))
}

export async function loadPayrollAttentionEmployees(params: {
  tenantId: string
  clientId: string
}): Promise<PayrollAttentionEmployee[]> {
  const { db } = await import('@/lib/db')

  const periodRows = await db
    .select({ id: payrollPeriodSummary.id })
    .from(payrollPeriodSummary)
    .where(and(
      eq(payrollPeriodSummary.tenantId, params.tenantId),
      eq(payrollPeriodSummary.clientId, params.clientId),
    ))
    .orderBy(desc(payrollPeriodSummary.payrollPeriod), desc(payrollPeriodSummary.createdAt))
    .limit(1)
  const periodSummaryId = periodRows[0]?.id
  if (!periodSummaryId) return []

  const [lineRows, profileRows] = await Promise.all([
    db
      .select({ employeeCode: payrollEmployeeLine.employeeCode, status: payrollEmployeeLine.status })
      .from(payrollEmployeeLine)
      .where(and(
        eq(payrollEmployeeLine.tenantId, params.tenantId),
        eq(payrollEmployeeLine.clientId, params.clientId),
        eq(payrollEmployeeLine.periodSummaryId, periodSummaryId),
      )),
    db
      .select({
        employeeCode: employeeProfile.employeeCode,
        displayName: employeeProfile.displayName,
        workEmail: employeeProfile.workEmail,
        notificationEnabled: employeeProfile.notificationEnabled,
        employeeStatus: employeeProfile.employeeStatus,
      })
      .from(employeeProfile)
      .where(and(
        eq(employeeProfile.tenantId, params.tenantId),
        eq(employeeProfile.clientId, params.clientId),
      )),
  ])

  return resolvePayrollAttentionEmployees(lineRows, profileRows)
}
