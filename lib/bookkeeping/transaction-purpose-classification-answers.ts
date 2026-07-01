import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingTransactionPurposeRequest,
  bookkeepingTransactionPurposeRequestRow,
} from '@/lib/db/schema'
import { TRANSACTION_PURPOSE_CODE_LABEL } from '@/lib/validations/transaction-purpose-request'

const STAFF_VISIBLE_REQUEST_STATUSES = ['sent', 'partially_answered', 'submitted', 'closed'] as const
const STAFF_VISIBLE_ROW_STATUSES = ['pending', 'answered', 'staff_confirmed'] as const

export type ClassificationPurposeAnswer = {
  id: string
  requestId: string
  requestStatus: string
  isStale: boolean
  status: 'pending' | 'answered' | 'staff_confirmed'
  purposeCode: string | null
  purposeLabel: string | null
  purposeMemo: string | null
  answeredAt: string | null
  staffFinalAccount: string | null
  staffMemo: string | null
}

type ClassificationRowForPurposeAnswer = {
  id: string
  transactionDate?: string | null
  merchantName?: string | null
  description?: string | null
  amountKrw?: number | null
}

type PurposeRowResult = {
  requestId: string
  requestStatus: string
  requestClassificationRunId: string | null
  row: typeof bookkeepingTransactionPurposeRequestRow.$inferSelect
}

function normalizeSnapshotText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function buildClassificationSnapshotKey(row: ClassificationRowForPurposeAnswer) {
  const date = row.transactionDate ?? ''
  const amount = row.amountKrw ?? null
  const counterparty = normalizeSnapshotText(row.merchantName ?? row.description)
  const memo = normalizeSnapshotText(row.description)

  if (!date || amount === null || (!counterparty && !memo)) return null
  return [date, String(amount), counterparty, memo].join('|')
}

function buildPurposeSnapshotKey(row: typeof bookkeepingTransactionPurposeRequestRow.$inferSelect) {
  const date = row.sourceDisplayDate ?? ''
  const amount = row.sourceDisplayAmountKrw ?? null
  const counterparty = normalizeSnapshotText(row.sourceDisplayCounterparty)
  const memo = normalizeSnapshotText(row.sourceDisplayMemo)

  if (!date || amount === null || (!counterparty && !memo)) return null
  return [date, String(amount), counterparty, memo].join('|')
}

function toClassificationPurposeAnswer(
  item: PurposeRowResult,
  currentClassificationRunId: string | null | undefined,
): ClassificationPurposeAnswer {
  return {
    id: item.row.id,
    requestId: item.requestId,
    requestStatus: item.requestStatus,
    isStale: Boolean(
      item.requestClassificationRunId
      && currentClassificationRunId
      && item.requestClassificationRunId !== currentClassificationRunId
    ),
    status: item.row.status as ClassificationPurposeAnswer['status'],
    purposeCode: item.row.clientPurposeCode,
    purposeLabel: item.row.clientPurposeCode
      ? TRANSACTION_PURPOSE_CODE_LABEL[item.row.clientPurposeCode as keyof typeof TRANSACTION_PURPOSE_CODE_LABEL] ?? item.row.clientPurposeCode
      : null,
    purposeMemo: item.row.clientPurposeMemo,
    answeredAt: item.row.clientAnsweredAt,
    staffFinalAccount: item.row.staffFinalAccount,
    staffMemo: item.row.staffMemo,
  }
}

export async function attachPurposeAnswersToClassificationRows<
  T extends ClassificationRowForPurposeAnswer,
>(params: {
  tenantId: string
  uploadSessionId: string
  currentClassificationRunId: string | null | undefined
  rows: T[]
}): Promise<Array<T & { purposeAnswer: ClassificationPurposeAnswer | null }>> {
  if (params.rows.length === 0) return params.rows.map((row) => ({ ...row, purposeAnswer: null }))

  const purposeRows = await db
    .select({
      requestId: bookkeepingTransactionPurposeRequest.id,
      requestStatus: bookkeepingTransactionPurposeRequest.status,
      requestClassificationRunId: bookkeepingTransactionPurposeRequest.classificationRunId,
      row: bookkeepingTransactionPurposeRequestRow,
    })
    .from(bookkeepingTransactionPurposeRequestRow)
    .innerJoin(
      bookkeepingTransactionPurposeRequest,
      and(
        eq(bookkeepingTransactionPurposeRequest.id, bookkeepingTransactionPurposeRequestRow.purposeRequestId),
        eq(bookkeepingTransactionPurposeRequest.tenantId, params.tenantId),
      ),
    )
    .where(
      and(
        eq(bookkeepingTransactionPurposeRequestRow.tenantId, params.tenantId),
        eq(bookkeepingTransactionPurposeRequest.uploadSessionId, params.uploadSessionId),
        inArray(bookkeepingTransactionPurposeRequest.status, [...STAFF_VISIBLE_REQUEST_STATUSES]),
        inArray(bookkeepingTransactionPurposeRequestRow.status, [...STAFF_VISIBLE_ROW_STATUSES]),
      ),
    )
    .orderBy(desc(bookkeepingTransactionPurposeRequestRow.updatedAt), desc(bookkeepingTransactionPurposeRequestRow.createdAt))

  const latestByClassificationRow = new Map<string, ClassificationPurposeAnswer>()
  const latestBySnapshotKey = new Map<string, ClassificationPurposeAnswer>()
  for (const item of purposeRows) {
    const answer = toClassificationPurposeAnswer(item, params.currentClassificationRunId)
    const classificationRowId = item.row.classificationRowId
    if (classificationRowId && !latestByClassificationRow.has(classificationRowId)) {
      latestByClassificationRow.set(classificationRowId, answer)
    }

    const snapshotKey = buildPurposeSnapshotKey(item.row)
    if (snapshotKey && !latestBySnapshotKey.has(snapshotKey)) {
      latestBySnapshotKey.set(snapshotKey, answer)
    }
  }

  const currentRowKeyCounts = new Map<string, number>()
  for (const row of params.rows) {
    const snapshotKey = buildClassificationSnapshotKey(row)
    if (!snapshotKey) continue
    currentRowKeyCounts.set(snapshotKey, (currentRowKeyCounts.get(snapshotKey) ?? 0) + 1)
  }

  return params.rows.map((row) => ({
    ...row,
    purposeAnswer: latestByClassificationRow.get(row.id)
      ?? (() => {
        const snapshotKey = buildClassificationSnapshotKey(row)
        if (!snapshotKey || currentRowKeyCounts.get(snapshotKey) !== 1) return null
        return latestBySnapshotKey.get(snapshotKey) ?? null
      })(),
  }))
}
