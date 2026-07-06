import { randomUUID } from 'crypto'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingClassificationRun,
  bookkeepingJournalEntryRow,
  bookkeepingJournalEntryRun,
  bookkeepingJournalEntryVoucher,
  bookkeepingJournalEntryVoucherLine,
  bookkeepingMaterialAttribution,
  bookkeepingTransactionClassification,
  client,
  uploadSession,
} from '@/lib/db/schema'
import { sourceBatchIdForLegacyUploadSession } from '@/lib/source-batch/scope'
import { DateTime, now, toDBString } from '@/lib/time'
import { getActiveStaffForUser, getClassificationEligibility } from './classification-service'
import {
  buildJournalEntryDraftRow,
  JOURNAL_ENTRY_RULES_SNAPSHOT,
  type JournalEntryDraftRow,
} from './journal-entry-rules'
import {
  buildRemittanceFeeVoucherDraftFromPair,
  collectRemittanceFeePairedClassificationRowIds,
  findRemittanceFeePairs,
} from './journal-entry-remittance-fee-rules'
import {
  buildSalesVatVoucherDraft,
  type JournalEntryClassificationSourceRow,
} from './journal-entry-sales-vat-rules'
import {
  buildStoredVoucherRecordsFromDraft,
  buildStoredVoucherRecordsFromRemittanceFeeDraft,
  buildStoredVoucherRecordsFromSalesVatDraft,
  expandJournalEntryRowsToVoucherLines,
  formatJournalEntryVoucherNumber,
  mapStoredVoucherLinesToDisplayLines,
  type JournalEntryVoucherLine,
} from './journal-entry-voucher-lines'
import {
  isBookkeepingPeriodInRange,
  periodFromAttributionValue,
  resolveBookkeepingPeriodRangeSnapshot,
  type BookkeepingPeriodRange,
} from './period-range'
import type { JournalEntryRowStatus } from './schemas'

const ACTIVE_JOURNAL_RUN_STATUSES = ['draft', 'completed'] as const

type StaffRecord = {
  id: string
  role: 'TENANT_ADMIN' | 'STAFF'
}

export { getActiveStaffForUser }

function isMissingJournalEntryVoucherTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const causeMessage = error instanceof Error && error.cause instanceof Error ? error.cause.message : ''
  return [message, causeMessage].some((value) => value.includes('no such table: bookkeeping_journal_entry_voucher'))
}

function loadLegacyJournalEntryVoucherDisplayLines(params: {
  runId: string
  tenantId: string
}): Promise<JournalEntryVoucherLine[]> {
  return db
    .select()
    .from(bookkeepingJournalEntryRow)
    .where(
      and(
        eq(bookkeepingJournalEntryRow.journalEntryRunId, params.runId),
        eq(bookkeepingJournalEntryRow.tenantId, params.tenantId),
      ),
    )
    .orderBy(bookkeepingJournalEntryRow.entryDate, bookkeepingJournalEntryRow.createdAt)
    .then((legacyRows) => expandJournalEntryRowsToVoucherLines(
      legacyRows
        .filter((row) => row.status !== 'excluded')
        .map((row) => ({
          id: row.id,
          status: row.status,
          entryDate: row.entryDate,
          debitAccount: row.debitAccount,
          debitAmountKrw: row.debitAmountKrw,
          creditAccount: row.creditAccount,
          creditAmountKrw: row.creditAmountKrw,
          counterparty: row.counterparty,
          memo: row.memo,
        })),
    ))
}

function normalizeJournalEntryVoucherStorageError(error: unknown) {
  if (isMissingJournalEntryVoucherTableError(error)) {
    return new Error('전표 voucher 테이블이 없습니다. drizzle/0033 마이그레이션 또는 pnpm db:push를 먼저 적용해 주세요.')
  }
  return error
}

function normalizeAccountingPeriod(value: string) {
  const match = value.match(/(20\d{2})[-.\s년]*(\d{1,2})/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, '0')}`
}

function closePeriodFor(accountingPeriod: string) {
  const period = normalizeAccountingPeriod(accountingPeriod)
  if (!period) return accountingPeriod

  const base = DateTime.fromFormat(`${period}-01`, 'yyyy-MM-dd', { zone: 'Asia/Seoul' })
  if (!base.isValid) return period

  const quarterStartMonth = Math.floor((base.month - 1) / 3) * 3 + 1
  const start = base.set({ month: quarterStartMonth })
  const end = start.plus({ months: 2 })
  return `${start.toFormat('yyyy-MM')}~${end.toFormat('yyyy-MM')}`
}

function resolveTargetRangeFromSession(session: typeof uploadSession.$inferSelect) {
  return resolveBookkeepingPeriodRangeSnapshot({
    accountingPeriod: session.accountingPeriod,
    bookkeepingPeriodType: session.bookkeepingPeriodType,
    bookkeepingPeriodStart: session.bookkeepingPeriodStart,
    bookkeepingPeriodEnd: session.bookkeepingPeriodEnd,
  })
}

async function getSessionForStaff(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}) {
  const [row] = await db
    .select({
      session: uploadSession,
      clientName: client.name,
    })
    .from(uploadSession)
    .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, params.tenantId)))
    .where(and(eq(uploadSession.id, params.sessionId), eq(uploadSession.tenantId, params.tenantId), isNull(uploadSession.deletedAt)))
    .limit(1)

  if (!row) return null
  if (params.staffRecord.role === 'STAFF' && row.session.createdByStaffId !== params.staffRecord.id) return null
  return row
}

export async function canAccessJournalEntrySession(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}) {
  return Boolean(await getSessionForStaff(params))
}

function attributionLooseKey(params: {
  uploadFileId: string | null
  evidenceDate: string | null
  amountKrw: number | null
}) {
  return [
    params.uploadFileId ?? 'file:none',
    params.evidenceDate ?? 'date:none',
    params.amountKrw ?? 'amount:none',
  ].join('|')
}

async function buildIncludedAttributionByLooseKey(params: {
  sessionId: string
  tenantId: string
  targetRange: BookkeepingPeriodRange
}) {
  const rows = await db
    .select()
    .from(bookkeepingMaterialAttribution)
    .where(
      and(
        eq(bookkeepingMaterialAttribution.uploadSessionId, params.sessionId),
        eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
        eq(bookkeepingMaterialAttribution.status, 'active'),
      ),
    )

  const includedByKey = new Map<string, typeof rows[number][]>()

  for (const row of rows) {
    const decision = row.staffDecision ?? row.recommendation
    if (decision !== 'include') continue
    if (row.sourceKind !== 'transaction_row') continue
    if (!isBookkeepingPeriodInRange(periodFromAttributionValue(row), params.targetRange)) continue
    const key = attributionLooseKey({
      uploadFileId: row.uploadFileId,
      evidenceDate: row.evidenceDate,
      amountKrw: row.amountKrw,
    })
    includedByKey.set(key, [...(includedByKey.get(key) ?? []), row])
  }

  return includedByKey
}

type JournalEntryPreparedRow = {
  source: JournalEntryClassificationSourceRow
  draft: JournalEntryDraftRow
  requestedPeriod: string
  attributedPeriod: string | null
  closePeriod: string
}

type JournalEntryVoucherPlan =
  | {
      kind: 'standard'
      draft: JournalEntryPreparedRow['draft'] & {
        requestedPeriod: string
        attributedPeriod: string | null
        closePeriod: string
      }
    }
  | {
      kind: 'remittance_fee'
      draft: NonNullable<ReturnType<typeof buildRemittanceFeeVoucherDraftFromPair>> & {
        requestedPeriod: string
        attributedPeriod: string | null
        closePeriod: string
      }
    }
  | {
      kind: 'sales_vat'
      draft: NonNullable<ReturnType<typeof buildSalesVatVoucherDraft>> & {
        requestedPeriod: string
        attributedPeriod: string | null
        closePeriod: string
      }
    }

function buildJournalEntryVoucherPlans(preparedRows: JournalEntryPreparedRow[]): JournalEntryVoucherPlan[] {
  const pairs = findRemittanceFeePairs(preparedRows.map((row) => row.source))
  const pairedIds = collectRemittanceFeePairedClassificationRowIds(pairs)
  const pairByPrincipalId = new Map(pairs.map((pair) => [pair.principal.id, pair]))
  const preparedById = new Map(preparedRows.map((row) => [row.source.id, row]))
  const plans: JournalEntryVoucherPlan[] = []

  for (const prepared of preparedRows) {
    if (pairedIds.has(prepared.source.id) && !pairByPrincipalId.has(prepared.source.id)) {
      continue
    }

    const pair = pairByPrincipalId.get(prepared.source.id)
    if (pair) {
      const remittanceDraft = buildRemittanceFeeVoucherDraftFromPair(pair)
      if (!remittanceDraft) continue

      const principalPrepared = preparedById.get(pair.principal.id)
      plans.push({
        kind: 'remittance_fee',
        draft: {
          ...remittanceDraft,
          requestedPeriod: principalPrepared?.requestedPeriod ?? prepared.requestedPeriod,
          attributedPeriod: principalPrepared?.attributedPeriod ?? prepared.attributedPeriod,
          closePeriod: principalPrepared?.closePeriod ?? prepared.closePeriod,
        },
      })
      continue
    }

    const salesVatDraft = buildSalesVatVoucherDraft({
      source: prepared.source,
      draft: prepared.draft,
    })
    if (salesVatDraft) {
      plans.push({
        kind: 'sales_vat',
        draft: {
          ...salesVatDraft,
          requestedPeriod: prepared.requestedPeriod,
          attributedPeriod: prepared.attributedPeriod,
          closePeriod: prepared.closePeriod,
        },
      })
      continue
    }

    plans.push({
      kind: 'standard',
      draft: {
        ...prepared.draft,
        requestedPeriod: prepared.requestedPeriod,
        attributedPeriod: prepared.attributedPeriod,
        closePeriod: prepared.closePeriod,
      },
    })
  }

  return plans
}

export async function startBookkeepingJournalEntry(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
}) {
  const sessionRow = await getSessionForStaff(params)
  if (!sessionRow) return { ok: false as const, status: 404, error: '세션을 찾을 수 없습니다.' }

  const eligibility = await getClassificationEligibility(params)
  if (!eligibility.eligible) return { ok: false as const, status: 409, error: eligibility.reason }
  const targetRange = resolveTargetRangeFromSession(sessionRow.session)
  if (!targetRange) return { ok: false as const, status: 409, error: '기장 대상 기간을 확정할 수 없습니다.' }

  const [classificationRun] = await db
    .select()
    .from(bookkeepingClassificationRun)
    .where(
      and(
        eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId),
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.status, 'completed'),
      ),
    )
    .orderBy(desc(bookkeepingClassificationRun.createdAt))
    .limit(1)

  if (!classificationRun) {
    return { ok: false as const, status: 409, error: '계정항목 정리 완료 후 전표 분개표를 생성할 수 있습니다.' }
  }

  const classificationRows = await db
    .select()
    .from(bookkeepingTransactionClassification)
    .where(
      and(
        eq(bookkeepingTransactionClassification.classificationRunId, classificationRun.id),
        eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
      ),
    )

  const includedAttributionByKey = await buildIncludedAttributionByLooseKey({
    sessionId: params.sessionId,
    tenantId: params.tenantId,
    targetRange,
  })
  const closePeriod = closePeriodFor(sessionRow.session.accountingPeriod)

  const preparedRows: JournalEntryPreparedRow[] = []

  for (const row of classificationRows) {
    const looseKey = attributionLooseKey({
      uploadFileId: row.uploadFileId,
      evidenceDate: row.transactionDate,
      amountKrw: row.amountKrw,
    })
    const matchingAttributions = includedAttributionByKey.get(looseKey) ?? []
    const attribution = matchingAttributions.shift()
    const attributedPeriod = attribution?.attributedPeriod ?? row.transactionDate?.slice(0, 7) ?? sessionRow.session.accountingPeriod
    if (!isBookkeepingPeriodInRange(attributedPeriod, targetRange)) continue

    const source: JournalEntryClassificationSourceRow = {
      id: row.id,
      transactionDate: row.transactionDate,
      merchantName: row.merchantName,
      description: row.description,
      amountKrw: row.amountKrw,
      direction: row.direction,
      recommendedAccount: row.recommendedAccount,
      finalAccount: row.finalAccount,
      status: row.status,
      staffMemo: row.staffMemo,
      sourceType: row.sourceType,
    }

    const draft = buildJournalEntryDraftRow(source)
    if (!draft) continue

    preparedRows.push({
      source,
      draft,
      requestedPeriod: sessionRow.session.accountingPeriod,
      attributedPeriod,
      closePeriod: attribution?.closePeriod ?? closePeriod,
    })
  }

  const voucherPlans = buildJournalEntryVoucherPlans(preparedRows)

  if (voucherPlans.length === 0) {
    return { ok: false as const, status: 409, error: '전표 분개표에 반영할 계정항목 행이 없습니다.' }
  }

  const ts = toDBString(now())
  const runId = randomUUID()
  const sourceBatchId = sourceBatchIdForLegacyUploadSession(params.sessionId)
  const unresolvedRowCount = voucherPlans.filter((plan) => plan.draft.status === 'needs_decision').length

  await db.transaction(async (tx) => {
    await tx
      .update(bookkeepingJournalEntryRun)
      .set({ status: 'superseded', updatedAt: ts })
      .where(
        and(
          eq(bookkeepingJournalEntryRun.uploadSessionId, params.sessionId),
          eq(bookkeepingJournalEntryRun.tenantId, params.tenantId),
          inArray(bookkeepingJournalEntryRun.status, ACTIVE_JOURNAL_RUN_STATUSES),
        ),
      )

    await tx.insert(bookkeepingJournalEntryRun).values({
      id: runId,
      tenantId: params.tenantId,
      uploadSessionId: params.sessionId,
      sourceBatchId,
      classificationRunId: classificationRun.id,
      status: 'draft',
      rowCount: voucherPlans.length,
      unresolvedRowCount,
      appliedRulesSnapshot: JOURNAL_ENTRY_RULES_SNAPSHOT,
      errorMessage: null,
      createdByStaffId: params.staffRecord.id,
      createdAt: ts,
      updatedAt: ts,
    })

    const voucherContext = {
      tenantId: params.tenantId,
      journalEntryRunId: runId,
      uploadSessionId: params.sessionId,
      sourceBatchId,
      timestamp: ts,
    }

    for (const [index, plan] of voucherPlans.entries()) {
      const voucherId = randomUUID()
      const voucherNumber = formatJournalEntryVoucherNumber(index + 1)

      if (plan.kind === 'remittance_fee') {
        const stored = buildStoredVoucherRecordsFromRemittanceFeeDraft(plan.draft, {
          ...voucherContext,
          requestedPeriod: plan.draft.requestedPeriod,
          attributedPeriod: plan.draft.attributedPeriod,
          closePeriod: plan.draft.closePeriod,
          voucherId,
          voucherNumber,
          lineIds: [randomUUID(), randomUUID(), randomUUID()],
        })

        await tx.insert(bookkeepingJournalEntryVoucher).values(stored.voucher)
        await tx.insert(bookkeepingJournalEntryVoucherLine).values(stored.lines)
        continue
      }

      if (plan.kind === 'sales_vat') {
        const stored = buildStoredVoucherRecordsFromSalesVatDraft(plan.draft, {
          ...voucherContext,
          requestedPeriod: plan.draft.requestedPeriod,
          attributedPeriod: plan.draft.attributedPeriod,
          closePeriod: plan.draft.closePeriod,
          voucherId,
          voucherNumber,
          lineIds: [randomUUID(), randomUUID(), randomUUID()],
        })

        await tx.insert(bookkeepingJournalEntryVoucher).values(stored.voucher)
        await tx.insert(bookkeepingJournalEntryVoucherLine).values(stored.lines)
        continue
      }

      const debitLineId = randomUUID()
      const creditLineId = randomUUID()
      const stored = buildStoredVoucherRecordsFromDraft(plan.draft, {
        ...voucherContext,
        requestedPeriod: plan.draft.requestedPeriod,
        attributedPeriod: plan.draft.attributedPeriod,
        closePeriod: plan.draft.closePeriod,
        voucherId,
        voucherNumber,
        debitLineId,
        creditLineId,
      })

      await tx.insert(bookkeepingJournalEntryVoucher).values(stored.voucher)
      await tx.insert(bookkeepingJournalEntryVoucherLine).values(stored.lines)
    }
  }).catch((error) => {
    throw normalizeJournalEntryVoucherStorageError(error)
  })

  return { ok: true as const, runId, rowCount: voucherPlans.length, unresolvedRowCount }
}

export async function getLatestBookkeepingJournalEntry(params: {
  sessionId: string
  tenantId: string
}) {
  const [latestClassificationRun] = await db
    .select({ id: bookkeepingClassificationRun.id, createdAt: bookkeepingClassificationRun.createdAt })
    .from(bookkeepingClassificationRun)
    .where(
      and(
        eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId),
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.status, 'completed'),
      ),
    )
    .orderBy(desc(bookkeepingClassificationRun.createdAt))
    .limit(1)

  const [run] = await db
    .select()
    .from(bookkeepingJournalEntryRun)
    .where(and(eq(bookkeepingJournalEntryRun.uploadSessionId, params.sessionId), eq(bookkeepingJournalEntryRun.tenantId, params.tenantId)))
    .orderBy(desc(bookkeepingJournalEntryRun.createdAt))
    .limit(1)

  if (!run) return { run: null, voucherLines: [], staleReason: null }

  if (latestClassificationRun && run.classificationRunId !== latestClassificationRun.id) {
    return {
      run: null,
      voucherLines: [],
      staleReason: '계정항목 정리가 업데이트되어 전표 분개표 초안을 다시 생성해야 합니다.',
    }
  }

  const voucherLines = await loadJournalEntryVoucherDisplayLines({
    runId: run.id,
    tenantId: params.tenantId,
  })

  return { run, voucherLines, staleReason: null }
}

async function loadJournalEntryVoucherDisplayLines(params: {
  runId: string
  tenantId: string
}): Promise<JournalEntryVoucherLine[]> {
  try {
    const vouchers = await db
      .select({
        id: bookkeepingJournalEntryVoucher.id,
        voucherNumber: bookkeepingJournalEntryVoucher.voucherNumber,
        entryDate: bookkeepingJournalEntryVoucher.entryDate,
        status: bookkeepingJournalEntryVoucher.status,
      })
      .from(bookkeepingJournalEntryVoucher)
      .where(
        and(
          eq(bookkeepingJournalEntryVoucher.journalEntryRunId, params.runId),
          eq(bookkeepingJournalEntryVoucher.tenantId, params.tenantId),
        ),
      )
      .orderBy(bookkeepingJournalEntryVoucher.voucherNumber)

    if (vouchers.length > 0) {
      const voucherIds = vouchers.map((voucher) => voucher.id)
      const lines = await db
        .select({
          id: bookkeepingJournalEntryVoucherLine.id,
          voucherId: bookkeepingJournalEntryVoucherLine.voucherId,
          lineSequence: bookkeepingJournalEntryVoucherLine.lineSequence,
          side: bookkeepingJournalEntryVoucherLine.side,
          accountName: bookkeepingJournalEntryVoucherLine.accountName,
          accountCode: bookkeepingJournalEntryVoucherLine.accountCode,
          amountKrw: bookkeepingJournalEntryVoucherLine.amountKrw,
          counterparty: bookkeepingJournalEntryVoucherLine.counterparty,
          counterpartyCode: bookkeepingJournalEntryVoucherLine.counterpartyCode,
          memo: bookkeepingJournalEntryVoucherLine.memo,
        })
        .from(bookkeepingJournalEntryVoucherLine)
        .where(
          and(
            eq(bookkeepingJournalEntryVoucherLine.tenantId, params.tenantId),
            inArray(bookkeepingJournalEntryVoucherLine.voucherId, voucherIds),
          ),
        )

      return mapStoredVoucherLinesToDisplayLines(vouchers, lines).filter((line) => line.voucherStatus !== 'excluded')
    }
  } catch (error) {
    if (!isMissingJournalEntryVoucherTableError(error)) {
      throw error
    }
  }

  return loadLegacyJournalEntryVoucherDisplayLines(params)
}

async function refreshJournalRunCounts(params: {
  runId: string
  tenantId: string
}) {
  let rows: Array<{ status: typeof bookkeepingJournalEntryRow.$inferSelect.status }> = []

  try {
    const vouchers = await db
      .select({ status: bookkeepingJournalEntryVoucher.status })
      .from(bookkeepingJournalEntryVoucher)
      .where(
        and(
          eq(bookkeepingJournalEntryVoucher.journalEntryRunId, params.runId),
          eq(bookkeepingJournalEntryVoucher.tenantId, params.tenantId),
        ),
      )

    if (vouchers.length > 0) {
      rows = vouchers
    }
  } catch (error) {
    if (!isMissingJournalEntryVoucherTableError(error)) {
      throw error
    }
  }

  if (rows.length === 0) {
    rows = await db
      .select({ status: bookkeepingJournalEntryRow.status })
      .from(bookkeepingJournalEntryRow)
      .where(and(eq(bookkeepingJournalEntryRow.journalEntryRunId, params.runId), eq(bookkeepingJournalEntryRow.tenantId, params.tenantId)))
  }

  await db
    .update(bookkeepingJournalEntryRun)
    .set({
      rowCount: rows.length,
      unresolvedRowCount: rows.filter((row) => row.status === 'needs_decision').length,
      updatedAt: toDBString(now()),
    })
    .where(and(eq(bookkeepingJournalEntryRun.id, params.runId), eq(bookkeepingJournalEntryRun.tenantId, params.tenantId)))
}

export async function updateBookkeepingJournalEntryRow(params: {
  rowId: string
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
  debitAccount?: string | null
  debitAmountKrw?: number | null
  creditAccount?: string | null
  creditAmountKrw?: number | null
  memo?: string | null
  status?: JournalEntryRowStatus
  staffMemo?: string | null
}) {
  const sessionRow = await getSessionForStaff(params)
  if (!sessionRow) return { ok: false as const, status: 404, error: '세션을 찾을 수 없습니다.' }

  const [row] = await db
    .select()
    .from(bookkeepingJournalEntryRow)
    .where(
      and(
        eq(bookkeepingJournalEntryRow.id, params.rowId),
        eq(bookkeepingJournalEntryRow.uploadSessionId, params.sessionId),
        eq(bookkeepingJournalEntryRow.tenantId, params.tenantId),
      ),
    )
    .limit(1)

  if (!row) return { ok: false as const, status: 404, error: '전표 분개표 행을 찾을 수 없습니다.' }

  const nextStatus = params.status ?? row.status
  const nextStaffMemo = params.staffMemo === undefined ? row.staffMemo : params.staffMemo
  const debitAmount = params.debitAmountKrw === undefined ? row.debitAmountKrw : params.debitAmountKrw
  const creditAmount = params.creditAmountKrw === undefined ? row.creditAmountKrw : params.creditAmountKrw
  const debitAccount = params.debitAccount === undefined ? row.debitAccount : params.debitAccount
  const creditAccount = params.creditAccount === undefined ? row.creditAccount : params.creditAccount

  if (nextStatus === 'confirmed' && (!debitAccount || !creditAccount || !debitAmount || !creditAmount || debitAmount !== creditAmount)) {
    return { ok: false as const, status: 400, error: '확정하려면 차변/대변 계정과 동일한 금액이 필요합니다.' }
  }
  if (nextStatus === 'excluded' && !nextStaffMemo?.trim()) {
    return { ok: false as const, status: 400, error: '제외하려면 메모가 필요합니다.' }
  }

  await db
    .update(bookkeepingJournalEntryRow)
    .set({
      debitAccount,
      debitAmountKrw: debitAmount,
      creditAccount,
      creditAmountKrw: creditAmount,
      memo: params.memo === undefined ? row.memo : params.memo,
      status: nextStatus,
      staffMemo: nextStaffMemo,
      confirmedByStaffId: nextStatus === 'confirmed' ? params.staffRecord.id : row.confirmedByStaffId,
      confirmedAt: nextStatus === 'confirmed' ? toDBString(now()) : row.confirmedAt,
      updatedAt: toDBString(now()),
    })
    .where(and(eq(bookkeepingJournalEntryRow.id, params.rowId), eq(bookkeepingJournalEntryRow.tenantId, params.tenantId)))

  await refreshJournalRunCounts({ runId: row.journalEntryRunId, tenantId: params.tenantId })
  return { ok: true as const }
}
