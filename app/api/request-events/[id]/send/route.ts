import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientRequestEvent, outboundEmail, staff, uploadSession } from '@/lib/db/schema'
import { requireEmailEnv } from '@/lib/env'
import { ccEmailsForSend } from '@/lib/email/cc'
import { getTenantEmailFrom } from '@/lib/email/from'
import { acquireSendLock, releaseSendLock } from '@/lib/locks/send-lock'
import { duplicateBasicRequestMessage, titleForBulkSend } from '@/lib/mail-console/bulk-send'
import { now, toDBString } from '@/lib/time'
import { createSessionAndSend, extractDateFromISO } from '@/lib/services/session-service'
import type { BookkeepingPeriodType } from '@/lib/bookkeeping/period-range'

type BasicWorkType = 'bookkeeping' | 'payroll' | 'vat'

function inferBasicWorkTypeFromEvent(event: typeof clientRequestEvent.$inferSelect): BasicWorkType | null {
  if (event.requestKind === 'payroll') return 'payroll'
  if (event.title.includes('부가세')) return 'vat'
  if (event.title.includes('기장')) return 'bookkeeping'
  return null
}

function bookkeepingPeriodTypeFromFrequency(frequency: string | null): BookkeepingPeriodType | null {
  if (frequency === 'monthly' || frequency === 'quarterly') return frequency
  if (frequency === 'annual') return 'yearly'
  return null
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id: eventId } = await params

    // 이벤트 조회 (tenant 격리)
    const eventRows = await db
      .select()
      .from(clientRequestEvent)
      .where(and(
        eq(clientRequestEvent.id, eventId),
        eq(clientRequestEvent.tenantId, tenantId),
        isNull(clientRequestEvent.deletedAt),
      ))
      .limit(1)

    const event = eventRows[0]
    if (!event) {
      return NextResponse.json({ error: '요청 일정을 찾을 수 없습니다' }, { status: 404 })
    }

    // 정상 중복 방지: 이미 세션이 연결된 경우
    if (event.uploadSessionId) {
      return NextResponse.json({ error: '이미 발송된 요청 일정입니다' }, { status: 409 })
    }

    // 고아 세션 복구를 초안 검증보다 먼저 실행
    // 이유: 고아 세션은 outbound_email.body(기존 HTML)로 복구하므로
    // 이벤트 초안 필드가 이후 변경됐어도 복구 자체는 가능해야 함
    const orphanedSessionRows = await db
      .select({ id: uploadSession.id })
      .from(uploadSession)
      .where(and(
        eq(uploadSession.requestEventId, eventId),
        eq(uploadSession.tenantId, tenantId),
        isNull(uploadSession.deletedAt),
      ))
      .limit(1)

    if (orphanedSessionRows[0]) {
      return await recoverOrphanedSession({
        tenantId,
        eventId,
        orphanedSessionId: orphanedSessionRows[0].id,
      })
    }

    // 메일 초안 필수 검증 (신규 발송 경로에서만 적용)
    if (!event.emailSubjectSnapshot?.trim()) {
      return NextResponse.json(
        { error: '메일 제목이 없습니다. 이벤트 수정에서 메일 초안을 먼저 작성해 주세요.' },
        { status: 400 },
      )
    }
    if (!event.emailBodySnapshot?.trim()) {
      return NextResponse.json(
        { error: '메일 본문이 없습니다. 이벤트 수정에서 메일 초안을 먼저 작성해 주세요.' },
        { status: 400 },
      )
    }

    const basicWorkType = inferBasicWorkTypeFromEvent(event)
    if (basicWorkType && (event.frequency !== 'custom' || basicWorkType === 'payroll')) {
      const duplicateConditions = [
        eq(clientRequestEvent.tenantId, tenantId),
        eq(clientRequestEvent.clientId, event.clientId),
        eq(clientRequestEvent.accountingPeriod, event.accountingPeriod),
        eq(clientRequestEvent.requestKind, event.requestKind),
        ne(clientRequestEvent.id, event.id),
        ne(clientRequestEvent.status, 'cancelled'),
        isNull(clientRequestEvent.deletedAt),
        isNotNull(clientRequestEvent.uploadSessionId),
      ]

      if (basicWorkType !== 'payroll') {
        duplicateConditions.push(eq(clientRequestEvent.title, titleForBulkSend({
          workType: basicWorkType,
          accountingPeriod: event.accountingPeriod,
        })))
      }

      const [duplicateEvent] = await db
        .select({ id: clientRequestEvent.id })
        .from(clientRequestEvent)
        .where(and(...duplicateConditions))
        .limit(1)

      if (duplicateEvent) {
        return NextResponse.json(
          { error: duplicateBasicRequestMessage({ workType: basicWorkType, accountingPeriod: event.accountingPeriod }) },
          { status: 409 },
        )
      }
    }

    // 고객사 / 담당자 조회
    const [clientRows, staffRows] = await Promise.all([
      db
        .select()
        .from(client)
        .where(and(eq(client.id, event.clientId), eq(client.tenantId, tenantId)))
        .limit(1),
      db
        .select()
        .from(staff)
        .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
        .limit(1),
    ])

    const clientRecord = clientRows[0]
    if (!clientRecord) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
    }

    const staffRecord = staffRows[0]
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 403 })
    }

    // 동시 발송 차단: 모든 사전 검증을 통과한 직후, 실제 부작용(메일 발송 + 세션 INSERT) 직전에 락 획득.
    // partial unique(WHERE status='running') 덕에 release 후에는 슬롯이 비고 재시도가 가능하다.
    const lockId = await acquireSendLock(tenantId, eventId)
    if (!lockId) {
      return NextResponse.json(
        { error: '동일 요청이 이미 발송 처리 중입니다. 잠시 후 다시 시도해 주세요.' },
        { status: 409 },
      )
    }

    let lockOutcome: 'completed' | 'failed' = 'failed'
    try {
      // 세션 생성 + 이메일 발송
      const closingDateISO = extractDateFromISO(event.dueAt)

      const { sessionId } = await createSessionAndSend({
        tenantId,
        clientId: event.clientId,
        staffId: staffRecord.id,
        staffName: staffRecord.name,
        staffEmail: staffRecord.email,
        clientEmail: clientRecord.email,
        clientName: clientRecord.name,
        clientContactName: clientRecord.contactName,
        accountingPeriod: event.accountingPeriod,
        closingDateISO,
        requestEmailSubject: event.emailSubjectSnapshot,
        requestEmailBody: event.emailBodySnapshot,
        requestEmailGreeting: event.emailGreetingSnapshot ?? undefined,
        senderPhone: event.senderPhoneSnapshot ?? undefined,
        requestEmailCc: event.ccEmailSnapshot ?? undefined,
        analysisNotes: event.analysisCriteriaSnapshot,
        requestEventId: event.id,
        requestTemplateId: event.requestTemplateId,
        requestKind: (event.requestKind as 'general' | 'payroll') ?? 'general',
        bookkeepingPeriodType: bookkeepingPeriodTypeFromFrequency(event.frequency),
      })

      // 성공 시에만 이벤트 업데이트
      // WHERE upload_session_id IS NULL: race condition 2차 방어
      const ts = toDBString(now())
      await db
        .update(clientRequestEvent)
        .set({ uploadSessionId: sessionId, status: 'sent', updatedAt: ts })
        .where(
          and(
            eq(clientRequestEvent.id, eventId),
            eq(clientRequestEvent.tenantId, tenantId),
            isNull(clientRequestEvent.uploadSessionId),
          ),
        )

      lockOutcome = 'completed'
      return NextResponse.json({ sessionId }, { status: 201 })
    } finally {
      await releaseSendLock(lockId, lockOutcome).catch((err) =>
        console.error('[POST /api/request-events/[id]/send] releaseSendLock 실패', err),
      )
    }
  } catch (err) {
    console.error('[POST /api/request-events/[id]/send]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === '이메일 발송에 실패했습니다') {
      // 세션은 생성됐지만 이메일 실패 → 이벤트는 draft_ready 유지 (고아 세션으로 남음)
      // 다음 재시도에서 recoverOrphanedSession이 처리함
      return NextResponse.json({ error: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

type EmailRecord = { status: string; subject: string; body: string; toEmail: string; ccEmail: string | null }

/**
 * 고아 세션 복구:
 * - 케이스 A: upload_request 이미 sent → 이벤트 연결만. staff 실패면 재발송 시도(non-fatal)
 * - 케이스 B: upload_request failed → 클라이언트 재발송(critical) + 담당자 재발송(non-fatal) → 이벤트 연결
 * - 케이스 C: outbound_email 기록 없음 → 409 + sessionId
 */
async function recoverOrphanedSession({
  tenantId,
  eventId,
  orphanedSessionId,
}: {
  tenantId: string
  eventId: string
  orphanedSessionId: string
}): Promise<NextResponse> {
  const emailCols = {
    status: outboundEmail.status,
    subject: outboundEmail.subject,
    body: outboundEmail.body,
    toEmail: outboundEmail.toEmail,
    ccEmail: outboundEmail.ccEmail,
  }

  const [clientEmailRows, staffEmailRows] = await Promise.all([
    db.select(emailCols).from(outboundEmail)
      .where(and(eq(outboundEmail.uploadSessionId, orphanedSessionId), eq(outboundEmail.type, 'upload_request'), eq(outboundEmail.tenantId, tenantId)))
      .limit(1),
    db.select(emailCols).from(outboundEmail)
      .where(and(eq(outboundEmail.uploadSessionId, orphanedSessionId), eq(outboundEmail.type, 'staff_notification'), eq(outboundEmail.tenantId, tenantId)))
      .limit(1),
  ])

  const ts = toDBString(now())
  const clientRecord = clientEmailRows[0]
  const staffRecord = staffEmailRows[0]

  const connectEvent = () =>
    db.update(clientRequestEvent)
      .set({ uploadSessionId: orphanedSessionId, status: 'sent', updatedAt: ts })
      .where(and(eq(clientRequestEvent.id, eventId), eq(clientRequestEvent.tenantId, tenantId)))

  const markSent = (type: 'upload_request' | 'staff_notification') =>
    db.update(outboundEmail)
      .set({ status: 'sent', sentAt: ts })
      .where(and(eq(outboundEmail.uploadSessionId, orphanedSessionId), eq(outboundEmail.type, type), eq(outboundEmail.tenantId, tenantId)))

  const sendEmail = async (record: EmailRecord) => {
    const emailEnv = requireEmailEnv()
    const resend = new Resend(emailEnv.RESEND_API_KEY)
    const emailFrom = await getTenantEmailFrom(tenantId, emailEnv.EMAIL_FROM)
    const cc = ccEmailsForSend(record.ccEmail)
    await resend.emails.send({ from: emailFrom, to: record.toEmail, ...(cc ? { cc } : {}), subject: record.subject, html: record.body })
  }

  // 담당자 확인 메일 재발송 시도 (non-fatal: 실패해도 복구 계속)
  const tryRecoverStaffEmail = async () => {
    if (staffRecord?.status === 'failed') {
      try {
        await sendEmail(staffRecord)
        await markSent('staff_notification')
      } catch (err) {
        console.error('[recoverOrphanedSession] 담당자 확인 메일 재발송 실패 (non-fatal)', err)
      }
    }
  }

  // 케이스 A: 클라이언트 이메일은 이미 발송됨 → 이벤트 연결 + 담당자 메일 복구
  if (clientRecord?.status === 'sent') {
    await tryRecoverStaffEmail()
    await connectEvent()
    return NextResponse.json({ sessionId: orphanedSessionId }, { status: 200 })
  }

  // 케이스 B: 클라이언트 이메일 실패 → 재발송 후 이벤트 연결
  if (clientRecord) {
    try {
      await sendEmail(clientRecord)
      await markSent('upload_request')
      await tryRecoverStaffEmail()
      await connectEvent()
      return NextResponse.json({ sessionId: orphanedSessionId }, { status: 200 })
    } catch (err) {
      console.error('[recoverOrphanedSession] 클라이언트 이메일 재발송 실패', err)
      return NextResponse.json({ error: '이메일 재발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
    }
  }

  // 케이스 C: outbound_email 기록 없음 → 자동 복구 불가, 수동 확인 필요
  // 발생 원인: requireEmailEnv/Resend 초기화 실패처럼 Resend 호출 도달 전 예외.
  //           세션은 생성됐지만 outbound_email INSERT까지 도달 못한 상태.
  //           재시도해도 동일한 409가 반환되므로 "잠시 후 다시 시도"로 해결되지 않음.
  return NextResponse.json(
    { error: '이전 발송 시도 기록이 없습니다. 세션 상세를 확인하거나 운영자에게 문의하세요.', sessionId: orphanedSessionId },
    { status: 409 },
  )
}
