import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { DateTime } from 'luxon'
import { and, eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { inboundEmail, inboundEmailAttachment, staffMailbox } from '@/lib/db/schema'
import { requireEmailEnv } from '@/lib/env'
import { fetchReceivedEmailContentSnapshot } from './resend-content'

/** Thrown when Svix signature verification fails → route maps to 401 (fail closed). */
export class ResendInboundVerificationError extends Error {
  constructor(readonly cause?: unknown) {
    super('Resend inbound webhook verification failed')
    this.name = 'ResendInboundVerificationError'
  }
}

// 외부 webhook payload는 Zod로 검증한다 (CLAUDE.md 검증 경계).
const ReceivedAttachment = z
  .object({
    id: z.string().optional(),
    filename: z.string().nullable().optional(),
    size: z.number().optional(),
    content_type: z.string().optional(),
  })
  .passthrough()

const ReceivedEmailData = z
  .object({
    email_id: z.string().min(1),
    created_at: z.string().optional(),
    from: z.string().optional(),
    to: z.array(z.string().min(1)).min(1),
    cc: z.array(z.string()).optional(),
    subject: z.string().optional(),
    attachments: z.array(ReceivedAttachment).default([]),
  })
  .passthrough()

const ReceivedEvent = z.object({
  type: z.literal('email.received'),
  data: ReceivedEmailData,
})

export type HandleResendInboundResult =
  | { status: 'stored' | 'held'; inboundEmailId: string; mailboxId: string }
  | { status: 'duplicate' }
  | { status: 'ignored'; reason: string }

// 메일함 상태별 처리: active=정상 저장, paused/handoff_required=보류 저장, reserved/retired=무시.
function statusForMailboxState(state: string): 'stored' | 'held' | null {
  if (state === 'active') return 'stored'
  if (state === 'paused' || state === 'handoff_required') return 'held'
  return null // reserved | retired → 수신하지 않음
}

/**
 * Slice 2 handler: verify (Svix) → only `email.received` → resolve staff_mailbox
 * by receiving address → idempotent store into inbound_email + attachment
 * metadata. Client linkage is a manual label set later (no auto matching).
 * Attachment binaries are not downloaded here (Slice 5).
 */
export async function handleResendInboundWebhook(params: {
  rawBody: string
  headers: Headers
  webhookSecret: string
}): Promise<HandleResendInboundResult> {
  const resend = new Resend(requireEmailEnv().RESEND_API_KEY)

  let event: unknown
  try {
    event = resend.webhooks.verify({
      payload: params.rawBody,
      headers: {
        id: params.headers.get('svix-id') ?? '',
        timestamp: params.headers.get('svix-timestamp') ?? '',
        signature: params.headers.get('svix-signature') ?? '',
      },
      webhookSecret: params.webhookSecret,
    })
  } catch (err) {
    throw new ResendInboundVerificationError(err)
  }

  const typeParse = z.object({ type: z.string() }).safeParse(event)
  if (!typeParse.success) {
    throw new ResendInboundVerificationError()
  }
  if (typeParse.data.type !== 'email.received') {
    return { status: 'ignored', reason: `event_type:${typeParse.data.type}` }
  }

  const parsed = ReceivedEvent.safeParse(event)
  if (!parsed.success) {
    throw new Error(`Resend inbound payload validation failed: ${parsed.error.message}`)
  }

  const data = parsed.data.data
  const toEmail = data.to[0]

  // 받는 주소 → staff_mailbox 결정론적 귀속 (추측 없음).
  const [mailbox] = await db
    .select()
    .from(staffMailbox)
    .where(eq(staffMailbox.address, toEmail))
    .limit(1)

  if (!mailbox) {
    return { status: 'ignored', reason: 'no_mailbox' }
  }
  const processingStatus = statusForMailboxState(mailbox.state)
  if (!processingStatus) {
    return { status: 'ignored', reason: `mailbox_state:${mailbox.state}` }
  }

  const now = DateTime.utc().toISO() ?? ''
  const rawPayloadHash = createHash('sha256').update(params.rawBody).digest('hex')
  const inboundEmailId = randomUUID()
  const [existing] = await db
    .select({ id: inboundEmail.id })
    .from(inboundEmail)
    .where(and(eq(inboundEmail.provider, 'resend'), eq(inboundEmail.providerMessageId, data.email_id)))
    .limit(1)
  if (existing) {
    return { status: 'duplicate' }
  }
  const contentSnapshot = await fetchReceivedEmailContentSnapshot({
    tenantId: mailbox.tenantId,
    inboundEmailId,
    providerMessageId: data.email_id,
    webhookAttachments: data.attachments,
  })
  const finalProcessingStatus = processingStatus === 'stored' && contentSnapshot.hasBlockedAttachment
    ? 'held'
    : processingStatus

  // 메일 + 첨부 메타데이터를 한 트랜잭션으로 저장한다. 첨부 insert가 실패하면
  // 메일 insert도 롤백되어, 다음 retry가 duplicate로 막히지 않고 다시 저장한다.
  const stored = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(inboundEmail)
      .values({
        id: inboundEmailId,
        tenantId: mailbox.tenantId,
        staffMailboxId: mailbox.id,
        provider: 'resend',
        providerMessageId: data.email_id,
        direction: 'inbound',
        fromEmail: data.from ?? null,
        toEmail,
        ccEmail: data.cc && data.cc.length > 0 ? data.cc.join(', ') : null,
        subject: data.subject ?? null,
        textBody: contentSnapshot.textBody,
        htmlBody: contentSnapshot.htmlBody,
        receivedAt: data.created_at ?? null,
        clientLabelId: null, // 수동 라벨 — 담당직원이 나중에 설정
        processingStatus: finalProcessingStatus,
        rawPayloadHash,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [inboundEmail.provider, inboundEmail.providerMessageId],
      })
      .returning({ id: inboundEmail.id })

    if (inserted.length === 0) return false

    if (contentSnapshot.attachments.length > 0) {
      await tx.insert(inboundEmailAttachment).values(
        contentSnapshot.attachments.map((att) => ({
          id: randomUUID(),
          tenantId: mailbox.tenantId,
          inboundEmailId,
          providerAttachmentId: att.providerAttachmentId,
          originalFilename: att.originalFilename,
          contentType: att.contentType,
          fileSize: att.fileSize,
          storageKey: att.storageKey,
          contentHash: att.contentHash,
          status: att.status,
          createdAt: now,
        })),
      )
    }
    return true
  })

  if (!stored) {
    return { status: 'duplicate' }
  }

  return { status: finalProcessingStatus, inboundEmailId, mailboxId: mailbox.id }
}
