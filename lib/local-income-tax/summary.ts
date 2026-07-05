import { and, asc, eq } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import { client, payrollEmployeeLine, payrollPeriodSummary, tenant } from '@/lib/db/schema'

const DEFAULT_TZ = 'Asia/Seoul'

// ---------------------------------------------------------------------------
// JC-027 지방소득세(원천세 특별징수분) read model — read-only 집계.
// payrollEmployeeLine.localIncomeTaxKrw 실제 저장값을 사용하며, 10%/11 같은
// 근사 재계산은 하지 않는다. needs_review 행은 확인 필요로 남기되 합계 제외.
// ---------------------------------------------------------------------------

export type LocalIncomeTaxLineStatus = 'ready' | 'needs_review' | 'closed'
export type LocalIncomeTaxTone = 'ok' | 'warn' | 'danger' | 'muted'

export type LocalIncomeTaxLine = {
  employeeCode: string | null
  employeeName: string
  grossPayKrw: number
  incomeTaxKrw: number
  localIncomeTaxKrw: number
  status: LocalIncomeTaxLineStatus
}

export type LocalIncomeTaxTotals = {
  totalEmployees: number
  readyEmployees: number
  attentionCount: number
  grossPayKrw: number
  incomeTaxKrw: number
  localIncomeTaxKrw: number
}

export type LocalIncomeTaxRow = LocalIncomeTaxLine & {
  includedInTotals: boolean
  statusLabel: string
  tone: LocalIncomeTaxTone
}

export type LocalIncomeTaxBlocker = {
  id: string
  title: string
  description: string
  tone: 'warn' | 'danger'
  href: string
  ctaLabel: string
}

export type LocalIncomeTaxSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: { periodKey: string; periodLabel: string; filingPeriodKey: string }
  hero: {
    totalEmployees: number
    readyEmployees: number
    attentionCount: number
    readinessPercent: number
    localIncomeTaxTotalKrw: number
  }
  blockers: LocalIncomeTaxBlocker[]
  rows: LocalIncomeTaxRow[]
  totals: LocalIncomeTaxTotals
}

type LoadLocalIncomeTaxParams = {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
}

type LoadLocalIncomeTaxLinesParams = {
  tenantId: string
  clientId: string
  periodSummaryId: string
}

export function isConfirmedLocalIncomeTaxLine(status: LocalIncomeTaxLineStatus): boolean {
  return status === 'ready' || status === 'closed'
}

export function buildLocalIncomeTaxTotals(lines: LocalIncomeTaxLine[]): LocalIncomeTaxTotals {
  const confirmed = lines.filter((line) => isConfirmedLocalIncomeTaxLine(line.status))
  return {
    totalEmployees: lines.length,
    readyEmployees: confirmed.length,
    attentionCount: lines.filter((line) => line.status === 'needs_review').length,
    grossPayKrw: confirmed.reduce((sum, line) => sum + line.grossPayKrw, 0),
    incomeTaxKrw: confirmed.reduce((sum, line) => sum + line.incomeTaxKrw, 0),
    localIncomeTaxKrw: confirmed.reduce((sum, line) => sum + line.localIncomeTaxKrw, 0),
  }
}

export function buildLocalIncomeTaxRows(lines: LocalIncomeTaxLine[], periodLabel: string): LocalIncomeTaxRow[] {
  return lines.map((line) => {
    const includedInTotals = isConfirmedLocalIncomeTaxLine(line.status)
    return {
      ...line,
      includedInTotals,
      statusLabel: includedInTotals ? '준비 완료' : `${periodLabel} 급여 미확정`,
      tone: includedInTotals ? 'ok' : 'warn',
    }
  })
}

export function buildLocalIncomeTaxBlockers(params: {
  lines: LocalIncomeTaxLine[]
  periodLabel: string
  periodKey: string
}): LocalIncomeTaxBlocker[] {
  const attentionCount = params.lines.filter((line) => line.status === 'needs_review').length
  if (attentionCount === 0) return []
  return [{
    id: 'payroll-needs-review',
    title: `${params.periodLabel} 급여 미확정 직원 ${attentionCount}명`,
    description: '해당 기간 급여를 확정해야 지방소득세 집계가 완전해집니다.',
    tone: 'danger',
    href: `/dashboard/payroll?period=${params.periodKey}`,
    ctaLabel: '급여 열기',
  }]
}

export function buildLocalIncomeTaxHero(totals: LocalIncomeTaxTotals): LocalIncomeTaxSummary['hero'] {
  return {
    totalEmployees: totals.totalEmployees,
    readyEmployees: totals.readyEmployees,
    attentionCount: totals.attentionCount,
    readinessPercent: totals.totalEmployees === 0 ? 0 : Math.round((totals.readyEmployees / totals.totalEmployees) * 100),
    localIncomeTaxTotalKrw: totals.localIncomeTaxKrw,
  }
}

export async function loadLocalIncomeTaxLines({
  tenantId,
  clientId,
  periodSummaryId,
}: LoadLocalIncomeTaxLinesParams): Promise<LocalIncomeTaxLine[]> {
  const { db } = await import('@/lib/db')
  const rows = await db
    .select({
      employeeCode: payrollEmployeeLine.employeeCode,
      employeeName: payrollEmployeeLine.employeeName,
      grossPayKrw: payrollEmployeeLine.grossPayKrw,
      incomeTaxKrw: payrollEmployeeLine.incomeTaxKrw,
      localIncomeTaxKrw: payrollEmployeeLine.localIncomeTaxKrw,
      status: payrollEmployeeLine.status,
    })
    .from(payrollEmployeeLine)
    .where(and(
      eq(payrollEmployeeLine.tenantId, tenantId),
      eq(payrollEmployeeLine.clientId, clientId),
      eq(payrollEmployeeLine.periodSummaryId, periodSummaryId),
    ))
    .orderBy(asc(payrollEmployeeLine.employeeName), asc(payrollEmployeeLine.employeeCode))

  return rows
}

export async function loadLocalIncomeTaxSummary({
  tenantId,
  periodKey,
  today,
}: LoadLocalIncomeTaxParams): Promise<LocalIncomeTaxSummary> {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }
  const companyPeriod = buildCompanyHomePeriod({ periodKey, today, timezone: tenantRow.timezone })
  const payrollPeriodKey = companyPeriod.endMonth
  const periodLabel = `${payrollPeriodKey.slice(0, 4)}년 ${Number(payrollPeriodKey.slice(5, 7))}월`

  const businessEntityRows = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  const businessEntity = businessEntityRows[0] ?? null

  const base = {
    tenant: tenantRow,
    businessEntity,
    period: { periodKey: payrollPeriodKey, periodLabel, filingPeriodKey: companyPeriod.key },
  }

  if (!businessEntity) {
    const totals = buildLocalIncomeTaxTotals([])
    return { ...base, hero: buildLocalIncomeTaxHero(totals), blockers: [], rows: [], totals }
  }

  const periodRows = await db
    .select({ id: payrollPeriodSummary.id })
    .from(payrollPeriodSummary)
    .where(and(
      eq(payrollPeriodSummary.tenantId, tenantId),
      eq(payrollPeriodSummary.clientId, businessEntity.id),
      eq(payrollPeriodSummary.payrollPeriod, payrollPeriodKey),
    ))
    .limit(1)
  const periodSummaryId = periodRows[0]?.id ?? null
  const lines = periodSummaryId
    ? await loadLocalIncomeTaxLines({ tenantId, clientId: businessEntity.id, periodSummaryId })
    : []
  const totals = buildLocalIncomeTaxTotals(lines)

  return {
    ...base,
    hero: buildLocalIncomeTaxHero(totals),
    blockers: buildLocalIncomeTaxBlockers({ lines, periodLabel, periodKey: payrollPeriodKey }),
    rows: buildLocalIncomeTaxRows(lines, periodLabel),
    totals,
  }
}

// 신고 준비 허브 트랙 live용 경량 카운트.
export async function loadLocalIncomeTaxAttentionCount(tenantId: string): Promise<{
  total: number
  attention: number
  localIncomeTaxKrw: number
}> {
  const summary = await loadLocalIncomeTaxSummary({ tenantId })
  return {
    total: summary.hero.totalEmployees,
    attention: summary.hero.attentionCount,
    localIncomeTaxKrw: summary.hero.localIncomeTaxTotalKrw,
  }
}
