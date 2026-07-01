import { and, eq, inArray, isNull } from 'drizzle-orm'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { uploadSession, client, staff, outboundEmail, tenant } from '@/lib/db/schema'
import { requireEmailEnv } from '@/lib/env'
import { now, toDBString, fromISO } from '@/lib/time'
import { verifyCronAuth, acquireCronLock, releaseCronLock } from '@/lib/cron'
import { buildReminderHtml, formatAccountingPeriod } from '@/lib/email/templates'
import { ccEmailsForSend } from '@/lib/email/cc'
import { getTenantEmailFrom } from '@/lib/email/from'
import { isSessionInReminderWindow } from '@/lib/tenant/reminder-days'
import { resolveStoredUploadUrl } from '@/lib/upload/resolve-upload-url'

export const maxDuration = 60

export async function GET(req: Request): Promise<Response> {
  if (!verifyCronAuth(req)) return new Response('Unauthorized', { status: 401 })

  const today = now()
  const runKey = today.toFormat('yyyy-MM-dd')
  const lockId = await acquireCronLock('reminder', runKey)
  if (!lockId) return new Response('Already ran today', { status: 200 })

  try {
    await runReminder()
    await releaseCronLock(lockId, 'completed')
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('[cron/reminder]', err)
    await releaseCronLock(lockId, 'failed')
    return new Response('Error', { status: 500 })
  }
}

async function runReminder() {
  const emailEnv = requireEmailEnv()
  const resend = new Resend(emailEnv.RESEND_API_KEY)

  // 만료 임박 미완료 세션 조회 (테넌트별 리마인더 일수는 필터 단계에서 사용)
  const sessions = await db
    .select({
      session: {
        id: uploadSession.id,
        tenantId: uploadSession.tenantId,
        accountingPeriod: uploadSession.accountingPeriod,
        expiresAt: uploadSession.expiresAt,
        status: uploadSession.status,
        uploadUrl: uploadSession.uploadUrl,
        requestEmailCc: uploadSession.requestEmailCc,
      },
      clientRecord: client,
      staffRecord: staff,
      tenantReminderDaysBefore: tenant.reminderDaysBefore,
    })
    .from(uploadSession)
    .innerJoin(client, eq(uploadSession.clientId, client.id))
    .innerJoin(staff, eq(uploadSession.createdByStaffId, staff.id))
    .innerJoin(tenant, eq(uploadSession.tenantId, tenant.id))
    .where(
      and(
        // 기장 자료 일반 요청만 대상. 급여정산(payroll) 세션은 전용 리마인더 정책이
        // 생기기 전까지 기장 리마인더에서 제외한다(업무유형 guard).
        eq(uploadSession.requestKind, 'general'),
        inArray(uploadSession.status, ['requested', 'active']),
        isNull(uploadSession.deletedAt),
      ),
    )

  const referenceNow = now()
  const dueSessions = sessions.filter(({ session: s, tenantReminderDaysBefore }) =>
    isSessionInReminderWindow(s.expiresAt, tenantReminderDaysBefore, referenceNow),
  )

  if (dueSessions.length === 0) return

  // 이미 reminder가 발송된 세션 ID 목록
  const sessionIds = dueSessions.map((r) => r.session.id)
  const alreadySent = await db
    .select({ sessionId: outboundEmail.uploadSessionId })
    .from(outboundEmail)
    .where(
      and(
        inArray(outboundEmail.uploadSessionId, sessionIds),
        eq(outboundEmail.type, 'reminder'),
        eq(outboundEmail.status, 'sent'),
      ),
    )

  const alreadySentIds = new Set(alreadySent.map((r) => r.sessionId))

  for (const { session: s, clientRecord, staffRecord } of dueSessions) {
    if (alreadySentIds.has(s.id)) continue

    const uploadUrl = resolveStoredUploadUrl(s.uploadUrl)
    if (!uploadUrl) {
      console.warn(`[cron/reminder] session=${s.id} upload_url 없음 — 리마인더 발송 skip`)
      continue
    }
    const formattedPeriod = formatAccountingPeriod(s.accountingPeriod)
    const expiryDate = fromISO(s.expiresAt).toFormat('yyyy년 M월 d일')
    const subject = `[${staffRecord.name}] ${formattedPeriod} 기장 자료 제출 기한 안내`
    const body = buildReminderHtml({
      clientName: clientRecord.name,
      staffName: staffRecord.name,
      accountingPeriod: formattedPeriod,
      expiryDate,
      uploadUrl,
    })

    let status: 'sent' | 'failed' = 'sent'
    try {
      const cc = ccEmailsForSend(s.requestEmailCc)
      const emailFrom = await getTenantEmailFrom(s.tenantId, emailEnv.EMAIL_FROM)
      await resend.emails.send({
        from: emailFrom,
        to: clientRecord.email,
        ...(cc ? { cc } : {}),
        subject,
        html: body,
      })
    } catch (err) {
      console.error(`[cron/reminder] 발송 실패 session=${s.id}:`, err)
      status = 'failed'
    }

    await db.insert(outboundEmail).values({
      id: crypto.randomUUID(),
      uploadSessionId: s.id,
      tenantId: s.tenantId,
      type: 'reminder',
      status,
      toEmail: clientRecord.email,
      ccEmail: s.requestEmailCc,
      subject,
      body,
      sentAt: status === 'sent' ? toDBString(now()) : null,
      createdAt: toDBString(now()),
    })
  }
}
