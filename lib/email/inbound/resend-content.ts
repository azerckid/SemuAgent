import { createHash } from 'node:crypto'
import { put } from '@vercel/blob'
import { Resend } from 'resend'
import { z } from 'zod'
import { requireBlobEnv, requireEmailEnv } from '@/lib/env'

const MAX_BODY_CHARS = 200_000

const executableExtensionPattern = /\.(app|bat|cmd|com|cpl|dll|dmg|exe|hta|js|jse|msi|msp|scr|sh|vbe|vbs|wsf)$/i
const executableContentTypes = new Set([
  'application/javascript',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-sh',
  'application/x-ms-installer',
])

const InboundAttachmentSchema = z.object({
  id: z.string().min(1),
  filename: z.string().nullable().optional(),
  size: z.number().int().nonnegative(),
  content_type: z.string().min(1),
})

const ReceivingEmailSchema = z.object({
  id: z.string().min(1),
  html: z.string().nullable(),
  text: z.string().nullable(),
  attachments: z.array(InboundAttachmentSchema).default([]),
})

const AttachmentDownloadSchema = z.object({
  id: z.string().min(1),
  filename: z.string().optional(),
  size: z.number().int().nonnegative(),
  content_type: z.string().min(1),
  download_url: z.string().url(),
})

export type ResendWebhookAttachment = {
  id?: string
  filename?: string | null
  size?: number
  content_type?: string
}

export type StoredInboundAttachmentDraft = {
  providerAttachmentId: string | null
  originalFilename: string | null
  contentType: string | null
  fileSize: number | null
  storageKey: string | null
  contentHash: string | null
  status: 'stored' | 'ignored' | 'failed'
}

export type ReceivedEmailContentSnapshot = {
  textBody: string | null
  htmlBody: string | null
  attachments: StoredInboundAttachmentDraft[]
  hasBlockedAttachment: boolean
}

function truncateBody(value: string | null | undefined) {
  if (!value) return null
  return value.slice(0, MAX_BODY_CHARS)
}

export function sanitizeInboundHtml(value: string | null | undefined) {
  if (!value) return null
  return truncateBody(
    value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ''),
  )
}

function isBlockedAttachment(filename: string | null, contentType: string | null) {
  const normalizedType = contentType?.toLowerCase() ?? ''
  return Boolean(
    (filename && executableExtensionPattern.test(filename))
    || executableContentTypes.has(normalizedType),
  )
}

function safePathSegment(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? '')
    .replace(/[\\/\r\n"]/g, '_')
    .replace(/[^\w. -]/g, '_')
    .trim()
    .slice(0, 140)
  return normalized || fallback
}

async function fetchAttachmentBuffer(downloadUrl: string) {
  const response = await fetch(downloadUrl)
  if (!response.ok) {
    throw new Error(`Attachment download failed (${response.status})`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  return {
    buffer,
    hash: createHash('sha256').update(buffer).digest('hex'),
  }
}

async function fetchAndStoreAttachment(params: {
  tenantId: string
  inboundEmailId: string
  emailId: string
  attachmentId: string
}) {
  const resend = new Resend(requireEmailEnv().RESEND_API_KEY)
  const response = await resend.emails.receiving.attachments.get({
    emailId: params.emailId,
    id: params.attachmentId,
  })
  if (response.error || !response.data) {
    throw new Error(response.error?.message ?? 'Resend attachment lookup failed')
  }

  const parsed = AttachmentDownloadSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new Error(`Resend attachment response validation failed: ${parsed.error.message}`)
  }

  const data = parsed.data
  const { buffer, hash } = await fetchAttachmentBuffer(data.download_url)
  requireBlobEnv()
  const filename = safePathSegment(data.filename, `${data.id}.bin`)
  const blob = await put(
    `inbound-emails/${safePathSegment(params.tenantId, 'tenant')}/${params.inboundEmailId}/${safePathSegment(data.id, 'attachment')}-${filename}`,
    buffer,
    {
      access: 'private',
      allowOverwrite: true,
      contentType: data.content_type,
    },
  )

  return {
    contentType: data.content_type,
    fileSize: data.size,
    originalFilename: data.filename ?? null,
    storageKey: blob.url,
    contentHash: hash,
  }
}

function mergeAttachmentMetadata(
  contentAttachments: z.infer<typeof InboundAttachmentSchema>[],
  webhookAttachments: ResendWebhookAttachment[],
) {
  const byId = new Map<string, z.infer<typeof InboundAttachmentSchema>>()
  for (const attachment of contentAttachments) {
    byId.set(attachment.id, attachment)
  }

  for (const attachment of webhookAttachments) {
    if (!attachment.id || byId.has(attachment.id)) continue
    byId.set(attachment.id, {
      id: attachment.id,
      filename: attachment.filename ?? null,
      size: attachment.size ?? 0,
      content_type: attachment.content_type ?? 'application/octet-stream',
    })
  }

  return [...byId.values()]
}

export async function fetchReceivedEmailContentSnapshot(params: {
  tenantId: string
  inboundEmailId: string
  providerMessageId: string
  webhookAttachments: ResendWebhookAttachment[]
}): Promise<ReceivedEmailContentSnapshot> {
  const resend = new Resend(requireEmailEnv().RESEND_API_KEY)
  const response = await resend.emails.receiving.get(params.providerMessageId)
  if (response.error || !response.data) {
    throw new Error(response.error?.message ?? 'Resend received email lookup failed')
  }

  const parsed = ReceivingEmailSchema.safeParse(response.data)
  if (!parsed.success) {
    throw new Error(`Resend received email response validation failed: ${parsed.error.message}`)
  }

  const email = parsed.data
  const attachmentMetadata = mergeAttachmentMetadata(email.attachments, params.webhookAttachments)
  const attachments: StoredInboundAttachmentDraft[] = []
  let hasBlockedAttachment = false

  for (const attachment of attachmentMetadata) {
    const base = {
      providerAttachmentId: attachment.id,
      originalFilename: attachment.filename ?? null,
      contentType: attachment.content_type,
      fileSize: attachment.size,
    }

    if (isBlockedAttachment(base.originalFilename, base.contentType)) {
      hasBlockedAttachment = true
      attachments.push({
        ...base,
        storageKey: null,
        contentHash: null,
        status: 'ignored',
      })
      continue
    }

    try {
      const stored = await fetchAndStoreAttachment({
        tenantId: params.tenantId,
        inboundEmailId: params.inboundEmailId,
        emailId: params.providerMessageId,
        attachmentId: attachment.id,
      })
      attachments.push({
        providerAttachmentId: attachment.id,
        originalFilename: stored.originalFilename ?? base.originalFilename,
        contentType: stored.contentType,
        fileSize: stored.fileSize,
        storageKey: stored.storageKey,
        contentHash: stored.contentHash,
        status: 'stored',
      })
    } catch {
      attachments.push({
        ...base,
        storageKey: null,
        contentHash: null,
        status: 'failed',
      })
    }
  }

  return {
    textBody: truncateBody(email.text),
    htmlBody: sanitizeInboundHtml(email.html),
    attachments,
    hasBlockedAttachment,
  }
}
