import { and, eq, inArray } from 'drizzle-orm'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { outboundEmail } from '@/lib/db/schema'
import { requireEmailEnv } from '@/lib/env'
import { now, toDBString } from '@/lib/time'
import { verifyCronAuth, acquireCronLock, releaseCronLock } from '@/lib/cron'
import { ccEmailsForSend } from '@/lib/email/cc'
import { getTenantEmailFrom } from '@/lib/email/from'
import { markGeneralSessionCompleted } from '@/lib/sessions/complete-session'

export const maxDuration = 60

export async function GET(req: Request): Promise<Response> {
  if (!verifyCronAuth(req)) return new Response('Unauthorized', { status: 401 })

  // 2시간 단위 idempotency key
  const runKey = now().toFormat("yyyy-MM-dd-HH'h'")
  const lockId = await acquireCronLock('retry_failed', runKey)
  if (!lockId) return new Response('Already ran this period', { status: 200 })

  try {
    await runRetryFailed()
    await releaseCronLock(lockId, 'completed')
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('[cron/retry-failed]', err)
    await releaseCronLock(lockId, 'failed')
    return new Response('Error', { status: 500 })
  }
}

async function runRetryFailed() {
  const emailEnv = requireEmailEnv()
  const resend = new Resend(emailEnv.RESEND_API_KEY)

  // 발송 실패 이메일 조회 (draft/rejected 제외 — 의도적 미발송)
  const failedEmails = await db
    .select()
    .from(outboundEmail)
    .where(
      and(
        eq(outboundEmail.status, 'failed'),
        inArray(outboundEmail.type, [
          'upload_request',
          'missing_request',
          'completion_thanks',
          'reminder',
          'staff_notification',
        ]),
      ),
    )
    .limit(50) // 한 번에 최대 50건

  for (const email of failedEmails) {
    let newStatus: 'sent' | 'failed' = 'sent'
    try {
      const cc = ccEmailsForSend(email.ccEmail)
      const emailFrom = await getTenantEmailFrom(email.tenantId, emailEnv.EMAIL_FROM)
      await resend.emails.send({
        from: emailFrom,
        to: email.toEmail,
        ...(cc ? { cc } : {}),
        subject: email.subject,
        html: email.body,
      })
    } catch (err) {
      console.error(`[cron/retry-failed] 재시도 실패 email=${email.id}:`, err)
      newStatus = 'failed'
    }

    await db
      .update(outboundEmail)
      .set({
        status: newStatus,
        sentAt: newStatus === 'sent' ? toDBString(now()) : null,
      })
      .where(eq(outboundEmail.id, email.id))

    if (newStatus === 'sent' && email.type === 'completion_thanks') {
      await markGeneralSessionCompleted({
        sessionId: email.uploadSessionId,
        tenantId: email.tenantId,
      })
    }
  }

  console.info(`[cron/retry-failed] ${failedEmails.length}건 재시도 완료`)
}
