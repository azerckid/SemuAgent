import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { outboundEmail, staff, uploadSession } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { requireEmailEnv } from '@/lib/env'
import { ccEmailsForSend } from '@/lib/email/cc'
import { getTenantEmailFrom } from '@/lib/email/from'
import { now, toDBString } from '@/lib/time'

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    subject: z.string().min(1).max(200),
    body: z.string().min(1),
  }),
  z.object({
    action: z.literal('reject'),
  }),
])

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { id } = await params

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // 이메일 존재 + 테넌트 격리 확인
    const emailRows = await db
      .select({
        id: outboundEmail.id,
        toEmail: outboundEmail.toEmail,
        ccEmail: outboundEmail.ccEmail,
      })
      .from(outboundEmail)
      .innerJoin(uploadSession, eq(outboundEmail.uploadSessionId, uploadSession.id))
      .where(
        and(
          eq(outboundEmail.id, id),
          eq(outboundEmail.tenantId, tenantId),
          eq(outboundEmail.type, 'missing_request'),
          eq(outboundEmail.status, 'draft'),
          eq(uploadSession.tenantId, tenantId),
          eq(uploadSession.status, 'needs_resubmission'),
        ),
      )
      .limit(1)

    const email = emailRows[0]
    if (!email) {
      return NextResponse.json({ error: '발송 가능한 보충 요청 초안을 찾을 수 없습니다' }, { status: 404 })
    }

    if (parsed.data.action === 'reject') {
      await db
        .update(outboundEmail)
        .set({ status: 'rejected' })
        .where(and(eq(outboundEmail.id, id), eq(outboundEmail.tenantId, tenantId)))

      return NextResponse.json({ ok: true })
    }

    // approve: 담당자 조회 → Resend 발송 → status 업데이트
    const staffRows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
      .limit(1)

    const staffRecord = staffRows[0]
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    const { subject, body: emailBody } = parsed.data
    const emailEnv = requireEmailEnv()
    const resend = new Resend(emailEnv.RESEND_API_KEY)
    const emailFrom = await getTenantEmailFrom(tenantId, emailEnv.EMAIL_FROM)
    const cc = ccEmailsForSend(email.ccEmail)
    const sentAt = toDBString(now())

    let sendStatus: 'sent' | 'failed' = 'sent'
    try {
      await resend.emails.send({
        from: emailFrom,
        to: email.toEmail,
        ...(cc ? { cc } : {}),
        subject,
        html: emailBody,
      })
    } catch (err) {
      console.error('[PATCH /api/emails/[id]] Resend 발송 실패:', err)
      sendStatus = 'failed'
    }

    await db
      .update(outboundEmail)
      .set({
        subject,
        body: emailBody,
        status: sendStatus,
        approvedByStaffId: staffRecord.id,
        sentAt: sendStatus === 'sent' ? sentAt : null,
      })
      .where(and(eq(outboundEmail.id, id), eq(outboundEmail.tenantId, tenantId)))

    if (sendStatus === 'failed') {
      return NextResponse.json({ error: '메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/emails/[id]]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
