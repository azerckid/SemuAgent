import { createHash, randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientCcGroup, inboundEmail, internalCcGroup, staff, staffMailbox } from '@/lib/db/schema'
import { ccEmailsForSend } from '@/lib/email/cc'
import { formatEmailFrom } from '@/lib/email/from'
import { requireEmailEnv } from '@/lib/env'
import { now, toDBString } from '@/lib/time'
import { sendWorkEmailSchema } from '@/lib/validations/work-email'
import { buildWorkEmailCcSnapshot } from '@/lib/work-email/cc'

function isAuthError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === 'Unauthorized' || err.message.startsWith('No active tenant'))
  )
}

/**
 * 일반업무메일 발송. 기본업무메일(자료 요청/업로드 링크)과는 분리된 경로다.
 * From과 Reply-To를 모두 배정받은 업무 메일주소로 보내 고객 답장이 같은
 * 메일함으로 돌아오게 한다. 발송 성공/실패와 관계없이 inbound_email에
 * direction='outbound'로 저장해 같은 메일함 이력에 남긴다.
 */
export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantSession()

    const [me] = await db
      .select({ id: staff.id, role: staff.role, name: staff.name })
      .from(staff)
      .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .limit(1)
    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = sendWorkEmailSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const [mailbox] = await db
      .select()
      .from(staffMailbox)
      .where(and(eq(staffMailbox.id, data.staffMailboxId), eq(staffMailbox.tenantId, tenantId)))
      .limit(1)
    if (!mailbox || (me.role !== 'TENANT_ADMIN' && mailbox.currentStaffId !== me.id)) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    if (mailbox.state !== 'active') {
      return Response.json({ error: '활성 상태의 메일주소에서만 발송할 수 있습니다' }, { status: 409 })
    }

    if (data.clientLabelId) {
      const [clientRow] = await db
        .select({ id: client.id })
        .from(client)
        .where(and(eq(client.id, data.clientLabelId), eq(client.tenantId, tenantId)))
        .limit(1)
      if (!clientRow) {
        return Response.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 })
      }
    }

    // CC는 클라이언트가 보낸 평문 문자열을 신뢰하지 않고, 그룹 id로 현재 tenant/고객사
    // 소속 참조그룹을 다시 조회해 이메일을 가져온다. 자유 입력 CC는 그대로 병합한다.
    let resolvedClientGroupEmails: string | null = null
    if (data.ccGroupId) {
      if (!data.clientLabelId) {
        return Response.json({ error: '고객사 참조그룹을 사용하려면 고객사 라벨을 선택해야 합니다' }, { status: 400 })
      }
      const [groupRow] = await db
        .select({ emails: clientCcGroup.emails })
        .from(clientCcGroup)
        .where(
          and(
            eq(clientCcGroup.id, data.ccGroupId),
            eq(clientCcGroup.tenantId, tenantId),
            eq(clientCcGroup.clientId, data.clientLabelId),
          ),
        )
        .limit(1)
      if (!groupRow) {
        return Response.json({ error: '참조그룹을 찾을 수 없습니다' }, { status: 404 })
      }
      resolvedClientGroupEmails = groupRow.emails
    }

    let resolvedInternalGroupEmails: string | null = null
    if (data.ccInternalGroupId) {
      const [internalGroupRow] = await db
        .select({ emails: internalCcGroup.emails })
        .from(internalCcGroup)
        .where(and(eq(internalCcGroup.id, data.ccInternalGroupId), eq(internalCcGroup.tenantId, tenantId)))
        .limit(1)
      if (!internalGroupRow) {
        return Response.json({ error: '내부 참조그룹을 찾을 수 없습니다' }, { status: 404 })
      }
      resolvedInternalGroupEmails = internalGroupRow.emails
    }

    let ccEmail: string | null
    try {
      ccEmail = buildWorkEmailCcSnapshot([resolvedClientGroupEmails, resolvedInternalGroupEmails, data.cc])
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : '참조 이메일 형식이 올바르지 않습니다' },
        { status: 400 },
      )
    }
    const ccForSend = ccEmailsForSend(ccEmail)

    let providerMessageId = `failed:${randomUUID()}`
    let processingStatus: 'stored' | 'failed' = 'stored'
    try {
      const emailEnv = requireEmailEnv()
      const resend = new Resend(emailEnv.RESEND_API_KEY)
      const result = await resend.emails.send({
        from: formatEmailFrom(mailbox.address, me.name),
        replyTo: mailbox.address,
        to: data.to,
        ...(ccForSend ? { cc: ccForSend } : {}),
        subject: data.subject,
        text: data.body,
      })
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? 'Resend send failed')
      }
      providerMessageId = result.data.id
    } catch (err) {
      console.error('[POST /api/work-emails/send]', err instanceof Error ? err.message : 'unknown')
      processingStatus = 'failed'
    }

    const ts = toDBString(now())
    const rawPayloadHash = createHash('sha256').update(`${data.subject}\n${data.body}`).digest('hex')
    const id = randomUUID()
    await db.insert(inboundEmail).values({
      id,
      tenantId,
      staffMailboxId: mailbox.id,
      provider: 'resend',
      providerMessageId,
      direction: 'outbound',
      fromEmail: mailbox.address,
      toEmail: data.to,
      ccEmail,
      subject: data.subject,
      textBody: data.body,
      htmlBody: null,
      receivedAt: ts,
      clientLabelId: data.clientLabelId || null,
      processingStatus,
      rawPayloadHash,
      createdAt: ts,
      updatedAt: ts,
    })

    if (processingStatus === 'failed') {
      return Response.json(
        { error: '메일 발송에 실패했습니다. 메일함에 발송 실패로 기록되었습니다.' },
        { status: 502 },
      )
    }
    return Response.json({ ok: true, id }, { status: 201 })
  } catch (err) {
    if (isAuthError(err)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[POST /api/work-emails/send]', err instanceof Error ? err.name : 'UnknownError')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
