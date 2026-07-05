import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import { buildCompanyHomePeriod, type CompanyHomePeriod } from '@/lib/company-home/summary'
import {
  bookkeepingClassificationRun,
  bookkeepingJournalEntryVoucher,
  bookkeepingJournalEntryVoucherLine,
  bookkeepingTransactionClassification,
  client,
  tenant,
} from '@/lib/db/schema'
import { resolveActiveSourceBatchSessionIds } from '@/lib/source-batch/scope'

export { sessionPeriodOverlapsCompanyPeriod, type SessionPeriodInput } from '@/lib/source-batch/scope'

export type BookkeepingReviewConfidence = 'high' | 'medium' | 'low'
export type BookkeepingReviewRowStatus =
  | 'suggested'
  | 'needs_decision'
  | 'confirmed'
  | 'unclassified'
  | 'excluded'
export type BookkeepingReviewTab = 'pending' | 'low_confidence' | 'confirmed' | 'all'
export type BookkeepingReviewTone = 'ok' | 'warn' | 'danger' | 'muted'

export type BookkeepingReviewQueueRow = {
  id: string
  uploadSessionId: string
  transactionDate: string | null
  description: string
  counterparty: string | null
  amountKrw: number | null
  recommendedAccount: string | null
  finalAccount: string | null
  confidence: BookkeepingReviewConfidence
  confidenceTone: BookkeepingReviewTone
  status: BookkeepingReviewRowStatus
  requiresManualAccount: boolean
}

export type BookkeepingReviewCounts = {
  pending: number
  lowConfidence: number
  confirmed: number
  total: number
}

export type BookkeepingReviewJournalEntry = {
  lines: Array<{ side: '차변' | '대변'; account: string; amountKrw: number }>
  debitTotal: number
  creditTotal: number
  balanced: boolean
}

export type BookkeepingReviewSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: CompanyHomePeriod
  tab: BookkeepingReviewTab
  counts: BookkeepingReviewCounts
  rows: BookkeepingReviewQueueRow[]
  selected: {
    row: BookkeepingReviewQueueRow
    journalEntry: BookkeepingReviewJournalEntry | null
    attribution: { periodLabel: string | null; evidenceType: string | null; vatDeductible: boolean | null }
  } | null
}

type ClassificationRowInput = {
  id: string
  uploadSessionId: string
  transactionDate: string | null
  merchantName: string | null
  description: string | null
  amountKrw: number | null
  recommendedAccount: string | null
  finalAccount: string | null
  recommendationConfidence: string
  status: string
}

type VoucherLineInput = { side: string; accountName: string | null; accountCode: string | null; amountKrw: number }

type ClassificationRunInput = {
  id: string
  uploadSessionId: string
  status: string
  createdAt: string
}

type LoadBookkeepingReviewSummaryParams = {
  tenantId: string
  periodKey?: string | null
  tab?: string | null
  selectedRowId?: string | null
  today?: DateTime
}

const DEFAULT_TZ = 'Asia/Seoul'
const CONFIDENCE_TONE: Record<string, BookkeepingReviewTone> = {
  high: 'ok',
  medium: 'warn',
  low: 'danger',
}

export function normalizeConfidence(value: string | null | undefined): BookkeepingReviewConfidence {
  return value === 'high' || value === 'medium' ? value : 'low'
}

export function confidenceTone(confidence: BookkeepingReviewConfidence): BookkeepingReviewTone {
  return CONFIDENCE_TONE[confidence] ?? 'danger'
}

// 신뢰도 low & 미확정이면 승인 전 "계정 지정"으로 강제 확인시킨다.
export function requiresManualAccount(confidence: BookkeepingReviewConfidence, status: string): boolean {
  return confidence === 'low' && status !== 'confirmed'
}

export function resolveBookkeepingReviewTab(value: string | null | undefined): BookkeepingReviewTab {
  return value === 'low_confidence' || value === 'confirmed' || value === 'all'
    ? value
    : 'pending'
}

export function mapClassificationRow(row: ClassificationRowInput): BookkeepingReviewQueueRow {
  const confidence = normalizeConfidence(row.recommendationConfidence)
  return {
    id: row.id,
    uploadSessionId: row.uploadSessionId,
    transactionDate: row.transactionDate,
    description: row.description ?? row.merchantName ?? '거래 내용 미상',
    counterparty: row.merchantName,
    amountKrw: row.amountKrw,
    recommendedAccount: row.recommendedAccount,
    finalAccount: row.finalAccount,
    confidence,
    confidenceTone: confidenceTone(confidence),
    status: (row.status as BookkeepingReviewRowStatus) ?? 'suggested',
    requiresManualAccount: requiresManualAccount(confidence, row.status),
  }
}

export function buildBookkeepingReviewCounts(rows: BookkeepingReviewQueueRow[]): BookkeepingReviewCounts {
  let pending = 0
  let lowConfidence = 0
  let confirmed = 0
  for (const row of rows) {
    if (row.status === 'excluded') continue
    if (row.status === 'suggested' || row.status === 'needs_decision' || row.status === 'unclassified') pending += 1
    if (row.confidence === 'low' && row.status !== 'confirmed') lowConfidence += 1
    if (row.status === 'confirmed') confirmed += 1
  }
  const total = rows.filter((row) => row.status !== 'excluded').length
  return { pending, lowConfidence, confirmed, total }
}

export function filterRowsByTab(rows: BookkeepingReviewQueueRow[], tab: BookkeepingReviewTab): BookkeepingReviewQueueRow[] {
  const active = rows.filter((row) => row.status !== 'excluded')
  switch (tab) {
    case 'pending':
      return active.filter((row) => row.status === 'suggested' || row.status === 'needs_decision' || row.status === 'unclassified')
    case 'low_confidence':
      return active.filter((row) => row.confidence === 'low' && row.status !== 'confirmed')
    case 'confirmed':
      return active.filter((row) => row.status === 'confirmed')
    case 'all':
    default:
      return active
  }
}

// 분개 균형은 차변 합계 = 대변 합계 여부를 파생한다(하드코딩 금지).
export function buildJournalEntry(lines: VoucherLineInput[]): BookkeepingReviewJournalEntry | null {
  if (lines.length === 0) return null
  const mapped = lines.map((line) => ({
    side: (line.side === 'debit' ? '차변' : '대변') as '차변' | '대변',
    account: line.accountName ?? line.accountCode ?? '미지정',
    amountKrw: line.amountKrw,
  }))
  const debitTotal = mapped.filter((l) => l.side === '차변').reduce((sum, l) => sum + l.amountKrw, 0)
  const creditTotal = mapped.filter((l) => l.side === '대변').reduce((sum, l) => sum + l.amountKrw, 0)
  return { lines: mapped, debitTotal, creditTotal, balanced: debitTotal === creditTotal }
}

export function pickLatestCompletedRunIdsBySession(runs: ClassificationRunInput[]) {
  const latestBySession = new Map<string, ClassificationRunInput>()
  for (const run of runs) {
    if (run.status !== 'completed') continue
    const current = latestBySession.get(run.uploadSessionId)
    if (
      !current ||
      run.createdAt > current.createdAt ||
      (run.createdAt === current.createdAt && run.id > current.id)
    ) {
      latestBySession.set(run.uploadSessionId, run)
    }
  }
  return [...latestBySession.values()].map((run) => run.id)
}

export function selectBookkeepingReviewRowForDetail(
  rows: BookkeepingReviewQueueRow[],
  selectedRowId?: string | null,
) {
  if (rows.length === 0) return null
  return selectedRowId ? rows.find((row) => row.id === selectedRowId) ?? rows[0] : rows[0]
}

export async function loadBookkeepingReviewSummary({
  tenantId,
  periodKey,
  tab,
  selectedRowId,
  today,
}: LoadBookkeepingReviewSummaryParams): Promise<BookkeepingReviewSummary> {
  const { db } = await import('@/lib/db')
  const resolvedTab = resolveBookkeepingReviewTab(tab)

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }
  const period = buildCompanyHomePeriod({ periodKey, today, timezone: tenantRow.timezone })

  const businessEntityRows = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(client.createdAt)
    .limit(1)
  const businessEntity = businessEntityRows[0] ?? null
  const base = { tenant: tenantRow, businessEntity, period, tab: resolvedTab }

  if (!businessEntity) {
    return {
      ...base,
      counts: { pending: 0, lowConfidence: 0, confirmed: 0, total: 0 },
      rows: [],
      selected: null,
    }
  }

  const sessionIds = await resolveActiveSourceBatchSessionIds({
    tenantId,
    clientId: businessEntity.id,
    period,
  })

  if (sessionIds.length === 0) {
    return {
      ...base,
      counts: { pending: 0, lowConfidence: 0, confirmed: 0, total: 0 },
      rows: [],
      selected: null,
    }
  }

  const runRows = await db
    .select({
      id: bookkeepingClassificationRun.id,
      uploadSessionId: bookkeepingClassificationRun.uploadSessionId,
      status: bookkeepingClassificationRun.status,
      createdAt: bookkeepingClassificationRun.createdAt,
    })
    .from(bookkeepingClassificationRun)
    .where(and(
      eq(bookkeepingClassificationRun.tenantId, tenantId),
      eq(bookkeepingClassificationRun.status, 'completed'),
      inArray(bookkeepingClassificationRun.uploadSessionId, sessionIds),
    ))
    .orderBy(desc(bookkeepingClassificationRun.createdAt), desc(bookkeepingClassificationRun.id))

  const latestRunIds = pickLatestCompletedRunIdsBySession(runRows)

  if (latestRunIds.length === 0) {
    return {
      ...base,
      counts: { pending: 0, lowConfidence: 0, confirmed: 0, total: 0 },
      rows: [],
      selected: null,
    }
  }

  const classificationRows = await db
    .select({
      id: bookkeepingTransactionClassification.id,
      uploadSessionId: bookkeepingTransactionClassification.uploadSessionId,
      transactionDate: bookkeepingTransactionClassification.transactionDate,
      merchantName: bookkeepingTransactionClassification.merchantName,
      description: bookkeepingTransactionClassification.description,
      amountKrw: bookkeepingTransactionClassification.amountKrw,
      recommendedAccount: bookkeepingTransactionClassification.recommendedAccount,
      finalAccount: bookkeepingTransactionClassification.finalAccount,
      recommendationConfidence: bookkeepingTransactionClassification.recommendationConfidence,
      status: bookkeepingTransactionClassification.status,
    })
    .from(bookkeepingTransactionClassification)
    .where(and(
      eq(bookkeepingTransactionClassification.tenantId, tenantId),
      inArray(bookkeepingTransactionClassification.classificationRunId, latestRunIds),
      ne(bookkeepingTransactionClassification.status, 'excluded'),
    ))
    .orderBy(
      desc(bookkeepingTransactionClassification.transactionDate),
      desc(bookkeepingTransactionClassification.createdAt),
      desc(bookkeepingTransactionClassification.id),
    )

  const rows = classificationRows.map(mapClassificationRow)
  const counts = buildBookkeepingReviewCounts(rows)
  const tabRows = filterRowsByTab(rows, resolvedTab)

  const selectedRow = selectBookkeepingReviewRowForDetail(tabRows, selectedRowId)

  let selected: BookkeepingReviewSummary['selected'] = null
  if (selectedRow) {
    const voucherLines = await db
      .select({
        side: bookkeepingJournalEntryVoucherLine.side,
        accountName: bookkeepingJournalEntryVoucherLine.accountName,
        accountCode: bookkeepingJournalEntryVoucherLine.accountCode,
        amountKrw: bookkeepingJournalEntryVoucherLine.amountKrw,
      })
      .from(bookkeepingJournalEntryVoucher)
      .innerJoin(
        bookkeepingJournalEntryVoucherLine,
        and(
          eq(bookkeepingJournalEntryVoucherLine.voucherId, bookkeepingJournalEntryVoucher.id),
          eq(bookkeepingJournalEntryVoucherLine.tenantId, tenantId),
        ),
      )
      .where(and(
        eq(bookkeepingJournalEntryVoucher.tenantId, tenantId),
        eq(bookkeepingJournalEntryVoucher.classificationRowId, selectedRow.id),
        ne(bookkeepingJournalEntryVoucher.status, 'excluded'),
      ))
      .orderBy(bookkeepingJournalEntryVoucherLine.lineSequence)

    selected = {
      row: selectedRow,
      journalEntry: buildJournalEntry(voucherLines),
      attribution: {
        periodLabel: selectedRow.transactionDate?.slice(0, 7) ?? null,
        evidenceType: null,
        vatDeductible: null,
      },
    }
  }

  return { ...base, counts, rows: tabRows, selected }
}

export async function loadBookkeepingReviewPendingCount(tenantId: string): Promise<number> {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const timezone = tenantRows[0]?.timezone ?? DEFAULT_TZ
  const period = buildCompanyHomePeriod({ timezone })

  const businessEntityRows = await db
    .select({ id: client.id })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(client.createdAt)
    .limit(1)
  const businessEntity = businessEntityRows[0] ?? null
  if (!businessEntity) return 0

  const sessionIds = await resolveActiveSourceBatchSessionIds({
    tenantId,
    clientId: businessEntity.id,
    period,
  })
  if (sessionIds.length === 0) return 0

  const runRows = await db
    .select({
      id: bookkeepingClassificationRun.id,
      uploadSessionId: bookkeepingClassificationRun.uploadSessionId,
      status: bookkeepingClassificationRun.status,
      createdAt: bookkeepingClassificationRun.createdAt,
    })
    .from(bookkeepingClassificationRun)
    .where(and(
      eq(bookkeepingClassificationRun.tenantId, tenantId),
      eq(bookkeepingClassificationRun.status, 'completed'),
      inArray(bookkeepingClassificationRun.uploadSessionId, sessionIds),
    ))
    .orderBy(desc(bookkeepingClassificationRun.createdAt), desc(bookkeepingClassificationRun.id))

  const latestRunIds = pickLatestCompletedRunIdsBySession(runRows)
  if (latestRunIds.length === 0) return 0

  const statusRows = await db
    .select({ status: bookkeepingTransactionClassification.status })
    .from(bookkeepingTransactionClassification)
    .where(and(
      eq(bookkeepingTransactionClassification.tenantId, tenantId),
      inArray(bookkeepingTransactionClassification.classificationRunId, latestRunIds),
      ne(bookkeepingTransactionClassification.status, 'excluded'),
    ))

  return statusRows.filter((row) => (
    row.status === 'suggested' ||
    row.status === 'needs_decision' ||
    row.status === 'unclassified'
  )).length
}
