import { randomUUID } from 'crypto'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import {
  bookkeepingTransactionClassification,
  bookkeepingTransactionPurposeRequest,
  bookkeepingTransactionPurposeRequestRow,
  client,
  outboundEmail,
  staff,
  tenant,
  uploadSession,
} from '@/lib/db/schema'
import { getTenantEmailFrom } from '@/lib/email/from'
import { requireEmailEnv } from '@/lib/env'
import { resolveStoredUploadUrl } from '@/lib/upload/resolve-upload-url'
import { fromISO, now, toDBString } from '@/lib/time'
import {
  staffDraftCreateSchema,
  staffDraftUpdateSchema,
} from '@/lib/validations/transaction-purpose-request'
import { getSessionForStaff, type StaffRecord } from './classification-service'
import {
  buildDefaultPurposeBodyTemplate,
  resolvePurposeTemplate,
  type PurposeTemplateContext,
} from './transaction-purpose-template'

// docs/03_Technical_Specs/40_TRANSACTION_PURPOSE_CONFIRMATION_SPEC.md
// draft 생성/수정(Slice 2) + 발송(Slice 3). 고객 포털은 Slice 4, 답변 확정은 Slice 5.

type ServiceOk<T> = { ok: true } & T
type ServiceErr = { ok: false; status: number; error: string }
type ServiceResult<T> = ServiceOk<T> | ServiceErr

// 세션 종료 상태 — 이 상태의 세션에는 확인 요청을 만들 수 없다(spec §2).
const TERMINAL_SESSION_STATUSES = ['completed', 'expired', 'revoked'] as const

// 고객 비노출 row는 확인 요청에 넣지 않는다.
const EXCLUDED_CLASSIFICATION_STATUS = 'excluded'

// 고객에게 묻는 기본 질문. 거래 식별 정보는 카드에 별도 표시되므로 질문은 보편적으로 둔다(UX §5.2).
const DEFAULT_STAFF_QUESTION = '이 거래는 어떤 목적으로 사용하셨나요?'

type ClassificationRow = typeof bookkeepingTransactionClassification.$inferSelect

function buildRowSnapshot(row: ClassificationRow, staffQuestion: string) {
  return {
    classificationRowId: row.id,
    sourceDisplayDate: row.transactionDate,
    // 거래처가 없으면 적요(설명)로 대체 — 고객이 거래를 식별할 수준만.
    sourceDisplayCounterparty: row.merchantName ?? row.description ?? null,
    sourceDisplayAmountKrw: row.amountKrw ?? null,
    sourceDisplayMemo: row.description ?? null,
    staffQuestion,
    aiRecommendedAccount: row.recommendedAccount ?? null,
    ambiguityReason: row.recommendationReason ?? null,
  }
}

// dueAt 문자열을 Luxon으로 검증해 DB 문자열로 정규화. invalid면 에러.
function normalizeDueAt(value: string): ServiceErr | { ok: true; dbString: string } {
  const dt = fromISO(value)
  if (!dt.isValid) {
    return { ok: false, status: 400, error: '답변 기한이 올바른 날짜가 아닙니다.' }
  }
  return { ok: true, dbString: toDBString(dt) }
}

export async function createPurposeRequestDraft(params: {
  sessionId: string
  tenantId: string
  staffRecord: StaffRecord
  input: z.infer<typeof staffDraftCreateSchema>
}): Promise<ServiceResult<{ id: string; status: 'draft'; rowCount: number }>> {
  const { sessionId, tenantId, staffRecord, input } = params

  // 세션 접근 권한 = 계정항목 분류 workspace 접근 권한과 동일하게 취급한다.
  const sessionRow = await getSessionForStaff({ sessionId, tenantId, staffRecord })
  if (!sessionRow) {
    return { ok: false, status: 404, error: '세션을 찾을 수 없거나 접근 권한이 없습니다.' }
  }

  if (sessionRow.session.requestKind !== 'general') {
    return {
      ok: false,
      status: 409,
      error: '일반 자료(기장) 세션에서만 거래 용도 확인을 사용할 수 있습니다.',
    }
  }
  if (TERMINAL_SESSION_STATUSES.includes(sessionRow.session.status as (typeof TERMINAL_SESSION_STATUSES)[number])) {
    return {
      ok: false,
      status: 409,
      error: '완료·만료·취소된 세션에서는 확인 요청을 만들 수 없습니다.',
    }
  }

  // 선택한 row가 모두 이 세션/테넌트에 속하는지 검증(spec §2/§6.1).
  const rows = await db
    .select()
    .from(bookkeepingTransactionClassification)
    .where(
      and(
        eq(bookkeepingTransactionClassification.tenantId, tenantId),
        eq(bookkeepingTransactionClassification.uploadSessionId, sessionId),
        inArray(bookkeepingTransactionClassification.id, input.selectedClassificationRowIds),
      ),
    )
  if (rows.length !== input.selectedClassificationRowIds.length) {
    return { ok: false, status: 400, error: '선택한 거래 row 중 일부를 찾을 수 없습니다.' }
  }
  if (rows.some((row) => row.status === EXCLUDED_CLASSIFICATION_STATUS)) {
    return { ok: false, status: 400, error: '제외 처리된 거래는 확인 요청에 포함할 수 없습니다.' }
  }

  let dueAtDb: string | null = null
  if (input.dueAt) {
    const parsed = normalizeDueAt(input.dueAt)
    if (!parsed.ok) return parsed
    dueAtDb = parsed.dbString
  }

  const staffQuestion = input.staffQuestionOverride?.trim() || DEFAULT_STAFF_QUESTION
  const subjectSnapshot = `${sessionRow.clientName} ${sessionRow.session.accountingPeriod} 거래 용도 확인 요청드립니다`
  // 본문은 플레이스홀더 템플릿으로 초기화. 담당자가 편집 후, 발송 시 치환된다.
  const bodySnapshot = buildDefaultPurposeBodyTemplate()
  const ts = toDBString(now())
  const id = randomUUID()
  const classificationRunIds = new Set(rows.map((row) => row.classificationRunId))
  const classificationRunId = classificationRunIds.size === 1 ? rows[0]?.classificationRunId ?? null : null

  await db.transaction(async (tx) => {
    await tx.insert(bookkeepingTransactionPurposeRequest).values({
      id,
      tenantId,
      uploadSessionId: sessionId,
      classificationRunId,
      clientId: sessionRow.session.clientId,
      status: 'draft',
      subjectSnapshot,
      bodySnapshot,
      dueAt: dueAtDb,
      createdByStaffId: staffRecord.id,
      createdAt: ts,
      updatedAt: ts,
    })
    await tx.insert(bookkeepingTransactionPurposeRequestRow).values(
      rows.map((row) => ({
        id: randomUUID(),
        tenantId,
        purposeRequestId: id,
        ...buildRowSnapshot(row, staffQuestion),
        status: 'pending' as const,
        createdAt: ts,
        updatedAt: ts,
      })),
    )
  })

  return { ok: true, id, status: 'draft', rowCount: rows.length }
}

export async function updatePurposeRequestDraft(params: {
  requestId: string
  tenantId: string
  staffRecord: StaffRecord
  input: z.infer<typeof staffDraftUpdateSchema>
}): Promise<ServiceResult<{ id: string; status: 'draft' | 'cancelled' }>> {
  const { requestId, tenantId, staffRecord, input } = params

  const [request] = await db
    .select()
    .from(bookkeepingTransactionPurposeRequest)
    .where(
      and(
        eq(bookkeepingTransactionPurposeRequest.id, requestId),
        eq(bookkeepingTransactionPurposeRequest.tenantId, tenantId),
      ),
    )
    .limit(1)
  if (!request) {
    return { ok: false, status: 404, error: '확인 요청을 찾을 수 없습니다.' }
  }
  if (request.status !== 'draft') {
    return { ok: false, status: 409, error: '발송 전(draft) 상태에서만 수정할 수 있습니다.' }
  }
  // STAFF는 본인이 만든 draft만 수정. TENANT_ADMIN은 전체.
  if (staffRecord.role === 'STAFF' && request.createdByStaffId !== staffRecord.id) {
    return { ok: false, status: 403, error: '이 draft를 수정할 권한이 없습니다.' }
  }

  const ts = toDBString(now())

  // 취소가 우선. 다른 필드와 함께 와도 취소만 적용.
  if (input.cancel) {
    await db
      .update(bookkeepingTransactionPurposeRequest)
      .set({ status: 'cancelled', updatedAt: ts })
      .where(eq(bookkeepingTransactionPurposeRequest.id, requestId))
    return { ok: true, id: requestId, status: 'cancelled' }
  }

  const set: Record<string, unknown> = { updatedAt: ts }

  if (input.subjectSnapshot !== undefined) {
    set.subjectSnapshot = input.subjectSnapshot
  }
  if (input.bodySnapshot !== undefined) {
    set.bodySnapshot = input.bodySnapshot
  }
  if (input.dueAt !== undefined) {
    if (input.dueAt === null) {
      set.dueAt = null
    } else {
      const parsed = normalizeDueAt(input.dueAt)
      if (!parsed.ok) return parsed
      set.dueAt = parsed.dbString
    }
  }

  // row 추가 후보를 트랜잭션 밖에서 검증한다 — excluded row는 400으로 응답하기 위해.
  // 추가 row의 staff_question은 기본 질문으로 채운다(override는 create 시에만).
  let newRowsToInsert: (typeof bookkeepingTransactionPurposeRequestRow)['$inferInsert'][] = []
  if (input.addClassificationRowIds && input.addClassificationRowIds.length > 0) {
    // 이미 이 요청에 연결된 row는 중복 제외.
    const existing = await db
      .select({ classificationRowId: bookkeepingTransactionPurposeRequestRow.classificationRowId })
      .from(bookkeepingTransactionPurposeRequestRow)
      .where(
        and(
          eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, requestId),
          eq(bookkeepingTransactionPurposeRequestRow.tenantId, tenantId),
          inArray(
            bookkeepingTransactionPurposeRequestRow.classificationRowId,
            input.addClassificationRowIds,
          ),
        ),
      )
    const alreadyLinked = new Set(
      existing.map((r) => r.classificationRowId).filter((v): v is string => v !== null),
    )
    const candidateIds = input.addClassificationRowIds.filter((id) => !alreadyLinked.has(id))
    if (candidateIds.length > 0) {
      const newRows = await db
        .select()
        .from(bookkeepingTransactionClassification)
        .where(
          and(
            eq(bookkeepingTransactionClassification.tenantId, tenantId),
            eq(bookkeepingTransactionClassification.uploadSessionId, request.uploadSessionId),
            inArray(bookkeepingTransactionClassification.id, candidateIds),
          ),
        )
      // create 경로와 동일하게: 조회된 row 수 == 후보 id 수. 다르면 일부가 이 세션/테넌트
      // 소속이 아님(크로스 테넌트/세션). 일부만 추가하고 성공하는 것을 방지(spec §2/QA).
      if (newRows.length !== candidateIds.length) {
        return { ok: false, status: 400, error: '추가하려는 거래 row 중 일부를 찾을 수 없습니다.' }
      }
      if (newRows.some((row) => row.status === EXCLUDED_CLASSIFICATION_STATUS)) {
        return { ok: false, status: 400, error: '제외 처리된 거래는 확인 요청에 포함할 수 없습니다.' }
      }
      newRowsToInsert = newRows.map((row) => ({
        id: randomUUID(),
        tenantId,
        purposeRequestId: requestId,
        ...buildRowSnapshot(row, DEFAULT_STAFF_QUESTION),
        status: 'pending',
        createdAt: ts,
        updatedAt: ts,
      }))
    }
  }

  await db.transaction(async (tx) => {
    // row 제거(발송 전이므로 hard delete — 아직 고객에게 노출된 적 없음).
    if (input.removeRowIds && input.removeRowIds.length > 0) {
      await tx
        .delete(bookkeepingTransactionPurposeRequestRow)
        .where(
          and(
            eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, requestId),
            eq(bookkeepingTransactionPurposeRequestRow.tenantId, tenantId),
            inArray(bookkeepingTransactionPurposeRequestRow.id, input.removeRowIds),
            eq(bookkeepingTransactionPurposeRequestRow.status, 'pending'),
          ),
        )
    }

    if (newRowsToInsert.length > 0) {
      await tx.insert(bookkeepingTransactionPurposeRequestRow).values(newRowsToInsert)
    }

    await tx
      .update(bookkeepingTransactionPurposeRequest)
      .set(set)
      .where(eq(bookkeepingTransactionPurposeRequest.id, requestId))
  })

  return { ok: true, id: requestId, status: 'draft' }
}

// 발송 불가 세션 상태 — 토큰이 무효화된 상태. (completed는 토큰 유효 → 허용)
const SEND_BLOCKED_SESSION_STATUSES = ['expired', 'revoked'] as const

type DraftRow = typeof bookkeepingTransactionPurposeRequestRow.$inferSelect
type DraftRequest = typeof bookkeepingTransactionPurposeRequest.$inferSelect

export type PurposeRequestDraftView = {
  request: Pick<
    DraftRequest,
    | 'id'
    | 'status'
    | 'subjectSnapshot'
    | 'bodySnapshot'
    | 'dueAt'
    | 'uploadSessionId'
    | 'clientId'
    | 'createdAt'
    | 'sentAt'
  >
  rows: DraftRow[]
  templateContext: PurposeTemplateContext
}

// 담당자 draft 상세/미리보기용 로드. creator 또는 TENANT_ADMIN만.
export async function getPurposeRequestDraft(params: {
  requestId: string
  tenantId: string
  staffRecord: StaffRecord
}): Promise<ServiceResult<PurposeRequestDraftView>> {
  const { requestId, tenantId, staffRecord } = params

  const [request] = await db
    .select()
    .from(bookkeepingTransactionPurposeRequest)
    .where(
      and(
        eq(bookkeepingTransactionPurposeRequest.id, requestId),
        eq(bookkeepingTransactionPurposeRequest.tenantId, tenantId),
      ),
    )
    .limit(1)
  if (!request) {
    return { ok: false, status: 404, error: '확인 요청을 찾을 수 없습니다.' }
  }
  if (staffRecord.role === 'STAFF' && request.createdByStaffId !== staffRecord.id) {
    return { ok: false, status: 403, error: '이 요청을 볼 권한이 없습니다.' }
  }

  const [rows, sessionRow, clientRow, tenantRow, staffRow] = await Promise.all([
    db
      .select()
      .from(bookkeepingTransactionPurposeRequestRow)
      .where(
        and(
          eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, requestId),
          eq(bookkeepingTransactionPurposeRequestRow.tenantId, tenantId),
        ),
      )
      .orderBy(bookkeepingTransactionPurposeRequestRow.createdAt),
    db
      .select({ uploadUrl: uploadSession.uploadUrl })
      .from(uploadSession)
      .where(and(eq(uploadSession.id, request.uploadSessionId), eq(uploadSession.tenantId, tenantId)))
      .limit(1),
    db
      .select({ name: client.name, email: client.email })
      .from(client)
      .where(and(eq(client.id, request.clientId), eq(client.tenantId, tenantId)))
      .limit(1),
    db.select({ name: tenant.name }).from(tenant).where(eq(tenant.id, tenantId)).limit(1),
    db.select({ name: staff.name }).from(staff).where(eq(staff.id, staffRecord.id)).limit(1),
  ])

  const resolvedUploadUrl = resolveStoredUploadUrl(sessionRow[0]?.uploadUrl ?? null)
  const uploadLink = resolvedUploadUrl
    ? `${resolvedUploadUrl}?purposeRequest=${encodeURIComponent(requestId)}`
    : ''

  return {
    ok: true,
    request: {
      id: request.id,
      status: request.status,
      subjectSnapshot: request.subjectSnapshot,
      bodySnapshot: request.bodySnapshot,
      dueAt: request.dueAt,
      uploadSessionId: request.uploadSessionId,
      clientId: request.clientId,
      createdAt: request.createdAt,
      sentAt: request.sentAt,
    },
    rows,
    templateContext: {
      clientName: clientRow[0]?.name ?? '고객사',
      tenantName: tenantRow[0]?.name ?? '',
      staffName: staffRow[0]?.name ?? '',
      uploadLink,
      dueAt: request.dueAt,
    },
  }
}

// draft 발송. send 버튼 = 담당자 최종 승인+발송(spec §6.3).
export async function sendPurposeRequest(params: {
  requestId: string
  tenantId: string
  staffRecord: StaffRecord
}): Promise<ServiceResult<{ id: string; status: 'sent'; outboundEmailId: string }>> {
  const { requestId, tenantId, staffRecord } = params

  const [request] = await db
    .select()
    .from(bookkeepingTransactionPurposeRequest)
    .where(
      and(
        eq(bookkeepingTransactionPurposeRequest.id, requestId),
        eq(bookkeepingTransactionPurposeRequest.tenantId, tenantId),
      ),
    )
    .limit(1)
  if (!request) {
    return { ok: false, status: 404, error: '확인 요청을 찾을 수 없습니다.' }
  }
  if (request.status !== 'draft') {
    return { ok: false, status: 409, error: '이미 발송되었거나 종료된 요청입니다.' }
  }
  if (staffRecord.role === 'STAFF' && request.createdByStaffId !== staffRecord.id) {
    return { ok: false, status: 403, error: '이 요청을 발송할 권한이 없습니다.' }
  }

  // 세션 적격성 재검증 — 토큰 무효화 상태면 링크가 동작하지 않아 발송 차단.
  const [sessionRow] = await db
    .select({ uploadUrl: uploadSession.uploadUrl, status: uploadSession.status })
    .from(uploadSession)
    .where(
      and(
        eq(uploadSession.id, request.uploadSessionId),
        eq(uploadSession.tenantId, tenantId),
        isNull(uploadSession.deletedAt),
      ),
    )
    .limit(1)
  if (!sessionRow) {
    return { ok: false, status: 409, error: '세션이 만료되어 발송할 수 없습니다.' }
  }
  if (SEND_BLOCKED_SESSION_STATUSES.includes(sessionRow.status as (typeof SEND_BLOCKED_SESSION_STATUSES)[number])) {
    return { ok: false, status: 409, error: '업로드 링크가 만료/취소되어 발송할 수 없습니다.' }
  }
  const resolvedUploadUrl = resolveStoredUploadUrl(sessionRow.uploadUrl)
  if (!resolvedUploadUrl) {
    return { ok: false, status: 409, error: '업로드 링크를 찾을 수 없어 발송할 수 없습니다.' }
  }

  if (!request.subjectSnapshot.trim() || !request.bodySnapshot.trim()) {
    return { ok: false, status: 400, error: '제목과 본문을 입력한 뒤 발송해 주세요.' }
  }

  const [[clientRow], [tenantRow], [staffRow], [countRow]] = await Promise.all([
    db
      .select({ name: client.name, email: client.email })
      .from(client)
      .where(and(eq(client.id, request.clientId), eq(client.tenantId, tenantId)))
      .limit(1),
    db.select({ name: tenant.name }).from(tenant).where(eq(tenant.id, tenantId)).limit(1),
    db.select({ name: staff.name }).from(staff).where(eq(staff.id, staffRecord.id)).limit(1),
    db
      .select({ n: sql`count(*)` })
      .from(bookkeepingTransactionPurposeRequestRow)
      .where(
        and(
          eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, requestId),
          eq(bookkeepingTransactionPurposeRequestRow.tenantId, tenantId),
        ),
      ),
  ])

  const clientEmail = clientRow?.email?.trim()
  if (!clientEmail) {
    return { ok: false, status: 400, error: '고객사 수신 메일이 없어 발송할 수 없습니다.' }
  }

  // P2 가드: row 0건 발송 차단. PATCH removeRowIds로 모든 row를 지운 draft는 발송 금지.
  const rowCount = Number(countRow?.n ?? 0)
  if (rowCount === 0) {
    return { ok: false, status: 400, error: '고객에게 확인할 거래가 없습니다. 확인 요청에 거래를 추가해 주세요.' }
  }

  const uploadLink = `${resolvedUploadUrl}?purposeRequest=${encodeURIComponent(requestId)}`
  const ctx: PurposeTemplateContext = {
    clientName: clientRow?.name ?? '고객사',
    tenantName: tenantRow?.name ?? '',
    staffName: staffRow?.name ?? '',
    uploadLink,
    dueAt: request.dueAt,
  }
  const finalSubject = resolvePurposeTemplate(request.subjectSnapshot, ctx)
  const finalBody = resolvePurposeTemplate(request.bodySnapshot, ctx)

  // 발송 시점 기준 스냅샷(outbound_email.applied_analysis_notes). 거래 상세는 제외.
  const appliedNotes = `transaction-purpose-request:${requestId} rows:${rowCount} session:${request.uploadSessionId}`

  const emailEnv = requireEmailEnv()
  const resend = new Resend(emailEnv.RESEND_API_KEY)
  const emailFrom = await getTenantEmailFrom(tenantId, emailEnv.EMAIL_FROM)

  let sent = false
  try {
    const result = await resend.emails.send({
      from: emailFrom,
      to: clientEmail,
      subject: finalSubject,
      text: finalBody,
    })
    if (result.error || !result.data) {
      throw new Error(result.error?.message ?? 'Resend send failed')
    }
    sent = true
  } catch (err) {
    console.error('[sendPurposeRequest] Resend 발송 실패', err)
  }

  const ts = toDBString(now())
  const outboundEmailId = randomUUID()

  await db.transaction(async (tx) => {
    await tx.insert(outboundEmail).values({
      id: outboundEmailId,
      uploadSessionId: request.uploadSessionId,
      tenantId,
      type: 'transaction_purpose_request',
      status: sent ? 'sent' : 'failed',
      toEmail: clientEmail,
      ccEmail: null,
      subject: finalSubject,
      body: finalBody,
      appliedAnalysisNotes: appliedNotes,
      approvedByStaffId: staffRecord.id,
      sentAt: sent ? ts : null,
      createdAt: ts,
    })

    if (sent) {
      // 발송된 제목/본문(링크 치환 완료)으로 스냅샷 갱신(spec §4.1 sent snapshot).
      await tx
        .update(bookkeepingTransactionPurposeRequest)
        .set({
          status: 'sent',
          subjectSnapshot: finalSubject,
          bodySnapshot: finalBody,
          sentEmailId: outboundEmailId,
          sentByStaffId: staffRecord.id,
          sentAt: ts,
          updatedAt: ts,
        })
        .where(eq(bookkeepingTransactionPurposeRequest.id, requestId))
    }
  })

  if (!sent) {
    return { ok: false, status: 502, error: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
  }
  return { ok: true, id: requestId, status: 'sent', outboundEmailId }
}
