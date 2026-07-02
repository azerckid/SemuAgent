import { and, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import {
  bookkeepingTransactionClassification,
  client,
  payrollExcelDraft,
  payrollExtractionRow,
  requestItemValidation,
  tenant,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'
import { DateTime as LuxonDateTime, fromISO, now } from '@/lib/time'

export type CompanyHomePeriodKey =
  | `${number}-H1`
  | `${number}-H2`
  | `${number}-Q${1 | 2 | 3 | 4}`
  | `${number}-${string}`
  | `${number}`

export type CompanyHomeTone = 'ok' | 'warn' | 'danger' | 'muted'

export type CompanyHomePeriod = {
  key: CompanyHomePeriodKey
  label: string
  startMonth: string
  endMonth: string
  filingDeadline: string
  dDay: number
  progressPercent: number
}

export type CompanyHomeActionItem = {
  id: string
  title: string
  description: string
  tone: Exclude<CompanyHomeTone, 'muted'>
  count: number
  href: string
  ctaLabel: string
}

export type CompanyHomeWorkspaceCard = {
  id: 'source_collection' | 'bookkeeping' | 'vat' | 'payroll' | 'filing_support' | 'receipts'
  title: string
  valueMain: string
  valueSuffix?: string
  footChip: { label: string; tone: CompanyHomeTone }
  footSub: string
  iconTone: 'amber' | 'blue' | 'green'
  iconGlyph: string
  href: string
}

export type CompanyHomeHeroMeta = {
  readinessPercent: number
  metaLine: string
}

export type CompanyHomeRecentRow = {
  id: string
  kind: 'upload' | 'bookkeeping' | 'vat' | 'payroll' | 'filing_receipt'
  title: string
  periodLabel: string
  statusLabel: string
  statusTone: CompanyHomeTone
  occurredAt: string
  href: string
}

export type CompanyHomeSummary = {
  tenant: {
    id: string
    name: string
    timezone: string
  }
  businessEntity: {
    id: string
    name: string
  } | null
  period: CompanyHomePeriod
  heroMeta: CompanyHomeHeroMeta
  actionItems: CompanyHomeActionItem[]
  workspaceCards: CompanyHomeWorkspaceCard[]
  recentRows: CompanyHomeRecentRow[]
}

export type CompanyHomeCounts = {
  missingMaterialCount: number
  totalMaterialCount: number
  collectedUploadCount: number
  unclassifiedTransactionCount: number
  totalTransactionCount: number
  payrollIssueCount: number
  payrollDraftCount: number
  recentReceiptCount: number
}

type LoadCompanyHomeSummaryParams = {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
}

const ROUTES = {
  sourceCollection: '/dashboard/direct-upload',
  bookkeeping: '/dashboard/bookkeeping',
  vat: '/dashboard/vat',
  payroll: '/dashboard/payroll',
  filingSupport: '/dashboard#filing-support-status',
  receipts: '/dashboard#recent-activity',
}

const DEFAULT_TZ = 'Asia/Seoul'
const MATERIAL_ISSUE_STATUSES = ['missing', 'non_compliant', 'uncertain'] as const
const BOOKKEEPING_ISSUE_STATUSES = ['needs_decision', 'unclassified'] as const
const ACTION_ITEM_ORDER: Record<string, number> = {
  'bookkeeping-unclassified': 0,
  'source-missing': 1,
  'vat-review': 2,
  'payroll-issue': 3,
  'no-blocker': 4,
}

function padMonth(month: number) {
  return String(month).padStart(2, '0')
}

function monthKey(year: number, month: number) {
  return `${year}-${padMonth(month)}`
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function deadlineProgress(start: DateTime, deadline: DateTime, today: DateTime) {
  const total = Math.max(1, deadline.startOf('day').diff(start.startOf('day'), 'days').days)
  const elapsed = today.startOf('day').diff(start.startOf('day'), 'days').days
  return clampPercent((elapsed / total) * 100)
}

function normalizePeriodKey(periodKey: string | null | undefined, today: DateTime): CompanyHomePeriodKey {
  if (periodKey && /^\d{4}-(H[12]|Q[1-4])$/.test(periodKey)) {
    return periodKey as CompanyHomePeriodKey
  }

  const zonedToday = today.setZone(DEFAULT_TZ)
  if (zonedToday.month === 1 && zonedToday.day <= 25) {
    return `${zonedToday.year - 1}-H2`
  }
  if (zonedToday.month <= 7) {
    return `${zonedToday.year}-H1`
  }
  return `${zonedToday.year}-H2`
}

export function buildCompanyHomePeriod(params: {
  periodKey?: string | null
  today?: DateTime
  timezone?: string
} = {}): CompanyHomePeriod {
  const timezone = params.timezone ?? DEFAULT_TZ
  const today = (params.today ?? now(timezone)).setZone(timezone)
  const key = normalizePeriodKey(params.periodKey, today)
  const year = Number(key.slice(0, 4))
  const periodToken = key.slice(5)

  if (periodToken === 'H1') {
    const start = LuxonDateTime.fromObject({ year, month: 1, day: 1 }, { zone: timezone })
    const deadline = LuxonDateTime.fromObject({ year, month: 7, day: 25 }, { zone: timezone })
    return {
      key,
      label: `${year}년 부가세 1기 확정 신고`,
      startMonth: monthKey(year, 1),
      endMonth: monthKey(year, 6),
      filingDeadline: deadline.toISODate() ?? `${year}-07-25`,
      dDay: Math.ceil(deadline.startOf('day').diff(today.startOf('day'), 'days').days),
      progressPercent: deadlineProgress(start, deadline, today),
    }
  }

  if (periodToken === 'H2') {
    const start = LuxonDateTime.fromObject({ year, month: 7, day: 1 }, { zone: timezone })
    const deadline = LuxonDateTime.fromObject({ year: year + 1, month: 1, day: 25 }, { zone: timezone })
    return {
      key,
      label: `${year}년 부가세 2기 확정 신고`,
      startMonth: monthKey(year, 7),
      endMonth: monthKey(year, 12),
      filingDeadline: deadline.toISODate() ?? `${year + 1}-01-25`,
      dDay: Math.ceil(deadline.startOf('day').diff(today.startOf('day'), 'days').days),
      progressPercent: deadlineProgress(start, deadline, today),
    }
  }

  const quarter = Number(periodToken.replace('Q', ''))
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  const start = LuxonDateTime.fromObject({ year, month: startMonth, day: 1 }, { zone: timezone })
  const deadline = start.plus({ months: 3 }).set({ day: 25 })
  return {
    key,
    label: `${year}년 ${quarter}분기 세무 운영`,
    startMonth: monthKey(year, startMonth),
    endMonth: monthKey(year, endMonth),
    filingDeadline: deadline.toISODate() ?? monthKey(year, endMonth),
    dDay: Math.ceil(deadline.startOf('day').diff(today.startOf('day'), 'days').days),
    progressPercent: deadlineProgress(start, deadline, today),
  }
}

export function sortCompanyHomeActionItems(items: CompanyHomeActionItem[]) {
  const toneRank: Record<CompanyHomeActionItem['tone'], number> = {
    danger: 0,
    warn: 1,
    ok: 2,
  }

  return [...items].sort((a, b) => {
    const orderA = ACTION_ITEM_ORDER[a.id] ?? 99
    const orderB = ACTION_ITEM_ORDER[b.id] ?? 99
    if (orderA !== orderB) return orderA - orderB
    return toneRank[a.tone] - toneRank[b.tone] || b.count - a.count || a.title.localeCompare(b.title)
  })
}

export function buildCompanyHomeHeroMeta(counts: CompanyHomeCounts): CompanyHomeHeroMeta {
  const sourceSegment = counts.totalMaterialCount === 0 && counts.collectedUploadCount === 0
    ? '자료수집 대기'
    : counts.missingMaterialCount > 0
      ? '자료수집 진행 중'
      : '자료수집 완료'

  const bookkeepingSegment = counts.totalTransactionCount === 0
    ? '기장검토 대기'
    : counts.unclassifiedTransactionCount > 0
      ? '기장검토 진행 중'
      : '기장검토 완료'

  const vatSegment = counts.totalTransactionCount === 0 || counts.unclassifiedTransactionCount > 0
    ? '부가세 집계 대기'
    : '부가세 검토 준비'

  const sourceProgress = counts.totalMaterialCount > 0
    ? ((counts.totalMaterialCount - counts.missingMaterialCount) / counts.totalMaterialCount) * 100
    : counts.collectedUploadCount > 0
      ? 100
      : 0
  const bookkeepingProgress = counts.totalTransactionCount > 0
    ? ((counts.totalTransactionCount - counts.unclassifiedTransactionCount) / counts.totalTransactionCount) * 100
    : 0
  const vatProgress = counts.unclassifiedTransactionCount === 0 && counts.totalTransactionCount > 0 ? 50 : 0
  const readinessPercent = clampPercent((sourceProgress + bookkeepingProgress + vatProgress) / 3)

  return {
    readinessPercent,
    metaLine: `전체 준비 ${readinessPercent}% · ${sourceSegment} · ${bookkeepingSegment} · ${vatSegment}`,
  }
}

export function buildCompanyHomeActionItems(counts: Pick<
  CompanyHomeCounts,
  'missingMaterialCount' | 'unclassifiedTransactionCount' | 'payrollIssueCount' | 'totalTransactionCount'
>): CompanyHomeActionItem[] {
  const items: CompanyHomeActionItem[] = []

  if (counts.unclassifiedTransactionCount > 0) {
    items.push({
      id: 'bookkeeping-unclassified',
      title: `미검토 거래 ${counts.unclassifiedTransactionCount}건 분류 필요`,
      description: '기장검토에서 계정과목이 확정되지 않은 거래가 있습니다.',
      tone: 'danger',
      count: counts.unclassifiedTransactionCount,
      href: ROUTES.bookkeeping,
      ctaLabel: '기장검토 열기',
    })
  }

  if (counts.missingMaterialCount > 0) {
    items.push({
      id: 'source-missing',
      title: `미수집 자료 ${counts.missingMaterialCount}건`,
      description: '신고 기간에 필요한 자료 중 아직 업로드되지 않은 항목이 있습니다.',
      tone: 'warn',
      count: counts.missingMaterialCount,
      href: ROUTES.sourceCollection,
      ctaLabel: '자료수집 열기',
    })
  }

  if (
    counts.totalTransactionCount > 0
    && counts.unclassifiedTransactionCount === 0
    && counts.missingMaterialCount === 0
  ) {
    items.push({
      id: 'vat-review',
      title: '부가세 매입세액 공제 검토 대기',
      description: '불공제 대상 후보를 확인해야 부가세 집계를 확정할 수 있습니다.',
      tone: 'warn',
      count: 0,
      href: ROUTES.vat,
      ctaLabel: '부가세 열기',
    })
  }

  if (counts.payrollIssueCount > 0) {
    items.push({
      id: 'payroll-issue',
      title: `급여 확인 필요 직원 ${counts.payrollIssueCount}명`,
      description: '원천세·4대보험 확정 전에 급여 행을 확인해야 합니다.',
      tone: 'warn',
      count: counts.payrollIssueCount,
      href: ROUTES.payroll,
      ctaLabel: '급여 열기',
    })
  }

  if (items.length === 0) {
    items.push({
      id: 'no-blocker',
      title: '신고 전 즉시 해결할 blocker가 없습니다',
      description: '각 워크스페이스에서 일반 진행 상태를 이어서 확인하세요.',
      tone: 'ok',
      count: 0,
      href: ROUTES.receipts,
      ctaLabel: '최근 이력 보기',
    })
  }

  return sortCompanyHomeActionItems(items)
}

export function buildCompanyHomeWorkspaceCards(counts: CompanyHomeCounts): CompanyHomeWorkspaceCard[] {
  const collectedMaterialCount = Math.max(0, counts.totalMaterialCount - counts.missingMaterialCount)
  const classifiedTransactionCount = Math.max(0, counts.totalTransactionCount - counts.unclassifiedTransactionCount)
  const classifiedPercent = counts.totalTransactionCount > 0
    ? ((classifiedTransactionCount / counts.totalTransactionCount) * 100).toFixed(1)
    : '0'

  return [
    {
      id: 'source_collection',
      title: '미수집 / 미검토 자료',
      valueMain: counts.totalMaterialCount > 0 ? String(counts.missingMaterialCount) : '0',
      valueSuffix: counts.totalMaterialCount > 0 ? ` / ${counts.totalMaterialCount}건` : undefined,
      footChip: {
        label: counts.missingMaterialCount > 0 ? `${counts.missingMaterialCount}건 미수집` : counts.collectedUploadCount > 0 ? '수집 완료' : '자료 대기',
        tone: counts.missingMaterialCount > 0 ? 'warn' : counts.collectedUploadCount > 0 ? 'ok' : 'muted',
      },
      footSub: counts.totalMaterialCount > 0
        ? `${collectedMaterialCount}건 수집 완료`
        : counts.collectedUploadCount > 0
          ? `${counts.collectedUploadCount}건 업로드`
          : '업로드 후 집계',
      iconTone: 'amber',
      iconGlyph: '↥',
      href: ROUTES.sourceCollection,
    },
    {
      id: 'bookkeeping',
      title: '분류 대기 큐',
      valueMain: counts.totalTransactionCount > 0 ? String(counts.unclassifiedTransactionCount) : '0',
      valueSuffix: counts.totalTransactionCount > 0 ? ` / ${counts.totalTransactionCount}건` : undefined,
      footChip: {
        label: counts.unclassifiedTransactionCount > 0
          ? `${counts.unclassifiedTransactionCount}건 미분류`
          : counts.totalTransactionCount > 0
            ? '분류 완료'
            : '거래 대기',
        tone: counts.unclassifiedTransactionCount > 0 ? 'danger' : counts.totalTransactionCount > 0 ? 'ok' : 'muted',
      },
      footSub: counts.totalTransactionCount > 0 ? `${classifiedPercent}% 분류됨` : '거래 추출 후 시작',
      iconTone: 'blue',
      iconGlyph: '▤',
      href: ROUTES.bookkeeping,
    },
    {
      id: 'vat',
      title: '부가세 준비',
      valueMain: '집계 대기',
      footChip: {
        label: counts.unclassifiedTransactionCount > 0 ? '기장 확정 후 산출' : '공제 검토 대기',
        tone: 'warn',
      },
      footSub: '매출·매입 자료 확보',
      iconTone: 'blue',
      iconGlyph: '％',
      href: ROUTES.vat,
    },
    {
      id: 'payroll',
      title: '급여 준비',
      valueMain: counts.payrollIssueCount > 0
        ? `${counts.payrollIssueCount}명`
        : counts.payrollDraftCount > 0
          ? '완료'
          : '대기',
      footChip: {
        label: counts.payrollIssueCount > 0
          ? '확인 필요'
          : counts.payrollDraftCount > 0
            ? '급여 초안 생성'
            : '급여 대기',
        tone: counts.payrollIssueCount > 0 ? 'warn' : counts.payrollDraftCount > 0 ? 'ok' : 'muted',
      },
      footSub: counts.payrollIssueCount > 0
        ? `${counts.payrollIssueCount}명 확인 필요`
        : counts.payrollDraftCount > 0
          ? `초안 ${counts.payrollDraftCount}건`
          : '급여 자료 수집 후 시작',
      iconTone: 'green',
      iconGlyph: '₩',
      href: ROUTES.payroll,
    },
    {
      id: 'filing_support',
      title: '신고자료 패키지',
      valueMain: '미생성',
      footChip: { label: '선행 항목 대기', tone: 'muted' },
      footSub: '기장·부가세 확정 후 생성',
      iconTone: 'blue',
      iconGlyph: '↧',
      href: ROUTES.filingSupport,
    },
    {
      id: 'receipts',
      title: '최근 제출 · 영수증',
      valueMain: String(counts.recentReceiptCount),
      valueSuffix: ' 건',
      footChip: {
        label: counts.recentReceiptCount > 0 ? '보관 완료' : '이력 없음',
        tone: counts.recentReceiptCount > 0 ? 'ok' : 'muted',
      },
      footSub: '최근 30일',
      iconTone: 'green',
      iconGlyph: '◫',
      href: ROUTES.receipts,
    },
  ]
}

export function monthInPeriod(month: string, period: Pick<CompanyHomePeriod, 'startMonth' | 'endMonth'>) {
  return month >= period.startMonth && month <= period.endMonth
}

function countValue(rows: Array<{ value: number | string | bigint | null }>) {
  const value = rows[0]?.value ?? 0
  return Number(value)
}

function periodLabel(month: string | null) {
  if (!month) return '-'
  const [year, monthPart] = month.split('-')
  if (!year || !monthPart) return month
  return `${year}.${monthPart}`
}

function formatDate(value: string) {
  const parsed = fromISO(value)
  return parsed.isValid ? parsed.toISODate() ?? value.slice(0, 10) : value.slice(0, 10)
}

function uploadStatusLabel(status: string) {
  return {
    uploaded: '업로드 완료',
    analyzing: '분석 중',
    matched: '정규화 완료',
    needs_review: '확인 필요',
    rejected: '제외됨',
    failed: '분석 실패',
  }[status] ?? status
}

function uploadStatusTone(status: string): CompanyHomeTone {
  if (status === 'matched' || status === 'uploaded') return 'ok'
  if (status === 'needs_review' || status === 'analyzing') return 'warn'
  if (status === 'failed' || status === 'rejected') return 'danger'
  return 'muted'
}

function payrollDraftStatusLabel(status: string) {
  return status === 'generated' ? '초안 생성' : '생성 실패'
}

function payrollDraftStatusTone(status: string): CompanyHomeTone {
  return status === 'generated' ? 'ok' : 'danger'
}

export async function loadCompanyHomeSummary({
  tenantId,
  periodKey,
  today,
}: LoadCompanyHomeSummaryParams): Promise<CompanyHomeSummary> {
  const { db } = await import('@/lib/db')
  const tenantRows = await db
    .select({
      id: tenant.id,
      name: tenant.name,
      timezone: tenant.timezone,
    })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)

  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }
  const period = buildCompanyHomePeriod({
    periodKey,
    today,
    timezone: tenantRow.timezone,
  })

  const businessEntityRows = await db
    .select({
      id: client.id,
      name: client.name,
    })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(client.createdAt)
    .limit(1)

  const businessEntity = businessEntityRows[0] ?? null
  const baseSummary = {
    tenant: tenantRow,
    businessEntity,
    period,
  }

  if (!businessEntity) {
    const counts: CompanyHomeCounts = {
      missingMaterialCount: 0,
      totalMaterialCount: 0,
      collectedUploadCount: 0,
      unclassifiedTransactionCount: 0,
      totalTransactionCount: 0,
      payrollIssueCount: 0,
      payrollDraftCount: 0,
      recentReceiptCount: 0,
    }
    return {
      ...baseSummary,
      heroMeta: buildCompanyHomeHeroMeta(counts),
      actionItems: buildCompanyHomeActionItems(counts),
      workspaceCards: buildCompanyHomeWorkspaceCards(counts),
      recentRows: [],
    }
  }

  const scopedSession = and(
    eq(uploadSession.tenantId, tenantId),
    eq(uploadSession.clientId, businessEntity.id),
    isNull(uploadSession.deletedAt),
    gte(uploadSession.accountingPeriod, period.startMonth),
    lte(uploadSession.accountingPeriod, period.endMonth),
  )

  const [
    missingMaterialRows,
    totalMaterialRows,
    collectedUploadRows,
    unclassifiedTransactionRows,
    totalTransactionRows,
    payrollIssueRows,
    payrollDraftRows,
    recentUploadRows,
    recentPayrollDraftRows,
  ] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)` })
      .from(requestItemValidation)
      .innerJoin(uploadSession, and(eq(requestItemValidation.uploadSessionId, uploadSession.id), scopedSession))
      .where(and(
        eq(requestItemValidation.tenantId, tenantId),
        inArray(requestItemValidation.validationStatus, MATERIAL_ISSUE_STATUSES),
        ne(requestItemValidation.reviewStatus, 'excluded'),
      )),
    db
      .select({ value: sql<number>`count(*)` })
      .from(requestItemValidation)
      .innerJoin(uploadSession, and(eq(requestItemValidation.uploadSessionId, uploadSession.id), scopedSession))
      .where(and(
        eq(requestItemValidation.tenantId, tenantId),
        ne(requestItemValidation.reviewStatus, 'excluded'),
      )),
    db
      .select({ value: sql<number>`count(*)` })
      .from(uploadFile)
      .innerJoin(uploadSession, and(eq(uploadFile.uploadSessionId, uploadSession.id), scopedSession))
      .where(and(
        eq(uploadFile.tenantId, tenantId),
        eq(uploadSession.source, 'staff_direct'),
        ne(uploadFile.staffReviewStatus, 'excluded'),
      )),
    db
      .select({ value: sql<number>`count(*)` })
      .from(bookkeepingTransactionClassification)
      .innerJoin(uploadSession, and(eq(bookkeepingTransactionClassification.uploadSessionId, uploadSession.id), scopedSession))
      .where(and(
        eq(bookkeepingTransactionClassification.tenantId, tenantId),
        inArray(bookkeepingTransactionClassification.status, BOOKKEEPING_ISSUE_STATUSES),
      )),
    db
      .select({ value: sql<number>`count(*)` })
      .from(bookkeepingTransactionClassification)
      .innerJoin(uploadSession, and(eq(bookkeepingTransactionClassification.uploadSessionId, uploadSession.id), scopedSession))
      .where(and(
        eq(bookkeepingTransactionClassification.tenantId, tenantId),
        ne(bookkeepingTransactionClassification.status, 'excluded'),
      )),
    db
      .select({ value: sql<number>`count(*)` })
      .from(payrollExtractionRow)
      .innerJoin(uploadSession, and(eq(payrollExtractionRow.uploadSessionId, uploadSession.id), scopedSession))
      .where(and(
        eq(payrollExtractionRow.tenantId, tenantId),
        eq(payrollExtractionRow.aiVerdict, 'fail'),
        ne(payrollExtractionRow.reviewStatus, 'excluded'),
        gte(payrollExtractionRow.payrollPeriod, period.startMonth),
        lte(payrollExtractionRow.payrollPeriod, period.endMonth),
      )),
    db
      .select({ value: sql<number>`count(*)` })
      .from(payrollExcelDraft)
      .innerJoin(uploadSession, and(eq(payrollExcelDraft.uploadSessionId, uploadSession.id), scopedSession))
      .where(eq(payrollExcelDraft.tenantId, tenantId)),
    db
      .select({
        id: uploadFile.id,
        status: uploadFile.status,
        fileType: uploadFile.fileType,
        uploadedAt: uploadFile.uploadedAt,
        accountingPeriod: uploadSession.accountingPeriod,
      })
      .from(uploadFile)
      .innerJoin(uploadSession, and(eq(uploadFile.uploadSessionId, uploadSession.id), scopedSession))
      .where(and(
        eq(uploadFile.tenantId, tenantId),
        eq(uploadSession.source, 'staff_direct'),
        ne(uploadFile.staffReviewStatus, 'excluded'),
      ))
      .orderBy(desc(uploadFile.uploadedAt))
      .limit(4),
    db
      .select({
        id: payrollExcelDraft.id,
        status: payrollExcelDraft.status,
        generatedAt: payrollExcelDraft.generatedAt,
        accountingPeriod: uploadSession.accountingPeriod,
      })
      .from(payrollExcelDraft)
      .innerJoin(uploadSession, and(eq(payrollExcelDraft.uploadSessionId, uploadSession.id), scopedSession))
      .where(eq(payrollExcelDraft.tenantId, tenantId))
      .orderBy(desc(payrollExcelDraft.generatedAt))
      .limit(2),
  ])

  const recentRows = [
    ...recentUploadRows.map((row): CompanyHomeRecentRow => ({
      id: `upload-${row.id}`,
      kind: 'upload',
      title: `${row.fileType.toUpperCase()} 자료 업로드`,
      periodLabel: periodLabel(row.accountingPeriod),
      statusLabel: uploadStatusLabel(row.status),
      statusTone: uploadStatusTone(row.status),
      occurredAt: formatDate(row.uploadedAt),
      href: ROUTES.bookkeeping,
    })),
    ...recentPayrollDraftRows.map((row): CompanyHomeRecentRow => ({
      id: `payroll-${row.id}`,
      kind: 'payroll',
      title: '급여 엑셀 초안',
      periodLabel: periodLabel(row.accountingPeriod),
      statusLabel: payrollDraftStatusLabel(row.status),
      statusTone: payrollDraftStatusTone(row.status),
      occurredAt: formatDate(row.generatedAt),
      href: ROUTES.payroll,
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 5)

  const counts: CompanyHomeCounts = {
    missingMaterialCount: countValue(missingMaterialRows),
    totalMaterialCount: countValue(totalMaterialRows),
    collectedUploadCount: countValue(collectedUploadRows),
    unclassifiedTransactionCount: countValue(unclassifiedTransactionRows),
    totalTransactionCount: countValue(totalTransactionRows),
    payrollIssueCount: countValue(payrollIssueRows),
    payrollDraftCount: countValue(payrollDraftRows),
    recentReceiptCount: recentRows.length,
  }

  return {
    ...baseSummary,
    heroMeta: buildCompanyHomeHeroMeta(counts),
    actionItems: buildCompanyHomeActionItems(counts),
    workspaceCards: buildCompanyHomeWorkspaceCards(counts),
    recentRows,
  }
}
