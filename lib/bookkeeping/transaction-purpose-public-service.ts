import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingTransactionPurposeRequest,
  bookkeepingTransactionPurposeRequestRow,
  client,
  staff,
  tenant,
} from '@/lib/db/schema'
import { verifyToken } from '@/lib/session'
import { now, toDBString } from '@/lib/time'
import {
  clientPurposeAnswerSubmitSchema,
  type TransactionPurposeCode,
} from '@/lib/validations/transaction-purpose-request'

type ServiceOk<T> = { ok: true } & T
type ServiceErr = { ok: false; status: number; error: string }
type ServiceResult<T> = ServiceOk<T> | ServiceErr
type VerifiedSession = NonNullable<Awaited<ReturnType<typeof verifyToken>>>

const CUSTOMER_VISIBLE_REQUEST_STATUSES = ['sent', 'partially_answered', 'submitted'] as const
const CUSTOMER_MUTABLE_REQUEST_STATUSES = ['sent', 'partially_answered', 'submitted'] as const
const CUSTOMER_VISIBLE_ROW_STATUSES = ['pending', 'answered'] as const

type PurposeRequestRow = typeof bookkeepingTransactionPurposeRequestRow.$inferSelect

export type ClientPurposeRequestView = {
  request: {
    id: string
    status: 'sent' | 'partially_answered' | 'submitted'
    dueAt: string | null
    submittedAt: string | null
  }
  header: {
    tenantName: string
    clientName: string
    staffName: string
    accountingPeriod: string
  }
  rows: {
    id: string
    date: string | null
    counterparty: string | null
    amountKrw: number | null
    memo: string | null
    question: string
    status: 'pending' | 'answered'
    purposeCode: TransactionPurposeCode | null
    purposeMemo: string | null
    answeredAt: string | null
  }[]
}

function toCustomerRow(row: PurposeRequestRow): ClientPurposeRequestView['rows'][number] {
  return {
    id: row.id,
    date: row.sourceDisplayDate,
    counterparty: row.sourceDisplayCounterparty,
    amountKrw: row.sourceDisplayAmountKrw,
    memo: row.sourceDisplayMemo,
    question: row.staffQuestion,
    status: row.status as 'pending' | 'answered',
    purposeCode: (row.clientPurposeCode as TransactionPurposeCode | null) ?? null,
    purposeMemo: row.clientPurposeMemo,
    answeredAt: row.clientAnsweredAt,
  }
}

async function loadPurposeRequestForToken(params: {
  rawToken: string
  purposeRequestId: string
}): Promise<ServiceResult<{
  session: VerifiedSession
  request: typeof bookkeepingTransactionPurposeRequest.$inferSelect
  rows: PurposeRequestRow[]
}>> {
  const session = await verifyToken(params.rawToken)
  if (!session) {
    return { ok: false, status: 401, error: '유효하지 않거나 만료된 링크입니다.' }
  }
  if (session.status === 'completed') {
    return { ok: false, status: 410, error: '이미 종료된 자료 요청입니다.' }
  }

  const [request] = await db
    .select()
    .from(bookkeepingTransactionPurposeRequest)
    .where(
      and(
        eq(bookkeepingTransactionPurposeRequest.id, params.purposeRequestId),
        eq(bookkeepingTransactionPurposeRequest.tenantId, session.tenantId),
        eq(bookkeepingTransactionPurposeRequest.uploadSessionId, session.id),
        eq(bookkeepingTransactionPurposeRequest.clientId, session.clientId),
      ),
    )
    .limit(1)

  if (!request) {
    return { ok: false, status: 404, error: '거래 용도 확인 요청을 찾을 수 없습니다.' }
  }
  if (!CUSTOMER_VISIBLE_REQUEST_STATUSES.includes(request.status as (typeof CUSTOMER_VISIBLE_REQUEST_STATUSES)[number])) {
    return { ok: false, status: 410, error: '현재 답변할 수 없는 요청입니다.' }
  }

  const rows = await db
    .select()
    .from(bookkeepingTransactionPurposeRequestRow)
    .where(
      and(
        eq(bookkeepingTransactionPurposeRequestRow.tenantId, session.tenantId),
        eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, request.id),
        inArray(bookkeepingTransactionPurposeRequestRow.status, [...CUSTOMER_VISIBLE_ROW_STATUSES]),
      ),
    )
    .orderBy(bookkeepingTransactionPurposeRequestRow.createdAt)

  return { ok: true, session, request, rows }
}

export async function getClientPurposeRequest(params: {
  rawToken: string
  purposeRequestId: string
}): Promise<ServiceResult<ClientPurposeRequestView>> {
  const loaded = await loadPurposeRequestForToken(params)
  if (!loaded.ok) return loaded

  const { session, request, rows } = loaded
  const [[tenantRow], [clientRow], [staffRow]] = await Promise.all([
    db.select({ name: tenant.name }).from(tenant).where(eq(tenant.id, session.tenantId)).limit(1),
    db
      .select({ name: client.name })
      .from(client)
      .where(and(eq(client.id, session.clientId), eq(client.tenantId, session.tenantId)))
      .limit(1),
    db
      .select({ name: staff.name })
      .from(staff)
      .where(and(eq(staff.id, session.createdByStaffId), eq(staff.tenantId, session.tenantId)))
      .limit(1),
  ])

  return {
    ok: true,
    request: {
      id: request.id,
      status: request.status as ClientPurposeRequestView['request']['status'],
      dueAt: request.dueAt,
      submittedAt: request.submittedAt,
    },
    header: {
      tenantName: tenantRow?.name ?? '',
      clientName: clientRow?.name ?? '고객사',
      staffName: staffRow?.name ?? '담당자',
      accountingPeriod: session.accountingPeriod,
    },
    rows: rows.map(toCustomerRow),
  }
}

export async function submitClientPurposeAnswers(params: {
  input: unknown
}): Promise<ServiceResult<{
  requestId: string
  status: 'partially_answered' | 'submitted'
  answeredRowCount: number
}>> {
  const parsed = clientPurposeAnswerSubmitSchema.safeParse(params.input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: '답변 형식이 올바르지 않습니다.' }
  }

  const loaded = await loadPurposeRequestForToken({
    rawToken: parsed.data.token,
    purposeRequestId: parsed.data.purposeRequest,
  })
  if (!loaded.ok) return loaded

  const { session, request, rows } = loaded
  if (!CUSTOMER_MUTABLE_REQUEST_STATUSES.includes(request.status as (typeof CUSTOMER_MUTABLE_REQUEST_STATUSES)[number])) {
    return { ok: false, status: 409, error: '이미 제출되었거나 종료된 요청입니다.' }
  }
  if (rows.length === 0) {
    return { ok: false, status: 409, error: '답변할 거래가 없습니다.' }
  }

  const answerByRowId = new Map(parsed.data.rows.map((row) => [row.rowId, row]))
  const visibleRowIds = new Set(rows.map((row) => row.id))
  if (parsed.data.rows.some((row) => !visibleRowIds.has(row.rowId))) {
    return { ok: false, status: 400, error: '요청에 포함되지 않은 거래 답변이 있습니다.' }
  }

  const ts = toDBString(now())
  const answeredRowIds = parsed.data.rows.map((row) => row.rowId)
  const allRowsAnswered = rows.every((row) => {
    const answer = answerByRowId.get(row.id)
    return Boolean(answer?.memo?.trim() || row.clientPurposeMemo?.trim())
  })
  const nextStatus = parsed.data.submit && allRowsAnswered ? 'submitted' : 'partially_answered'

  await db.transaction(async (tx) => {
    for (const answer of parsed.data.rows) {
      await tx
        .update(bookkeepingTransactionPurposeRequestRow)
        .set({
          clientPurposeCode: answer.purposeCode ?? null,
          clientPurposeMemo: answer.memo.trim(),
          clientAnsweredAt: ts,
          status: 'answered',
          updatedAt: ts,
        })
        .where(
          and(
            eq(bookkeepingTransactionPurposeRequestRow.id, answer.rowId),
            eq(bookkeepingTransactionPurposeRequestRow.tenantId, session.tenantId),
            eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, request.id),
          ),
        )
    }

    await tx
      .update(bookkeepingTransactionPurposeRequest)
      .set({
        status: nextStatus,
        submittedAt: nextStatus === 'submitted' ? ts : request.submittedAt,
        updatedAt: ts,
      })
      .where(
        and(
          eq(bookkeepingTransactionPurposeRequest.id, request.id),
          eq(bookkeepingTransactionPurposeRequest.tenantId, session.tenantId),
        ),
      )
  })

  return {
    ok: true,
    requestId: request.id,
    status: nextStatus,
    answeredRowCount: answeredRowIds.length,
  }
}
