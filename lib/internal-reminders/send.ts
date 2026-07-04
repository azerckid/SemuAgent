import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { internalReminderRule, internalReminderSendLog } from '@/lib/db/schema'
import { requireEmailEnv } from '@/lib/env'
import { getTenantEmailFrom } from '@/lib/email/from'
import { now, toDBString } from '@/lib/time'
import { loadPayrollAttentionEmployees } from './payroll-attention-employees'
import {
  buildInternalReminderProviderState,
  isInternalReminderProviderConfigured,
  safeKeyPart,
  type InternalReminderRuleRow,
  type InternalReminderSummary,
} from './summary'

export type InternalReminderSendMode = 'test' | 'manual' | 'cron'

export type InternalReminderSendResult = {
  sent: number
  failed: number
  skipped: number
  providerMissing: boolean
}

type PersistRuleParams = {
  tenantId: string
  clientId: string
  staffId: string | null
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
    '이 메일은 세무 에이전트 내부 업무 리마인드입니다.',
    '고객사 요청 메일, 자동 홈택스 제출, 자동 납부 기능이 아닙니다.',
  ].join('\n')
  const html = text
    .split('\n')
    .map((line) => line ? `<p>${escapeHtml(line)}</p>` : '<br />')
    .join('')

  return { subject, text, html }
}

// JC-018: payroll 확인 필요 직원용 고정 템플릿. 허용 변수는 recipientName과
// [테스트] 접두뿐이다. 급여 금액·세액·issueLabel 등 민감 정보는 절대 보간하지
// 않는다(staff용 composeInternalReminderEmail과 콘텐츠 소스가 완전히 분리됨).
export function composeEmployeePayrollReminderEmail(params: {
  recipientName: string
  mode: InternalReminderSendMode
}) {
  const prefix = params.mode === 'test' ? '[테스트] ' : ''
  const subject = `${prefix}급여 정보 확인 요청`
  const text = [
    `${params.recipientName}님,`,
    '',
    '확인이 필요한 급여·인적사항이 있습니다. 담당자에게 문의하시거나',
    '급여 화면에서 직접 확인해 주세요.',
    '',
    '이 메일은 세무 에이전트 내부 업무 리마인드입니다.',
    '급여 금액이나 세부 내역은 포함하지 않습니다.',
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
        // cron(staffId=null)은 기존 규칙의 편집자 정보를 덮어쓰지 않는다.
        ...(staffId ? { updatedByStaffId: staffId } : {}),
        updatedAt: timestamp,
      },
    })
}

export async function sendInternalReminderRule(params: {
  summary: InternalReminderSummary
  ruleId: string
  staffId: string | null
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
      recipientType: 'staff',
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
        recipientType: 'staff',
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
        recipientType: 'staff',
        contextKey,
        idempotencyKey: `${idempotencyKey}:failed:${randomUUID()}`,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : '메일 발송 실패',
        timestamp: ts,
      })
      failed += 1
    }
  }

  // JC-018: payroll 도메인이면 그 시점 확인 필요 직원에게도 별도(민감정보 미포함)
  // 콘텐츠로 발송한다. staff 루프와 완전히 분리되어 서로 영향을 주지 않는다.
  // test 발송은 staff 자체 검증용이라 직원에게는 보내지 않는다(불필요한 테스트
  // 메일 노출 방지 — Brief 범위를 벗어나지 않는 안전한 기본값).
  if (rule.domain === 'payroll' && params.mode !== 'test') {
    const attentionEmployees = await loadPayrollAttentionEmployees({
      tenantId: params.summary.tenant.id,
      clientId: businessEntity.id,
    })

    for (const employee of attentionEmployees) {
      const employeeRecipientId = `employee:${employee.employeeCode}`
      const employeeIdempotencyKey = buildInternalReminderIdempotencyKey({
        ruleId: rule.id,
        recipientId: employeeRecipientId,
        contextKey,
        mode: params.mode,
        runKey,
      })

      const [existing] = await db
        .select({ id: internalReminderSendLog.id })
        .from(internalReminderSendLog)
        .where(and(
          eq(internalReminderSendLog.tenantId, params.summary.tenant.id),
          eq(internalReminderSendLog.clientId, businessEntity.id),
          eq(internalReminderSendLog.idempotencyKey, employeeIdempotencyKey),
        ))
        .limit(1)
      if (existing) {
        skipped += 1
        continue
      }

      const email = composeEmployeePayrollReminderEmail({
        recipientName: employee.employeeName,
        mode: params.mode,
      })

      try {
        const result = await resend.emails.send({
          from,
          to: employee.workEmail,
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
          recipientId: employeeRecipientId,
          recipientLabel: employee.employeeName,
          recipientType: 'employee',
          contextKey,
          idempotencyKey: employeeIdempotencyKey,
          status: 'sent',
          providerMessageId: result.data.id,
          timestamp: ts,
        })
        sent += 1
      } catch (err) {
        await writeSendLog({
          summary: params.summary,
          rule,
          recipientId: employeeRecipientId,
          recipientLabel: employee.employeeName,
          recipientType: 'employee',
          contextKey,
          idempotencyKey: `${employeeIdempotencyKey}:failed:${randomUUID()}`,
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : '메일 발송 실패',
          timestamp: ts,
        })
        failed += 1
      }
    }
  }

  return { sent, failed, skipped, providerMissing: false } satisfies InternalReminderSendResult
}

async function writeSendLog(params: {
  summary: InternalReminderSummary
  rule: InternalReminderRuleRow
  recipientId: string
  recipientLabel: string
  recipientType: 'staff' | 'employee'
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
    recipientType: params.recipientType,
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
