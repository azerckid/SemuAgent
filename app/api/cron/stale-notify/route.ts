import { and, eq, inArray, isNull } from 'drizzle-orm'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { uploadSession, client, staff, outboundEmail } from '@/lib/db/schema'
import { requireEmailEnv, env } from '@/lib/env'
import { now, toDBString, fromISO } from '@/lib/time'
import { verifyCronAuth, acquireCronLock, releaseCronLock } from '@/lib/cron'
import { buildStaleNotifyHtml, formatAccountingPeriod } from '@/lib/email/templates'
import { getTenantEmailFrom } from '@/lib/email/from'

export const maxDuration = 60

// 7일 이상 활동 없는 세션을 장기 미완료로 판단
const STALE_DAYS = 7

export async function GET(req: Request): Promise<Response> {
  if (!verifyCronAuth(req)) return new Response('Unauthorized', { status: 401 })

  const runKey = now().toFormat('yyyy-MM-dd')
  const lockId = await acquireCronLock('stale_notify', runKey)
  if (!lockId) return new Response('Already ran today', { status: 200 })

  try {
    await runStaleNotify()
    await releaseCronLock(lockId, 'completed')
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('[cron/stale-notify]', err)
    await releaseCronLock(lockId, 'failed')
    return new Response('Error', { status: 500 })
  }
}

async function runStaleNotify() {
  const emailEnv = requireEmailEnv()
  const resend = new Resend(emailEnv.RESEND_API_KEY)
  const staleThreshold = now().minus({ days: STALE_DAYS })

  // 미완료 세션 전체 조회
  const sessions = await db
    .select({
      session: uploadSession,
      clientRecord: client,
      staffRecord: staff,
    })
    .from(uploadSession)
    .innerJoin(client, eq(uploadSession.clientId, client.id))
    .innerJoin(staff, eq(uploadSession.createdByStaffId, staff.id))
    .where(
      and(
        inArray(uploadSession.status, ['requested', 'active']),
        isNull(uploadSession.deletedAt),
      ),
    )

  // 만료 전이고 STALE_DAYS 이상 활동 없는 세션 필터링
  const staleSessions = sessions.filter(({ session: s }) => {
    const lastActivity = s.lastAccessedAt ? fromISO(s.lastAccessedAt) : fromISO(s.createdAt)
    const isExpired = fromISO(s.expiresAt) < now()
    return !isExpired && lastActivity <= staleThreshold
  })

  if (staleSessions.length === 0) return

  // 오늘 이미 staff_notification을 보낸 세션 제외
  const sessionIds = staleSessions.map((r) => r.session.id)
  const todayStart = now().startOf('day')

  // 이미 오늘 보낸 세션 제외 (sentAt 기준)
  const todaySent = await db
    .select({ sessionId: outboundEmail.uploadSessionId, sentAt: outboundEmail.sentAt })
    .from(outboundEmail)
    .where(
      and(
        inArray(outboundEmail.uploadSessionId, sessionIds),
        eq(outboundEmail.type, 'staff_notification'),
        eq(outboundEmail.status, 'sent'),
      ),
    )

  const sentTodayIds = new Set(
    todaySent
      .filter((r) => r.sentAt && fromISO(r.sentAt) >= todayStart)
      .map((r) => r.sessionId as string),
  )

  for (const { session: s, clientRecord, staffRecord } of staleSessions) {
    if (sentTodayIds.has(s.id)) continue

    const lastActivity = s.lastAccessedAt ? fromISO(s.lastAccessedAt) : fromISO(s.createdAt)
    const staleDays = Math.floor(now().diff(lastActivity, 'days').days)

    const formattedPeriod = formatAccountingPeriod(s.accountingPeriod)
    const sessionUrl = `${env.NEXT_PUBLIC_APP_URL}/dashboard/sessions/${s.id}`
    const subject = `[JARYO] ${clientRecord.name} ${formattedPeriod} 자료 미제출 알림`
    const body = buildStaleNotifyHtml({
      staffName: staffRecord.name,
      clientName: clientRecord.name,
      accountingPeriod: formattedPeriod,
      staleDays,
      sessionUrl,
    })

    let status: 'sent' | 'failed' = 'sent'
    try {
      const emailFrom = await getTenantEmailFrom(s.tenantId, emailEnv.EMAIL_FROM)
      await resend.emails.send({
        from: emailFrom,
        to: staffRecord.email,
        subject,
        html: body,
      })
    } catch (err) {
      console.error(`[cron/stale-notify] 발송 실패 session=${s.id}:`, err)
      status = 'failed'
    }

    await db.insert(outboundEmail).values({
      id: crypto.randomUUID(),
      uploadSessionId: s.id,
      tenantId: s.tenantId,
      type: 'staff_notification',
      status,
      toEmail: staffRecord.email,
      subject,
      body,
      sentAt: status === 'sent' ? toDBString(now()) : null,
      createdAt: toDBString(now()),
    })
  }
}
