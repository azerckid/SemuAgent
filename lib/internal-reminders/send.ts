import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { internalReminderRule, internalReminderSendLog } from '@/lib/db/schema'
import { requireEmailEnv } from '@/lib/env'
import { getTenantEmailFrom } from '@/lib/email/from'
import { now, toDBString } from '@/lib/time'
import {
  buildInternalReminderProviderState,
  isInternalReminderProviderConfigured,
  safeKeyPart,
  type InternalReminderRuleRow,
  type InternalReminderSummary,
} from './summary'

export type InternalReminderSendMode = 'test' | 'manual'

export type InternalReminderSendResult = {
  sent: number
  failed: number
  skipped: number
  providerMissing: boolean
}

type PersistRuleParams = {
  tenantId: string
  clientId: string
  staffId: string
  rule: InternalReminderRuleRow
  enabled?: boolean
  timestamp: string
}

export function buildInternalReminderIdempotencyKey(params: {
  ruleId: string
  recipientId: string
  contextKey: string
  mode: InternalReminderSendMode
  runKey: string
}) {
  return [
    'internal-reminder',
    params.mode,
    safeKeyPart(params.ruleId),
    safeKeyPart(params.recipientId),
    safeKeyPart(params.contextKey),
    safeKeyPart(params.runKey),
  ].join(':')
}

export function buildInternalReminderContextKey(params: {
  domain: string
  periodKey: string
  mode: InternalReminderSendMode
}) {
  return `${params.domain}:${params.periodKey}:${params.mode}`
}

export function composeInternalReminderEmail(params: {
  rule: Pick<InternalReminderRuleRow, 'domainLabel' | 'subjectPreview' | 'bodyPreview' | 'attentionLabel'>
  recipientName: string
  companyName: string
  mode: InternalReminderSendMode
}) {
  const prefix = params.mode === 'test' ? '[테스트] ' : ''
  const subject = `${prefix}${params.rule.subjectPreview}`.slice(0, 180)
  const text = [
    `${params.recipientName}님,`,
    '',
    params.rule.bodyPreview,
    '',
    `확인 항목: ${params.rule.attentionLabel}`,
    `업무 영역: ${params.rule.domainLabel}`,
    `회사: ${params.companyName}`,
    '',
    '이 메일은 세무데스크 내부 업무 리마인드입니다.',
    '고객사 요청 메일, 자동 홈택스 제출, 자동 납부 기능이 아닙니다.',
  ].join('\n')
  const html = text
    .split('\n')
    .map((line) => line ? `<p>${escapeHtml(line)}</p>` : '<br />')
    .join('')

  return { subject, text, html }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function persistInternalReminderRule({
  tenantId,
  clientId,
  staffId,
  rule,
  enabled,
  timestamp,
}: PersistRuleParams) {
  await db
    .insert(internalReminderRule)
    .values({
      id: rule.id,
      tenantId,
      clientId,
      domain: rule.domain,
      triggerType: rule.triggerType,
      offsetDays: rule.offsetDays,
      enabled: enabled ?? rule.enabled,
      recipientSource: 'staff',
      subjectTemplate: rule.subjectTemplate,
      bodyTemplate: rule.bodyTemplate,
      createdByStaffId: staffId,
      updatedByStaffId: staffId,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: internalReminderRule.id,
      set: {
        enabled: enabled ?? rule.enabled,
        updatedByStaffId: staffId,
        updatedAt: timestamp,
      },
    })
}

export async function sendInternalReminderRule(params: {
  summary: InternalReminderSummary
  ruleId: string
  staffId: string
  mode: InternalReminderSendMode
  runKey?: string
}) {
  const businessEntity = params.summary.businessEntity
  if (!businessEntity) {
    return { sent: 0, failed: 0, skipped: 0, providerMissing: false } satisfies InternalReminderSendResult
  }

  const rule = params.summary.rules.find((candidate) => candidate.id === params.ruleId)
  if (!rule) throw new Error('리마인드 규칙을 찾을 수 없습니다.')
  if (params.mode !== 'test' && !rule.enabled) {
    return { sent: 0, failed: 0, skipped: 1, providerMissing: false } satisfies InternalReminderSendResult
  }

  const recipients = params.summary.recipients.filter((recipient) => recipient.included)
  if (recipients.length === 0) {
    return { sent: 0, failed: 0, skipped: 0, providerMissing: false } satisfies InternalReminderSendResult
  }

  const ts = toDBString(now(params.summary.tenant.timezone))
  await persistInternalReminderRule({
    tenantId: params.summary.tenant.id,
    clientId: businessEntity.id,
    staffId: params.staffId,
    rule,
    timestamp: ts,
  })

  const provider = buildInternalReminderProviderState(isInternalReminderProviderConfigured())
  if (!provider.configured) {
    await writeSendLog({
      summary: params.summary,
      rule,
      recipientId: recipients[0].id,
      recipientLabel: recipients[0].name,
      contextKey: buildInternalReminderContextKey({
        domain: rule.domain,
        periodKey: params.summary.period.key,
        mode: params.mode,
      }),
      idempotencyKey: `provider-missing:${rule.id}:${ts}`,
      status: 'failed',
      errorMessage: provider.message,
      timestamp: ts,
    })
    return { sent: 0, failed: 1, skipped: 0, providerMissing: true } satisfies InternalReminderSendResult
  }

  const emailEnv = requireEmailEnv()
  const resend = new Resend(emailEnv.RESEND_API_KEY)
  const from = await getTenantEmailFrom(params.summary.tenant.id, emailEnv.EMAIL_FROM)
  const contextKey = buildInternalReminderContextKey({
    domain: rule.domain,
    periodKey: params.summary.period.key,
    mode: params.mode,
  })
  const runKey = params.runKey ?? (params.mode === 'test' ? randomUUID() : now(params.summary.tenant.timezone).toISODate() ?? 'today')

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const recipient of recipients) {
    const idempotencyKey = buildInternalReminderIdempotencyKey({
      ruleId: rule.id,
      recipientId: recipient.id,
      contextKey,
      mode: params.mode,
      runKey,
    })
    if (params.mode !== 'test') {
      const [existing] = await db
        .select({ id: internalReminderSendLog.id })
        .from(internalReminderSendLog)
        .where(and(
          eq(internalReminderSendLog.tenantId, params.summary.tenant.id),
          eq(internalReminderSendLog.clientId, businessEntity.id),
          eq(internalReminderSendLog.idempotencyKey, idempotencyKey),
        ))
        .limit(1)
      if (existing) {
        skipped += 1
        continue
      }
    }

    const email = composeInternalReminderEmail({
      rule,
      recipientName: recipient.name,
      companyName: businessEntity.name,
      mode: params.mode,
    })

    try {
      const result = await resend.emails.send({
        from,
        to: recipient.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? 'Resend send failed')
      }
      await writeSendLog({
        summary: params.summary,
        rule,
        recipientId: recipient.id,
        recipientLabel: recipient.name,
        contextKey,
        idempotencyKey,
        status: 'sent',
        providerMessageId: result.data.id,
        timestamp: ts,
      })
      sent += 1
    } catch (err) {
      await writeSendLog({
        summary: params.summary,
        rule,
        recipientId: recipient.id,
        recipientLabel: recipient.name,
        contextKey,
        idempotencyKey: `${idempotencyKey}:failed:${randomUUID()}`,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : '메일 발송 실패',
        timestamp: ts,
      })
      failed += 1
    }
  }

  return { sent, failed, skipped, providerMissing: false } satisfies InternalReminderSendResult
}

async function writeSendLog(params: {
  summary: InternalReminderSummary
  rule: InternalReminderRuleRow
  recipientId: string
  recipientLabel: string
  contextKey: string
  idempotencyKey: string
  status: 'sent' | 'failed' | 'skipped'
  providerMessageId?: string
  errorMessage?: string
  timestamp: string
}) {
  const businessEntity = params.summary.businessEntity
  if (!businessEntity) return

  await db.insert(internalReminderSendLog).values({
    id: randomUUID(),
    tenantId: params.summary.tenant.id,
    clientId: businessEntity.id,
    ruleId: params.rule.id,
    domain: params.rule.domain,
    contextKey: params.contextKey,
    recipientType: 'staff',
    recipientRefId: params.recipientId,
    recipientLabel: params.recipientLabel,
    idempotencyKey: params.idempotencyKey,
    status: params.status,
    providerMessageId: params.providerMessageId ?? null,
    errorMessage: params.errorMessage ?? null,
    queuedAt: params.timestamp,
    sentAt: params.status === 'sent' ? params.timestamp : null,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  })
}
