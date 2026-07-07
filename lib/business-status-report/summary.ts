import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import { pickLatestCompletedRunIdsBySession } from '@/lib/bookkeeping-review/summary'
import { client, bookkeepingClassificationRun, bookkeepingTransactionClassification, tenant } from '@/lib/db/schema'
import { resolveActiveSourceBatchSessionIds } from '@/lib/source-batch/scope'
import { loadSourceCollectionSummary } from '@/lib/source-collection/summary'
import { now } from '@/lib/time'
import type { TaxEntityType } from '@/lib/validations/business-entity'

const DEFAULT_TZ = 'Asia/Seoul'

// ---------------------------------------------------------------------------
// JC-028 사업장현황신고 read model — read-only 집계.
// 면세 개인사업자(tax_exempt)만 대상이며, 확정 기장 행을 귀속연도 기준으로
// 집계한다. 신규 DB/세액계산/전자신고 파일/자동제출 없음.
// ---------------------------------------------------------------------------

export type BusinessStatusEligibility =
  | { state: 'applicable'; reason: null }
  | { state: 'not_applicable'; reason: 'vat_taxable_or_corporation' }
  | { state: 'needs_business_type'; reason: 'tax_entity_type_missing' }

export type BusinessStatusTone = 'ok' | 'warn' | 'danger' | 'muted'

export type BusinessStatusClassificationRow = {
  id: string
  sourceType: 'bank' | 'card' | 'receipt' | 'tax_invoice' | 'other'
  direction: 'income' | 'expense' | 'unknown'
  amountKrw: number | null
  recommendedAccount: string | null
  finalAccount: string | null
  status: 'suggested' | 'needs_decision' | 'confirmed' | 'unclassified' | 'excluded'
}

export type BusinessStatusAmountRow = {
  id: string
  label: string
  amountKrw: number
  sourceCount: number
  statusLabel: '준비 완료' | '확인 필요'
  tone: 'ok' | 'warn'
}

export type BusinessStatusBlocker = {
  id: string
  title: string
  description: string
  tone: 'warn' | 'danger'
  href: '/dashboard/direct-upload' | '/dashboard/bookkeeping' | '/dashboard/settings'
  ctaLabel: '자료수집 열기' | '자료대조원장 열기' | '설정 열기'
}

export type BusinessStatusHandoffRow = {
  item: string
  value: string
  statusLabel: '준비 완료' | '확인 필요' | '사용자 직접'
  tone: BusinessStatusTone
  owner: string
}

export type BusinessStatusSourceIssueCounts = {
  sourceMissingCount: number
  normalizationPendingCount: number
}

export type BusinessStatusReportSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string; taxEntityType: TaxEntityType | null } | null
  fiscalYear: number
  eligibility: BusinessStatusEligibility
  hero: {
    preparationPercent: number
    attentionCount: number
    revenueTotalKrw: number
    expenseTotalKrw: number
  }
  blockers: BusinessStatusBlocker[]
  revenueRows: BusinessStatusAmountRow[]
  expenseRows: BusinessStatusAmountRow[]
  handoffRows: BusinessStatusHandoffRow[]
}

type LoadParams = { tenantId: string; periodKey?: string | null; today?: DateTime }

export function resolveBusinessStatusEligibility(taxEntityType: TaxEntityType | null): BusinessStatusEligibility {
  if (taxEntityType === 'tax_exempt') return { state: 'applicable', reason: null }
  if (taxEntityType === null) return { state: 'needs_business_type', reason: 'tax_entity_type_missing' }
  return { state: 'not_applicable', reason: 'vat_taxable_or_corporation' }
}

function accountLabel(row: BusinessStatusClassificationRow) {
  return row.finalAccount ?? row.recommendedAccount ?? (row.direction === 'income' ? '미분류 수입' : sourceTypeLabel(row.sourceType))
}

function sourceTypeLabel(sourceType: BusinessStatusClassificationRow['sourceType']) {
  switch (sourceType) {
    case 'bank': return '통장 거래'
    case 'card': return '카드 경비'
    case 'receipt': return '영수증·현금영수증'
    case 'tax_invoice': return '세금계산서'
    case 'other':
    default:
      return '기타 자료'
  }
}

function buildAmountRows(rows: BusinessStatusClassificationRow[], direction: 'income' | 'expense'): BusinessStatusAmountRow[] {
  const confirmed = rows.filter((row) => row.direction === direction && row.status === 'confirmed' && row.amountKrw !== null)
  const grouped = new Map<string, { amountKrw: number; sourceCount: number }>()
  for (const row of confirmed) {
    const label = accountLabel(row)
    const prev = grouped.get(label) ?? { amountKrw: 0, sourceCount: 0 }
    grouped.set(label, {
      amountKrw: prev.amountKrw + (row.amountKrw ?? 0),
      sourceCount: prev.sourceCount + 1,
    })
  }

  return [...grouped.entries()]
    .map(([label, value]) => ({
      id: `${direction}-${label}`,
      label,
      amountKrw: value.amountKrw,
      sourceCount: value.sourceCount,
      statusLabel: '준비 완료' as const,
      tone: 'ok' as const,
    }))
    .sort((a, b) => b.amountKrw - a.amountKrw || a.label.localeCompare(b.label, 'ko'))
}

export function buildBusinessStatusRevenueRows(rows: BusinessStatusClassificationRow[]): BusinessStatusAmountRow[] {
  return buildAmountRows(rows, 'income')
}

export function buildBusinessStatusExpenseRows(rows: BusinessStatusClassificationRow[]): BusinessStatusAmountRow[] {
  return buildAmountRows(rows, 'expense')
}

export function buildBusinessStatusPreparationPercent(params: {
  applicable: boolean
  blockerCount: number
  confirmedRevenueCount: number
  confirmedExpenseCount: number
}): number {
  if (!params.applicable) return 0
  const confirmedReadyCount = params.confirmedRevenueCount + params.confirmedExpenseCount
  if (confirmedReadyCount === 0) return 0
  if (params.blockerCount === 0) return 100
  return Math.round((confirmedReadyCount / (confirmedReadyCount + params.blockerCount)) * 100)
}

export function buildBusinessStatusBlockers(params: {
  eligibility: BusinessStatusEligibility
  classificationRows: BusinessStatusClassificationRow[]
  sourceMissingCount: number
  normalizationPendingCount: number
}): BusinessStatusBlocker[] {
  const blockers: BusinessStatusBlocker[] = []
  if (params.eligibility.state === 'needs_business_type') {
    blockers.push({
      id: 'business-type-missing',
      title: '사업자 유형 미지정',
      description: '면세 개인사업자인지 확인해야 사업장현황신고 준비 화면을 사용할 수 있습니다.',
      tone: 'warn',
      href: '/dashboard/settings',
      ctaLabel: '설정 열기',
    })
  }

  const missingSourceCount = params.sourceMissingCount + params.normalizationPendingCount
  if (missingSourceCount > 0) {
    blockers.push({
      id: 'source-collection',
      title: `자료수집 확인 필요 ${missingSourceCount}건`,
      description: '누락 자료나 정규화 대기 파일을 처리해야 신고 준비 데이터가 완전해집니다.',
      tone: 'warn',
      href: '/dashboard/direct-upload',
      ctaLabel: '자료수집 열기',
    })
  }

  const unconfirmedCount = params.classificationRows.filter((row) => (
    row.status === 'suggested' || row.status === 'needs_decision' || row.status === 'unclassified' || row.amountKrw === null
  )).length
  if (unconfirmedCount > 0) {
    blockers.push({
      id: 'bookkeeping-review',
      title: `기장검토 확인 필요 ${unconfirmedCount}건`,
      description: '수입금액과 매입·경비 계정분류를 확정해야 합계에 반영됩니다.',
      tone: 'danger',
      href: '/dashboard/bookkeeping',
      ctaLabel: '자료대조원장 열기',
    })
  }
  return blockers
}

export function buildBusinessStatusAnnualSourceIssueCounts(summaries: Array<{
  missingItems: readonly unknown[]
  completeness: { normalizationPendingCount: number }
}>): BusinessStatusSourceIssueCounts {
  return summaries.reduce<BusinessStatusSourceIssueCounts>((acc, summary) => ({
    sourceMissingCount: acc.sourceMissingCount + summary.missingItems.length,
    normalizationPendingCount: acc.normalizationPendingCount + summary.completeness.normalizationPendingCount,
  }), { sourceMissingCount: 0, normalizationPendingCount: 0 })
}

export function buildBusinessStatusHandoffRows(params: {
  revenueTotalKrw: number
  expenseTotalKrw: number
  blockerCount: number
}): BusinessStatusHandoffRow[] {
  return [
    {
      item: '수입금액',
      value: `${formatKrw(params.revenueTotalKrw)}원`,
      statusLabel: params.revenueTotalKrw > 0 ? '준비 완료' : '확인 필요',
      tone: params.revenueTotalKrw > 0 ? 'ok' : 'warn',
      owner: '기장검토',
    },
    {
      item: '매입·경비 자료',
      value: `${formatKrw(params.expenseTotalKrw)}원`,
      statusLabel: params.expenseTotalKrw > 0 ? '준비 완료' : '확인 필요',
      tone: params.expenseTotalKrw > 0 ? 'ok' : 'warn',
      owner: '자료수집·기장검토',
    },
    {
      item: '누락/미확정',
      value: `${params.blockerCount}건`,
      statusLabel: params.blockerCount === 0 ? '준비 완료' : '확인 필요',
      tone: params.blockerCount === 0 ? 'ok' : 'danger',
      owner: '자료수집·기장검토',
    },
    {
      item: '제출 안내',
      value: '홈택스 사업장현황신고 메뉴',
      statusLabel: '사용자 직접',
      tone: 'muted',
      owner: '신고지원',
    },
  ]
}

export function resolveBusinessStatusFiscalYear(today: DateTime, periodKey?: string | null) {
  if (periodKey && /^\d{4}/.test(periodKey)) return Number(periodKey.slice(0, 4))
  return today.year
}

async function loadBusinessStatusAnnualSourceIssueCounts(params: {
  tenantId: string
  fiscalYear: number
  today: DateTime
}): Promise<BusinessStatusSourceIssueCounts> {
  const [h1, h2] = await Promise.all([
    loadSourceCollectionSummary({ tenantId: params.tenantId, periodKey: `${params.fiscalYear}-H1`, today: params.today }),
    loadSourceCollectionSummary({ tenantId: params.tenantId, periodKey: `${params.fiscalYear}-H2`, today: params.today }),
  ])
  return buildBusinessStatusAnnualSourceIssueCounts([h1, h2])
}

async function loadBusinessStatusRows(params: { tenantId: string; clientId: string; fiscalYear: number }) {
  const { db } = await import('@/lib/db')
  const period = { startMonth: `${params.fiscalYear}-01`, endMonth: `${params.fiscalYear}-12` }
  const sessionIds = await resolveActiveSourceBatchSessionIds({
    tenantId: params.tenantId,
    clientId: params.clientId,
    period,
  })
  if (sessionIds.length === 0) return []

  const runRows = await db
    .select({
      id: bookkeepingClassificationRun.id,
      uploadSessionId: bookkeepingClassificationRun.uploadSessionId,
      status: bookkeepingClassificationRun.status,
      createdAt: bookkeepingClassificationRun.createdAt,
    })
    .from(bookkeepingClassificationRun)
    .where(and(
      eq(bookkeepingClassificationRun.tenantId, params.tenantId),
      eq(bookkeepingClassificationRun.status, 'completed'),
      inArray(bookkeepingClassificationRun.uploadSessionId, sessionIds),
    ))
    .orderBy(desc(bookkeepingClassificationRun.createdAt), desc(bookkeepingClassificationRun.id))
  const latestRunIds = pickLatestCompletedRunIdsBySession(runRows)
  if (latestRunIds.length === 0) return []

  return db
    .select({
      id: bookkeepingTransactionClassification.id,
      sourceType: bookkeepingTransactionClassification.sourceType,
      direction: bookkeepingTransactionClassification.direction,
      amountKrw: bookkeepingTransactionClassification.amountKrw,
      recommendedAccount: bookkeepingTransactionClassification.recommendedAccount,
      finalAccount: bookkeepingTransactionClassification.finalAccount,
      status: bookkeepingTransactionClassification.status,
    })
    .from(bookkeepingTransactionClassification)
    .where(and(
      eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
      inArray(bookkeepingTransactionClassification.classificationRunId, latestRunIds),
      ne(bookkeepingTransactionClassification.status, 'excluded'),
    ))
}

export async function loadBusinessStatusReportSummary({ tenantId, periodKey, today }: LoadParams): Promise<BusinessStatusReportSummary> {
  const { db } = await import('@/lib/db')
  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }
  const current = today ?? now(tenantRow.timezone)
  const fiscalYear = resolveBusinessStatusFiscalYear(current, periodKey)

  const entityRows = await db
    .select({ id: client.id, name: client.name, taxEntityType: client.taxEntityType })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(client.createdAt)
    .limit(1)
  const businessEntity = entityRows[0] ?? null
  const eligibility = resolveBusinessStatusEligibility(businessEntity?.taxEntityType ?? null)

  if (!businessEntity) {
    const blockers = buildBusinessStatusBlockers({ eligibility, classificationRows: [], sourceMissingCount: 0, normalizationPendingCount: 0 })
    return emptySummary({ tenantRow, businessEntity: null, fiscalYear, eligibility, blockers })
  }

  if (eligibility.state === 'not_applicable') {
    return emptySummary({ tenantRow, businessEntity, fiscalYear, eligibility, blockers: [] })
  }

  const [classificationRows, sourceIssues] = await Promise.all([
    loadBusinessStatusRows({ tenantId, clientId: businessEntity.id, fiscalYear }),
    loadBusinessStatusAnnualSourceIssueCounts({ tenantId, fiscalYear, today: current }),
  ])
  const revenueRows = buildBusinessStatusRevenueRows(classificationRows)
  const expenseRows = buildBusinessStatusExpenseRows(classificationRows)
  const blockers = buildBusinessStatusBlockers({
    eligibility,
    classificationRows,
    sourceMissingCount: sourceIssues.sourceMissingCount,
    normalizationPendingCount: sourceIssues.normalizationPendingCount,
  })
  const revenueTotalKrw = sumRows(revenueRows)
  const expenseTotalKrw = sumRows(expenseRows)
  const confirmedRevenueCount = revenueRows.reduce((sum, row) => sum + row.sourceCount, 0)
  const confirmedExpenseCount = expenseRows.reduce((sum, row) => sum + row.sourceCount, 0)
  const attentionCount = blockers.length
  return {
    tenant: tenantRow,
    businessEntity,
    fiscalYear,
    eligibility,
    hero: {
      preparationPercent: buildBusinessStatusPreparationPercent({
        applicable: eligibility.state === 'applicable',
        blockerCount: attentionCount,
        confirmedRevenueCount,
        confirmedExpenseCount,
      }),
      attentionCount,
      revenueTotalKrw,
      expenseTotalKrw,
    },
    blockers,
    revenueRows,
    expenseRows,
    handoffRows: buildBusinessStatusHandoffRows({ revenueTotalKrw, expenseTotalKrw, blockerCount: attentionCount }),
  }
}

export async function loadBusinessStatusReportAttentionCount(tenantId: string): Promise<{
  total: number
  attention: number
  revenueTotalKrw: number
} | null> {
  const summary = await loadBusinessStatusReportSummary({ tenantId })
  if (summary.eligibility.state === 'not_applicable') return null
  return {
    total: summary.revenueRows.reduce((sum, row) => sum + row.sourceCount, 0),
    attention: summary.hero.attentionCount,
    revenueTotalKrw: summary.hero.revenueTotalKrw,
  }
}

function emptySummary(params: {
  tenantRow: BusinessStatusReportSummary['tenant']
  businessEntity: BusinessStatusReportSummary['businessEntity']
  fiscalYear: number
  eligibility: BusinessStatusEligibility
  blockers: BusinessStatusBlocker[]
}): BusinessStatusReportSummary {
  return {
    tenant: params.tenantRow,
    businessEntity: params.businessEntity,
    fiscalYear: params.fiscalYear,
    eligibility: params.eligibility,
    hero: { preparationPercent: 0, attentionCount: params.blockers.length, revenueTotalKrw: 0, expenseTotalKrw: 0 },
    blockers: params.blockers,
    revenueRows: [],
    expenseRows: [],
    handoffRows: buildBusinessStatusHandoffRows({ revenueTotalKrw: 0, expenseTotalKrw: 0, blockerCount: params.blockers.length }),
  }
}

function sumRows(rows: BusinessStatusAmountRow[]) {
  return rows.reduce((sum, row) => sum + row.amountKrw, 0)
}

function formatKrw(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value)
}
