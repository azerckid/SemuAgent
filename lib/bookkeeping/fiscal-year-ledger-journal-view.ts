import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingClassificationRun,
  bookkeepingFiscalYearLedger,
  bookkeepingJournalEntryRun,
  bookkeepingJournalEntryRow,
  bookkeepingJournalEntryVoucher,
  bookkeepingJournalEntryVoucherLine,
  bookkeepingTransactionClassification,
} from '@/lib/db/schema'
import { listLedgerAcceptedMaterials } from './fiscal-year-ledger-accepted-materials'
import { resolveLedgerPeriodRange, type LedgerPeriodRange } from './fiscal-year-ledger-rules'
import {
  expandJournalEntryRowsToVoucherLines,
  formatJournalEntryVoucherNumber,
  type JournalEntryVoucherLine,
} from './journal-entry-voucher-lines'

type VoucherRow = typeof bookkeepingJournalEntryVoucher.$inferSelect
type VoucherLineRow = typeof bookkeepingJournalEntryVoucherLine.$inferSelect
type JournalEntryRunRow = typeof bookkeepingJournalEntryRun.$inferSelect
type LegacyJournalRow = typeof bookkeepingJournalEntryRow.$inferSelect

type AccumulatedJournalDisplayVoucher = Pick<
  VoucherRow,
  'id' | 'voucherNumber' | 'entryDate' | 'status' | 'classificationRowId' | 'sourceClassificationRowIds' | 'attributedPeriod'
>

type AccumulatedJournalDisplayLine = Pick<
  VoucherLineRow,
  'id' | 'side' | 'accountName' | 'accountCode' | 'amountKrw' | 'counterparty' | 'counterpartyCode' | 'memo'
>

const STALE_CLASSIFICATION_REASON = '계정항목 정리가 업데이트되어 전표 분개표 초안을 다시 생성해야 합니다.'
const STALE_MATERIAL_REASON = '귀속 자료가 더 이상 회계연도 장부에 포함되어 있지 않습니다.'

export type AccumulatedJournalVoucher = {
  voucher: AccumulatedJournalDisplayVoucher
  lines: AccumulatedJournalDisplayLine[]
  periodMonth: string
  stale: boolean
  staleReason: string | null
}

function legacyRowsToDisplayVouchers(rows: LegacyJournalRow[]): Array<{
  voucher: AccumulatedJournalDisplayVoucher
  lines: AccumulatedJournalDisplayLine[]
}> {
  return rows
    .filter((row) => row.status !== 'excluded')
    .map((row, index) => {
      const [debitLine, creditLine] = expandJournalEntryRowsToVoucherLines([
        {
          id: row.id,
          status: row.status,
          entryDate: row.entryDate,
          debitAccount: row.debitAccount,
          debitAmountKrw: row.debitAmountKrw,
          creditAccount: row.creditAccount,
          creditAmountKrw: row.creditAmountKrw,
          counterparty: row.counterparty,
          memo: row.memo,
        },
      ])
      const lines: JournalEntryVoucherLine[] = []
      if (debitLine) lines.push(debitLine)
      if (creditLine) lines.push(creditLine)

      return {
        voucher: {
          id: row.id,
          voucherNumber: formatJournalEntryVoucherNumber(index + 1),
          entryDate: row.entryDate,
          status: row.status,
          classificationRowId: row.classificationRowId,
          sourceClassificationRowIds: null,
          attributedPeriod: row.attributedPeriod,
        },
        lines: lines.map((line) => ({
          id: `${row.id}-${line.side}`,
          side: line.side,
          accountName: line.accountName,
          accountCode: line.accountCode,
          amountKrw: line.side === 'debit' ? line.debitAmountKrw : line.creditAmountKrw,
          counterparty: line.counterparty,
          counterpartyCode: line.counterpartyCode,
          memo: line.memo,
        })),
      }
    })
}

function parseSourceClassificationRowIds(value: string | null) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
  } catch {
    return []
  }
}

function getVoucherClassificationRowIds(voucher: AccumulatedJournalDisplayVoucher) {
  const sourceIds = parseSourceClassificationRowIds(voucher.sourceClassificationRowIds)
  return sourceIds.length > 0 ? sourceIds : [voucher.classificationRowId]
}

export type AccumulatedJournalResult =
  | {
      ok: true
      ledger: { id: string; tenantId: string; clientId: string; fiscalYear: number }
      period: LedgerPeriodRange
      sessionCount: number
      staleVoucherCount: number
      excludedUnknownPeriodCount: number
      vouchers: AccumulatedJournalVoucher[]
    }
  | { ok: false; status: number; error: string }

export async function listAccumulatedJournalVouchers(params: {
  tenantId: string
  ledgerId: string
  period?: string | null
}): Promise<AccumulatedJournalResult> {
  const [ledger] = await db
    .select()
    .from(bookkeepingFiscalYearLedger)
    .where(
      and(
        eq(bookkeepingFiscalYearLedger.id, params.ledgerId),
        eq(bookkeepingFiscalYearLedger.tenantId, params.tenantId),
      ),
    )
    .limit(1)

  if (!ledger) return { ok: false, status: 404, error: '회계연도 장부를 찾을 수 없습니다.' }

  const period = resolveLedgerPeriodRange(ledger.fiscalYear, params.period)
  if (!period) return { ok: false, status: 400, error: '기간 형식이 올바르지 않거나 장부의 회계연도와 다릅니다.' }

  const ledgerSummary = {
    id: ledger.id,
    tenantId: ledger.tenantId,
    clientId: ledger.clientId,
    fiscalYear: ledger.fiscalYear,
  }

  const links = await listLedgerAcceptedMaterials({
    tenantId: params.tenantId,
    ledgerId: params.ledgerId,
    clientId: ledger.clientId,
    period,
  })

  const sessionIds = [...new Set(links.map((link) => link.uploadSessionId))]

  if (sessionIds.length === 0) {
    return {
      ok: true,
      ledger: ledgerSummary,
      period,
      sessionCount: 0,
      staleVoucherCount: 0,
      excludedUnknownPeriodCount: 0,
      vouchers: [],
    }
  }

  // 같은 file-level accepted-material 검증(Slice 3와 동일한 이유: attribution이
  // 재실행되거나 결정이 바뀐 뒤에도 전표 run은 그대로 남아있을 수 있다).
  const acceptedFileIdsBySession = new Map<string, Set<string>>()
  for (const link of links) {
    if (!link.uploadFileId) continue
    const set = acceptedFileIdsBySession.get(link.uploadSessionId) ?? new Set<string>()
    set.add(link.uploadFileId)
    acceptedFileIdsBySession.set(link.uploadSessionId, set)
  }

  // 세션마다 "현재 보여줄" 전표 run은 기존 단일 세션 뷰(getLatestBookkeepingJournalEntry)와
  // 동일하게 status 무관 최신 run 하나다.
  const runs = await db
    .select()
    .from(bookkeepingJournalEntryRun)
    .where(
      and(
        eq(bookkeepingJournalEntryRun.tenantId, params.tenantId),
        inArray(bookkeepingJournalEntryRun.uploadSessionId, sessionIds),
      ),
    )

  const latestRunBySession = new Map<string, JournalEntryRunRow>()
  for (const run of runs) {
    const current = latestRunBySession.get(run.uploadSessionId)
    if (!current || run.createdAt > current.createdAt) {
      latestRunBySession.set(run.uploadSessionId, run)
    }
  }

  if (latestRunBySession.size === 0) {
    return {
      ok: true,
      ledger: ledgerSummary,
      period,
      sessionCount: 0,
      staleVoucherCount: 0,
      excludedUnknownPeriodCount: 0,
      vouchers: [],
    }
  }

  // 기존 단일 세션 뷰와 동일한 stale 판단: run의 classificationRunId가 세션의 최신
  // completed classification run과 다르면, 계정항목 정리가 그 뒤에 갱신된 것이다.
  const completedClassificationRuns = await db
    .select({ id: bookkeepingClassificationRun.id, uploadSessionId: bookkeepingClassificationRun.uploadSessionId, createdAt: bookkeepingClassificationRun.createdAt })
    .from(bookkeepingClassificationRun)
    .where(
      and(
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.status, 'completed'),
        inArray(bookkeepingClassificationRun.uploadSessionId, sessionIds),
      ),
    )

  const latestCompletedClassificationBySession = new Map<string, { id: string; createdAt: string }>()
  for (const run of completedClassificationRuns) {
    const current = latestCompletedClassificationBySession.get(run.uploadSessionId)
    if (!current || run.createdAt > current.createdAt) {
      latestCompletedClassificationBySession.set(run.uploadSessionId, run)
    }
  }

  let staleVoucherCount = 0
  let excludedUnknownPeriodCount = 0
  const vouchers: AccumulatedJournalVoucher[] = []

  for (const run of latestRunBySession.values()) {
    const sessionVouchers = await db
      .select()
      .from(bookkeepingJournalEntryVoucher)
      .where(
        and(
          eq(bookkeepingJournalEntryVoucher.tenantId, params.tenantId),
          eq(bookkeepingJournalEntryVoucher.journalEntryRunId, run.id),
        ),
      )

    let inRangeVouchers: AccumulatedJournalDisplayVoucher[] = sessionVouchers.filter((voucher) => {
      if (!voucher.attributedPeriod) {
        excludedUnknownPeriodCount += 1
        return false
      }
      return voucher.attributedPeriod >= period.start && voucher.attributedPeriod <= period.end
    })

    const linesByVoucherId = new Map<string, AccumulatedJournalDisplayLine[]>()

    if (inRangeVouchers.length > 0) {
      const voucherIds = inRangeVouchers.map((voucher) => voucher.id)
      const lines = await db
        .select()
        .from(bookkeepingJournalEntryVoucherLine)
        .where(
          and(
            eq(bookkeepingJournalEntryVoucherLine.tenantId, params.tenantId),
            inArray(bookkeepingJournalEntryVoucherLine.voucherId, voucherIds),
          ),
        )
        .orderBy(bookkeepingJournalEntryVoucherLine.voucherId, bookkeepingJournalEntryVoucherLine.lineSequence)

      for (const line of lines) {
        const list = linesByVoucherId.get(line.voucherId) ?? []
        list.push(line)
        linesByVoucherId.set(line.voucherId, list)
      }
    } else {
      const legacyRows = await db
        .select()
        .from(bookkeepingJournalEntryRow)
        .where(
          and(
            eq(bookkeepingJournalEntryRow.tenantId, params.tenantId),
            eq(bookkeepingJournalEntryRow.journalEntryRunId, run.id),
          ),
        )
        .orderBy(bookkeepingJournalEntryRow.entryDate, bookkeepingJournalEntryRow.createdAt)

      const inRangeLegacyRows = legacyRows.filter((row) => {
        if (!row.attributedPeriod) {
          excludedUnknownPeriodCount += 1
          return false
        }
        return row.attributedPeriod >= period.start && row.attributedPeriod <= period.end
      })

      const legacyVouchers = legacyRowsToDisplayVouchers(inRangeLegacyRows)
      inRangeVouchers = legacyVouchers.map((item) => item.voucher)
      for (const item of legacyVouchers) {
        linesByVoucherId.set(item.voucher.id, item.lines)
      }
    }

    if (inRangeVouchers.length === 0) continue

    const classificationRowIds = [...new Set(inRangeVouchers.flatMap(getVoucherClassificationRowIds))]
    const classificationRows = await db
      .select({ id: bookkeepingTransactionClassification.id, uploadFileId: bookkeepingTransactionClassification.uploadFileId })
      .from(bookkeepingTransactionClassification)
      .where(
        and(
          eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
          inArray(bookkeepingTransactionClassification.id, classificationRowIds),
        ),
      )
    const fileIdByClassificationRowId = new Map(classificationRows.map((row) => [row.id, row.uploadFileId]))

    const latestCompletedClassification = latestCompletedClassificationBySession.get(run.uploadSessionId)
    const classificationStale = Boolean(
      latestCompletedClassification && run.classificationRunId !== latestCompletedClassification.id,
    )
    const acceptedFileIds = acceptedFileIdsBySession.get(run.uploadSessionId) ?? null

    for (const voucher of inRangeVouchers) {
      const sourceClassificationRowIds = getVoucherClassificationRowIds(voucher)
      const materialStale = Boolean(
        acceptedFileIds && sourceClassificationRowIds.some((rowId) => {
          const fileId = fileIdByClassificationRowId.get(rowId) ?? null
          return !fileId || !acceptedFileIds.has(fileId)
        }),
      )
      const stale = classificationStale || materialStale
      if (stale) staleVoucherCount += 1

      vouchers.push({
        voucher,
        lines: linesByVoucherId.get(voucher.id) ?? [],
        periodMonth: voucher.attributedPeriod!,
        stale,
        staleReason: classificationStale ? STALE_CLASSIFICATION_REASON : (materialStale ? STALE_MATERIAL_REASON : null),
      })
    }
  }

  vouchers.sort((a, b) => {
    if (a.periodMonth !== b.periodMonth) return a.periodMonth.localeCompare(b.periodMonth)
    return a.voucher.voucherNumber.localeCompare(b.voucher.voucherNumber)
  })

  return {
    ok: true,
    ledger: ledgerSummary,
    period,
    sessionCount: latestRunBySession.size,
    staleVoucherCount,
    excludedUnknownPeriodCount,
    vouchers,
  }
}

// 자료 검토 > 전표 분개표 엑셀과 같은 행 형식(JOURNAL_ENTRY_VOUCHER_EXPORT_HEADERS)으로
// 평탄화한다. 누적 뷰는 여러 세션의 voucher를 합치므로 voucherNumber만으로는
// 행을 구분할 수 없어 journalEntryRowId에 voucher.id를 그대로 쓴다.
export function toJournalEntryExportLines(vouchers: AccumulatedJournalVoucher[]): JournalEntryVoucherLine[] {
  return vouchers.flatMap((item) =>
    item.lines.map((line) => ({
      journalEntryRowId: item.voucher.id,
      voucherNumber: item.voucher.voucherNumber,
      voucherStatus: item.voucher.status,
      side: line.side,
      entryDate: item.voucher.entryDate ?? '',
      accountCode: line.accountCode ?? '',
      accountName: line.accountName ?? '',
      debitAmountKrw: line.side === 'debit' ? line.amountKrw : 0,
      creditAmountKrw: line.side === 'credit' ? line.amountKrw : 0,
      counterparty: line.counterparty ?? '',
      counterpartyCode: line.counterpartyCode ?? '',
      memo: line.memo ?? '',
    })),
  )
}
