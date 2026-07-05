import { createHash, randomUUID } from 'crypto'
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingClassificationRun,
  bookkeepingFiscalYearLedger,
  bookkeepingJournalEntryRun,
  bookkeepingJournalEntryRow,
  bookkeepingJournalEntryVoucher,
  bookkeepingLedgerMaterialLink,
  bookkeepingLedgerMonth,
  bookkeepingMaterialAttribution,
  client,
  uploadSession,
} from '@/lib/db/schema'
import { listActiveSourceBatchSessions, type SourceBatchSessionRow } from '@/lib/source-batch/scope'
import { DateTime, now, toDBString } from '@/lib/time'
import {
  periodFromAttributionValue,
  resolveBookkeepingPeriodRangeSnapshot,
  type BookkeepingPeriodRange,
} from './period-range'
import {
  buildFiscalYearMonths,
  deriveFiscalLedgerMonthStatus,
  type FiscalLedgerMonthStatus,
} from './fiscal-year-ledger-rules'

export type FiscalLedgerMonthSummary = {
  id: string
  periodMonth: string
  status: FiscalLedgerMonthStatus
  lastUploadSessionId: string | null
  lastMaterialAttributionRunAt: string | null
  lastClassificationRunId: string | null
  lastJournalEntryRunId: string | null
  counts: {
    sessionCount: number
    includedMaterialCount: number
    completedClassificationRunCount: number
    journalEntryRunCount: number
  }
}

type SessionSnapshot = SourceBatchSessionRow

type ClientLedgerSummaryParams = {
  tenantId: string
  clientId: string
  fiscalYear: number
}

const JOURNAL_PRESENT_STATUSES = new Set(['draft', 'completed'])

function maxText(current: string | null, next: string | null | undefined) {
  if (!next) return current
  if (!current) return next
  return next > current ? next : current
}

function rangeMonthsInsideFiscalYear(range: BookkeepingPeriodRange | null, fiscalYear: number) {
  if (!range) return []
  const yearStart = `${fiscalYear}-01`
  const yearEnd = `${fiscalYear}-12`
  const start = range.start > yearStart ? range.start : yearStart
  const end = range.end < yearEnd ? range.end : yearEnd
  if (start > end) return []

  const startDate = DateTime.fromFormat(`${start}-01`, 'yyyy-MM-dd', { zone: 'Asia/Seoul' })
  const endDate = DateTime.fromFormat(`${end}-01`, 'yyyy-MM-dd', { zone: 'Asia/Seoul' })
  if (!startDate.isValid || !endDate.isValid) return []

  const months: string[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    months.push(cursor.toFormat('yyyy-MM'))
    cursor = cursor.plus({ months: 1 })
  }
  return months
}

function sessionRangeMonths(session: SessionSnapshot, fiscalYear: number) {
  return rangeMonthsInsideFiscalYear(
    resolveBookkeepingPeriodRangeSnapshot({
      accountingPeriod: session.accountingPeriod,
      bookkeepingPeriodType: session.bookkeepingPeriodType,
      bookkeepingPeriodStart: session.bookkeepingPeriodStart,
      bookkeepingPeriodEnd: session.bookkeepingPeriodEnd,
    }),
    fiscalYear,
  )
}

function isIncludedAttribution(row: typeof bookkeepingMaterialAttribution.$inferSelect) {
  return (row.staffDecision ?? row.recommendation) === 'include'
}

async function ensureFiscalLedgerAndMonths(params: ClientLedgerSummaryParams) {
  const timestamp = toDBString(now())
  await db
    .insert(bookkeepingFiscalYearLedger)
    .values({
      id: randomUUID(),
      tenantId: params.tenantId,
      clientId: params.clientId,
      fiscalYear: params.fiscalYear,
      status: 'open',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoNothing({
      target: [
        bookkeepingFiscalYearLedger.tenantId,
        bookkeepingFiscalYearLedger.clientId,
        bookkeepingFiscalYearLedger.fiscalYear,
      ],
    })

  const [ledger] = await db
    .select()
    .from(bookkeepingFiscalYearLedger)
    .where(
      and(
        eq(bookkeepingFiscalYearLedger.tenantId, params.tenantId),
        eq(bookkeepingFiscalYearLedger.clientId, params.clientId),
        eq(bookkeepingFiscalYearLedger.fiscalYear, params.fiscalYear),
      ),
    )
    .limit(1)

  if (!ledger) throw new Error('Failed to create fiscal year ledger')

  const months = buildFiscalYearMonths(params.fiscalYear)
  const existingMonths = await db
    .select({ periodMonth: bookkeepingLedgerMonth.periodMonth })
    .from(bookkeepingLedgerMonth)
    .where(and(eq(bookkeepingLedgerMonth.tenantId, params.tenantId), eq(bookkeepingLedgerMonth.ledgerId, ledger.id)))

  const existing = new Set(existingMonths.map((row) => row.periodMonth))
  const missing = months.filter((periodMonth) => !existing.has(periodMonth))

  if (missing.length > 0) {
    await db
      .insert(bookkeepingLedgerMonth)
      .values(missing.map((periodMonth) => ({
        id: randomUUID(),
        tenantId: params.tenantId,
        ledgerId: ledger.id,
        periodMonth,
        status: 'not_requested' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      })))
      .onConflictDoNothing({
        target: [
          bookkeepingLedgerMonth.tenantId,
          bookkeepingLedgerMonth.ledgerId,
          bookkeepingLedgerMonth.periodMonth,
        ],
      })
  }

  return ledger
}

export async function getOrCreateFiscalYearLedgerSummary(params: ClientLedgerSummaryParams) {
  const [clientRow] = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(and(eq(client.id, params.clientId), eq(client.tenantId, params.tenantId)))
    .limit(1)

  if (!clientRow) return null

  const ledger = await ensureFiscalLedgerAndMonths(params)
  const periodMonths = buildFiscalYearMonths(params.fiscalYear)
  const monthSignals = new Map<string, {
    sessionIds: Set<string>
    includedSessionIds: Set<string>
    includedMaterialCount: number
    lastUploadSessionId: string | null
    lastUploadSessionCreatedAt: string | null
    lastMaterialAttributionRunAt: string | null
    lastClassificationRunId: string | null
    lastClassificationRunCreatedAt: string | null
    completedClassificationSessionIds: Set<string>
    journalSessionIds: Set<string>
    lastJournalEntryRunId: string | null
    lastJournalEntryRunCreatedAt: string | null
  }>()

  for (const periodMonth of periodMonths) {
    monthSignals.set(periodMonth, {
      sessionIds: new Set(),
      includedSessionIds: new Set(),
      includedMaterialCount: 0,
      lastUploadSessionId: null,
      lastUploadSessionCreatedAt: null,
      lastMaterialAttributionRunAt: null,
      lastClassificationRunId: null,
      lastClassificationRunCreatedAt: null,
      completedClassificationSessionIds: new Set(),
      journalSessionIds: new Set(),
      lastJournalEntryRunId: null,
      lastJournalEntryRunCreatedAt: null,
    })
  }

  const sessionRows = [...await listActiveSourceBatchSessions({
    tenantId: params.tenantId,
    clientId: params.clientId,
  })].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const sessionById = new Map(sessionRows.map((session) => [session.id, session]))

  for (const session of sessionRows) {
    for (const periodMonth of sessionRangeMonths(session, params.fiscalYear)) {
      const signals = monthSignals.get(periodMonth)
      if (!signals) continue
      signals.sessionIds.add(session.id)
      if (!signals.lastUploadSessionCreatedAt || session.createdAt > signals.lastUploadSessionCreatedAt) {
        signals.lastUploadSessionId = session.id
        signals.lastUploadSessionCreatedAt = session.createdAt
      }
    }
  }

  const sessionIds = sessionRows.map((session) => session.id)
  const attributionRows = sessionIds.length > 0
    ? await db
        .select()
        .from(bookkeepingMaterialAttribution)
        .where(
          and(
            eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
            eq(bookkeepingMaterialAttribution.status, 'active'),
            inArray(bookkeepingMaterialAttribution.uploadSessionId, sessionIds),
          ),
        )
    : []

  for (const row of attributionRows) {
    if (!isIncludedAttribution(row)) continue
    const periodMonth = periodFromAttributionValue(row)
    if (!periodMonth || !monthSignals.has(periodMonth)) continue
    const signals = monthSignals.get(periodMonth)!
    signals.includedMaterialCount += 1
    signals.includedSessionIds.add(row.uploadSessionId)
    signals.lastMaterialAttributionRunAt = maxText(signals.lastMaterialAttributionRunAt, row.updatedAt ?? row.createdAt)
    signals.sessionIds.add(row.uploadSessionId)
    const sourceSession = sessionById.get(row.uploadSessionId)
    if (
      sourceSession &&
      (!signals.lastUploadSessionCreatedAt || sourceSession.createdAt > signals.lastUploadSessionCreatedAt)
    ) {
      signals.lastUploadSessionId = sourceSession.id
      signals.lastUploadSessionCreatedAt = sourceSession.createdAt
    }
  }

  const classificationRows = sessionIds.length > 0
    ? await db
        .select()
        .from(bookkeepingClassificationRun)
        .where(
          and(
            eq(bookkeepingClassificationRun.tenantId, params.tenantId),
            ne(bookkeepingClassificationRun.status, 'superseded'),
            inArray(bookkeepingClassificationRun.uploadSessionId, sessionIds),
          ),
        )
        .orderBy(desc(bookkeepingClassificationRun.createdAt))
    : []

  for (const run of classificationRows) {
    for (const signals of monthSignals.values()) {
      if (!signals.includedSessionIds.has(run.uploadSessionId)) continue
      if (!signals.lastClassificationRunCreatedAt || run.createdAt > signals.lastClassificationRunCreatedAt) {
        signals.lastClassificationRunId = run.id
        signals.lastClassificationRunCreatedAt = run.createdAt
      }
      if (run.status === 'completed') {
        signals.completedClassificationSessionIds.add(run.uploadSessionId)
      }
    }
  }

  const journalRows = sessionIds.length > 0
    ? await db
        .select()
        .from(bookkeepingJournalEntryRun)
        .where(
          and(
            eq(bookkeepingJournalEntryRun.tenantId, params.tenantId),
            ne(bookkeepingJournalEntryRun.status, 'superseded'),
            inArray(bookkeepingJournalEntryRun.uploadSessionId, sessionIds),
          ),
        )
        .orderBy(desc(bookkeepingJournalEntryRun.createdAt))
    : []

  const presentJournalRuns = journalRows.filter((run) => JOURNAL_PRESENT_STATUSES.has(run.status))
  const presentJournalRunById = new Map(presentJournalRuns.map((run) => [run.id, run]))
  const journalRunIds = presentJournalRuns.map((run) => run.id)
  const voucherRows = journalRunIds.length > 0
    ? await db
        .select({
          journalEntryRunId: bookkeepingJournalEntryVoucher.journalEntryRunId,
          attributedPeriod: bookkeepingJournalEntryVoucher.attributedPeriod,
        })
        .from(bookkeepingJournalEntryVoucher)
        .where(
          and(
            eq(bookkeepingJournalEntryVoucher.tenantId, params.tenantId),
            inArray(bookkeepingJournalEntryVoucher.journalEntryRunId, journalRunIds),
          ),
        )
    : []

  for (const voucher of voucherRows) {
    const run = presentJournalRunById.get(voucher.journalEntryRunId)
    if (!run || !voucher.attributedPeriod || !monthSignals.has(voucher.attributedPeriod)) continue
    const signals = monthSignals.get(voucher.attributedPeriod)!
    if (!signals.includedSessionIds.has(run.uploadSessionId)) continue
    signals.journalSessionIds.add(run.uploadSessionId)
    if (!signals.lastJournalEntryRunCreatedAt || run.createdAt > signals.lastJournalEntryRunCreatedAt) {
      signals.lastJournalEntryRunId = run.id
      signals.lastJournalEntryRunCreatedAt = run.createdAt
    }
  }

  const legacyJournalRows = journalRunIds.length > 0
    ? await db
        .select({
          journalEntryRunId: bookkeepingJournalEntryRow.journalEntryRunId,
          attributedPeriod: bookkeepingJournalEntryRow.attributedPeriod,
        })
        .from(bookkeepingJournalEntryRow)
        .where(
          and(
            eq(bookkeepingJournalEntryRow.tenantId, params.tenantId),
            inArray(bookkeepingJournalEntryRow.journalEntryRunId, journalRunIds),
          ),
        )
    : []

  for (const row of legacyJournalRows) {
    const run = presentJournalRunById.get(row.journalEntryRunId)
    if (!run || !row.attributedPeriod || !monthSignals.has(row.attributedPeriod)) continue
    const signals = monthSignals.get(row.attributedPeriod)!
    if (!signals.includedSessionIds.has(run.uploadSessionId)) continue
    signals.journalSessionIds.add(run.uploadSessionId)
    if (!signals.lastJournalEntryRunCreatedAt || run.createdAt > signals.lastJournalEntryRunCreatedAt) {
      signals.lastJournalEntryRunId = run.id
      signals.lastJournalEntryRunCreatedAt = run.createdAt
    }
  }

  const monthRows = await db
    .select()
    .from(bookkeepingLedgerMonth)
    .where(and(eq(bookkeepingLedgerMonth.tenantId, params.tenantId), eq(bookkeepingLedgerMonth.ledgerId, ledger.id)))
    .orderBy(bookkeepingLedgerMonth.periodMonth)

  const updatedAt = toDBString(now())
  const summaries: FiscalLedgerMonthSummary[] = []

  for (const monthRow of monthRows) {
    const signals = monthSignals.get(monthRow.periodMonth)
    if (!signals) continue
    const status = deriveFiscalLedgerMonthStatus({
      sessionCount: signals.sessionIds.size,
      includedMaterialCount: signals.includedMaterialCount,
      completedClassificationRunCount: signals.completedClassificationSessionIds.size,
      journalEntryRunCount: signals.journalSessionIds.size,
    })

    if (
      monthRow.status !== status ||
      monthRow.lastUploadSessionId !== signals.lastUploadSessionId ||
      monthRow.lastMaterialAttributionRunAt !== signals.lastMaterialAttributionRunAt ||
      monthRow.lastClassificationRunId !== signals.lastClassificationRunId ||
      monthRow.lastJournalEntryRunId !== signals.lastJournalEntryRunId
    ) {
      await db
        .update(bookkeepingLedgerMonth)
        .set({
          status,
          lastUploadSessionId: signals.lastUploadSessionId,
          lastMaterialAttributionRunAt: signals.lastMaterialAttributionRunAt,
          lastClassificationRunId: signals.lastClassificationRunId,
          lastJournalEntryRunId: signals.lastJournalEntryRunId,
          updatedAt,
        })
        .where(and(eq(bookkeepingLedgerMonth.id, monthRow.id), eq(bookkeepingLedgerMonth.tenantId, params.tenantId)))
    }

    summaries.push({
      id: monthRow.id,
      periodMonth: monthRow.periodMonth,
      status,
      lastUploadSessionId: signals.lastUploadSessionId,
      lastMaterialAttributionRunAt: signals.lastMaterialAttributionRunAt,
      lastClassificationRunId: signals.lastClassificationRunId,
      lastJournalEntryRunId: signals.lastJournalEntryRunId,
      counts: {
        sessionCount: signals.sessionIds.size,
        includedMaterialCount: signals.includedMaterialCount,
        completedClassificationRunCount: signals.completedClassificationSessionIds.size,
        journalEntryRunCount: signals.journalSessionIds.size,
      },
    })
  }

  return {
    client: clientRow,
    ledger: {
      id: ledger.id,
      tenantId: ledger.tenantId,
      clientId: ledger.clientId,
      fiscalYear: ledger.fiscalYear,
      status: ledger.status,
      createdAt: ledger.createdAt,
      updatedAt: ledger.updatedAt,
    },
    months: summaries,
  }
}

type AttributionRow = typeof bookkeepingMaterialAttribution.$inferSelect
type MaterialLinkRow = typeof bookkeepingLedgerMaterialLink.$inferSelect

// attribution row id가 아니라 물리적 원천(파일+내용) 기반 키라서, attribution이
// 재실행되어 새 row id가 생겨도 같은 거래는 같은 fingerprint를 갖는다.
function buildSourceFingerprint(row: AttributionRow) {
  const parts = [
    row.uploadFileId ?? row.uploadSessionId,
    row.sourceLabel,
    row.evidenceDate ?? '',
    row.amountKrw != null ? String(row.amountKrw) : '',
    row.counterparty ?? '',
  ]
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

export type MergeIncludedMaterialResult =
  | {
      ok: true
      linkedCount: number
      supersededCount: number
      staleCount: number
      skippedUnknownPeriodCount: number
    }
  | { ok: false; status: number; error: string }

export async function mergeIncludedAttributionIntoLedger(params: {
  tenantId: string
  sessionId: string
  staffRecord: { id: string; role: 'TENANT_ADMIN' | 'STAFF' }
}): Promise<MergeIncludedMaterialResult> {
  const [sessionRow] = await db
    .select()
    .from(uploadSession)
    .where(
      and(
        eq(uploadSession.id, params.sessionId),
        eq(uploadSession.tenantId, params.tenantId),
        isNull(uploadSession.deletedAt),
      ),
    )
    .limit(1)

  if (!sessionRow) return { ok: false, status: 404, error: '세션을 찾을 수 없습니다.' }
  if (params.staffRecord.role === 'STAFF' && sessionRow.createdByStaffId !== params.staffRecord.id) {
    return { ok: false, status: 404, error: '세션을 찾을 수 없습니다.' }
  }

  const attributionRows = await db
    .select()
    .from(bookkeepingMaterialAttribution)
    .where(
      and(
        eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
        eq(bookkeepingMaterialAttribution.uploadSessionId, params.sessionId),
      ),
    )

  const existingLinks = await db
    .select()
    .from(bookkeepingLedgerMaterialLink)
    .where(
      and(
        eq(bookkeepingLedgerMaterialLink.tenantId, params.tenantId),
        eq(bookkeepingLedgerMaterialLink.uploadSessionId, params.sessionId),
      ),
    )

  const includedLinkByAttributionId = new Map<string, MaterialLinkRow>()
  for (const link of existingLinks) {
    if (link.status === 'included' && link.materialAttributionId) {
      includedLinkByAttributionId.set(link.materialAttributionId, link)
    }
  }

  // attribution 재실행은 기존 row를 지우지 않고 status를 'superseded'로 바꾼 뒤 같은
  // 물리적 자료를 가리키는 새 'active' row를 추가한다(period-attribution-service.ts).
  // 그래서 비활성 row의 fingerprint가 이번 배치의 활성 row와 같다면, 그 row의 링크는
  // 뒤에서 supersede 처리되어야 하며 여기서 미리 stale로 떨어뜨리면 안 된다.
  const activeFingerprintKeys = new Set<string>()
  for (const row of attributionRows) {
    const periodMonth = periodFromAttributionValue(row)
    if (row.status === 'active' && isIncludedAttribution(row) && periodMonth) {
      activeFingerprintKeys.add(`${periodMonth}::${buildSourceFingerprint(row)}`)
    }
  }

  const timestamp = toDBString(now())
  let linkedCount = 0
  let supersededCount = 0
  let staleCount = 0
  let skippedUnknownPeriodCount = 0
  const ledgerByFiscalYear = new Map<number, Awaited<ReturnType<typeof ensureFiscalLedgerAndMonths>>>()

  for (const row of attributionRows) {
    const effectiveInclude = row.status === 'active' && isIncludedAttribution(row)
    const periodMonth = periodFromAttributionValue(row)
    const existingIncludedLink = includedLinkByAttributionId.get(row.id)

    if (!effectiveInclude || !periodMonth) {
      if (effectiveInclude && !periodMonth) skippedUnknownPeriodCount += 1
      const willBeSuperseded = periodMonth && activeFingerprintKeys.has(`${periodMonth}::${buildSourceFingerprint(row)}`)
      if (existingIncludedLink && !willBeSuperseded) {
        await db
          .update(bookkeepingLedgerMaterialLink)
          .set({ status: 'stale', updatedAt: timestamp })
          .where(
            and(
              eq(bookkeepingLedgerMaterialLink.id, existingIncludedLink.id),
              eq(bookkeepingLedgerMaterialLink.tenantId, params.tenantId),
            ),
          )
        staleCount += 1
      }
      continue
    }

    const fiscalYear = Number(periodMonth.slice(0, 4))
    let ledger = ledgerByFiscalYear.get(fiscalYear)
    if (!ledger) {
      ledger = await ensureFiscalLedgerAndMonths({
        tenantId: params.tenantId,
        clientId: sessionRow.clientId,
        fiscalYear,
      })
      ledgerByFiscalYear.set(fiscalYear, ledger)
    }

    const fingerprint = buildSourceFingerprint(row)

    // select-then-write를 한 트랜잭션으로 묶어, 같은 세션에 대한 merge 호출이
    // 동시에 들어와도 같은 fingerprintMatch를 보고 둘 다 insert하지 못하게 한다.
    // partial unique index(bookkeeping_ledger_link_included_fingerprint_uidx)가
    // 그래도 어긋나는 경우의 마지막 방어선이다.
    const outcome = await db.transaction(async (tx) => {
      const [fingerprintMatch] = await tx
        .select()
        .from(bookkeepingLedgerMaterialLink)
        .where(
          and(
            eq(bookkeepingLedgerMaterialLink.tenantId, params.tenantId),
            eq(bookkeepingLedgerMaterialLink.ledgerId, ledger.id),
            eq(bookkeepingLedgerMaterialLink.periodMonth, periodMonth),
            eq(bookkeepingLedgerMaterialLink.sourceFingerprint, fingerprint),
            eq(bookkeepingLedgerMaterialLink.status, 'included'),
          ),
        )
        .limit(1)

      if (fingerprintMatch && fingerprintMatch.materialAttributionId === row.id) {
        return 'noop' as const // already merged, idempotent no-op
      }

      if (fingerprintMatch) {
        await tx
          .update(bookkeepingLedgerMaterialLink)
          .set({ status: 'superseded', updatedAt: timestamp })
          .where(
            and(
              eq(bookkeepingLedgerMaterialLink.id, fingerprintMatch.id),
              eq(bookkeepingLedgerMaterialLink.tenantId, params.tenantId),
            ),
          )
      }

      await tx.insert(bookkeepingLedgerMaterialLink).values({
        id: randomUUID(),
        tenantId: params.tenantId,
        ledgerId: ledger.id,
        periodMonth,
        uploadSessionId: params.sessionId,
        uploadFileId: row.uploadFileId,
        materialAttributionId: row.id,
        sourceFingerprint: fingerprint,
        status: 'included',
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      return fingerprintMatch ? ('superseded' as const) : ('linked' as const)
    })

    if (outcome === 'noop') continue
    if (outcome === 'superseded') supersededCount += 1
    linkedCount += 1
  }

  return { ok: true, linkedCount, supersededCount, staleCount, skippedUnknownPeriodCount }
}
