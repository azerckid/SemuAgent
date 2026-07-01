import { NextResponse } from 'next/server'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientRequestEvent, uploadSession, client, staff } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { createSessionSchema } from '@/lib/validations/session'
import { createSessionAndSend } from '@/lib/services/session-service'
import { normalizeCcEmails } from '@/lib/email/cc'
import { acquireSendLock, isUniqueConstraintError, releaseSendLock } from '@/lib/locks/send-lock'
import { deterministicDirectSessionEventId } from '@/lib/sessions/direct-send'
import { now, toDBString, tokenExpiry } from '@/lib/time'

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession()

    const rows = await db
      .select({
        id: uploadSession.id,
        accountingPeriod: uploadSession.accountingPeriod,
        status: uploadSession.status,
        expiresAt: uploadSession.expiresAt,
        lastAccessedAt: uploadSession.lastAccessedAt,
        createdAt: uploadSession.createdAt,
        clientName: client.name,
        clientEmail: client.email,
        staffName: staff.name,
      })
      .from(uploadSession)
      .innerJoin(client, eq(uploadSession.clientId, client.id))
      .innerJoin(staff, eq(uploadSession.createdByStaffId, staff.id))
      .where(and(eq(uploadSession.tenantId, tenantId), isNull(uploadSession.deletedAt)))
      .orderBy(desc(uploadSession.createdAt))

    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/sessions]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()

    const body = await req.json()
    const parsed = createSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const {
      clientId,
      accountingPeriod,
      closingDate,
      requestEmailSubject,
      requestEmailGreeting,
      requestEmailBody,
      senderPhone,
      requestEmailCc,
      extractedCriteria,
      additionalCriteria,
      analysisNotes,
    } = parsed.data

    const clientRows = await db
      .select()
      .from(client)
      .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
      .limit(1)

    const clientRecord = clientRows[0]
    if (!clientRecord) {
      return NextResponse.json({ error: '클라이언트를 찾을 수 없습니다' }, { status: 404 })
    }

    const staffRows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    const staffRecord = staffRows[0]
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    const normalizedRequestEmailCc = normalizeCcEmails(requestEmailCc)
    const requestEventId = deterministicDirectSessionEventId({
      tenantId,
      clientId,
      accountingPeriod,
      closingDateISO: closingDate,
      requestEmailSubject,
      requestEmailBody,
      requestEmailGreeting,
      senderPhone,
      requestEmailCc: normalizedRequestEmailCc,
      extractedCriteria,
      additionalCriteria,
      analysisNotes,
    })

    const eventStatus = await ensureDirectRequestEvent({
      requestEventId,
      tenantId,
      clientId,
      staffId: staffRecord.id,
      accountingPeriod,
      closingDate,
      requestEmailSubject,
      requestEmailBody,
      requestEmailGreeting,
      senderPhone,
      requestEmailCc: normalizedRequestEmailCc,
      extractedCriteria,
      additionalCriteria,
      analysisNotes,
    })

    if (eventStatus === 'already_sent') {
      return NextResponse.json({ error: '이미 발송된 자료 요청입니다' }, { status: 409 })
    }

    if (eventStatus === 'orphaned_session') {
      return NextResponse.json(
        { error: '이전 발송 시도의 세션이 남아 있습니다. 세션 상세를 확인해 주세요.' },
        { status: 409 },
      )
    }

    const lockId = await acquireSendLock(tenantId, requestEventId)
    if (!lockId) {
      return NextResponse.json(
        { error: '동일 요청이 이미 발송 처리 중입니다. 잠시 후 다시 시도해 주세요.' },
        { status: 409 },
      )
    }

    let lockOutcome: 'completed' | 'failed' = 'failed'
    let sessionId: string
    try {
      const result = await createSessionAndSend({
        tenantId,
        clientId,
        staffId: staffRecord.id,
        staffName: staffRecord.name,
        staffEmail: staffRecord.email,
        clientEmail: clientRecord.email,
        clientName: clientRecord.name,
        clientContactName: clientRecord.contactName,
        accountingPeriod,
        closingDateISO: closingDate,
        requestEmailSubject,
        requestEmailBody,
        requestEmailGreeting,
        senderPhone,
        requestEmailCc: normalizedRequestEmailCc,
        extractedCriteria,
        additionalCriteria,
        analysisNotes,
        requestEventId,
        requestKind: 'general',
      })
      sessionId = result.sessionId

      await db
        .update(clientRequestEvent)
        .set({ uploadSessionId: sessionId, status: 'sent', updatedAt: toDBString(now()) })
        .where(and(
          eq(clientRequestEvent.id, requestEventId),
          eq(clientRequestEvent.tenantId, tenantId),
          isNull(clientRequestEvent.uploadSessionId),
        ))

      lockOutcome = 'completed'
    } finally {
      await releaseSendLock(lockId, lockOutcome).catch((err) =>
        console.error('[POST /api/sessions] releaseSendLock 실패', { requestEventId, err }),
      )
    }

    return NextResponse.json({ sessionId })
  } catch (err) {
    console.error('[POST /api/sessions]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === '이메일 발송에 실패했습니다') {
      return NextResponse.json({ error: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

type DirectEventStatus = 'created' | 'reusable_draft' | 'already_sent' | 'orphaned_session'

async function ensureDirectRequestEvent({
  requestEventId,
  tenantId,
  clientId,
  staffId,
  accountingPeriod,
  closingDate,
  requestEmailSubject,
  requestEmailBody,
  requestEmailGreeting,
  senderPhone,
  requestEmailCc,
  extractedCriteria,
  additionalCriteria,
  analysisNotes,
}: {
  requestEventId: string
  tenantId: string
  clientId: string
  staffId: string
  accountingPeriod: string
  closingDate: string
  requestEmailSubject: string
  requestEmailBody: string
  requestEmailGreeting?: string
  senderPhone?: string
  requestEmailCc: string | null
  extractedCriteria?: string | null
  additionalCriteria?: string | null
  analysisNotes?: string | null
}): Promise<DirectEventStatus> {
  const ts = toDBString(now())
  try {
    await db.insert(clientRequestEvent).values({
      id: requestEventId,
      tenantId,
      clientId,
      requestScheduleId: null,
      requestTemplateId: null,
      uploadSessionId: null,
      accountingPeriod,
      frequency: 'custom',
      requestKind: 'general',
      title: `${accountingPeriod} 자료 요청`,
      dueAt: toDBString(tokenExpiry(closingDate)),
      status: 'draft_ready',
      requestItemsSnapshot: null,
      emailSubjectSnapshot: requestEmailSubject,
      emailBodySnapshot: requestEmailBody,
      emailGreetingSnapshot: requestEmailGreeting ?? null,
      senderPhoneSnapshot: senderPhone ?? null,
      ccEmailSnapshot: requestEmailCc,
      analysisCriteriaSnapshot: analysisNotes ?? additionalCriteria ?? extractedCriteria ?? null,
      createdByStaffId: staffId,
      createdAt: ts,
      updatedAt: ts,
    })
    return 'created'
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err
  }

  const [eventRows, orphanedSessionRows] = await Promise.all([
    db
      .select({
        uploadSessionId: clientRequestEvent.uploadSessionId,
      })
      .from(clientRequestEvent)
      .where(and(
        eq(clientRequestEvent.id, requestEventId),
        eq(clientRequestEvent.tenantId, tenantId),
        isNull(clientRequestEvent.deletedAt),
      ))
      .limit(1),
    db
      .select({ id: uploadSession.id })
      .from(uploadSession)
      .where(and(
        eq(uploadSession.requestEventId, requestEventId),
        eq(uploadSession.tenantId, tenantId),
        isNull(uploadSession.deletedAt),
      ))
      .limit(1),
  ])

  if (eventRows[0]?.uploadSessionId) return 'already_sent'
  if (orphanedSessionRows[0]) return 'orphaned_session'
  return 'reusable_draft'
}
