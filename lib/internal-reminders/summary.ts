import { and, asc, desc, eq } from 'drizzle-orm'
import type { DateTime } from 'luxon'
import { loadBookkeepingReviewSummary } from '@/lib/bookkeeping-review/summary'
import { buildCompanyHomePeriod, type CompanyHomePeriod } from '@/lib/company-home/summary'
import {
  client,
  internalReminderRule,
  internalReminderSendLog,
  payrollPeriodSummary,
  staff,
  tenant,
} from '@/lib/db/schema'
import { loadFilingSupportSummary } from '@/lib/filing-support/summary'
import { loadPayrollWorkspaceSummary } from '@/lib/payroll-workspace/summary'
import { loadSourceCollectionSummary } from '@/lib/source-collection/summary'
import { now } from '@/lib/time'
import { loadVatSummary } from '@/lib/vat/summary'

export type InternalReminderDomain =
  | 'source_collection'
  | 'bookkeeping_review'
  | 'vat'
  | 'payroll'
  | 'filing_support'
export type InternalReminderTriggerType = 'deadline_offset' | 'daily_digest' | 'manual'
export type InternalReminderRecipientSource = 'staff' | 'employee_directory' | 'mixed'
export type InternalReminderSendStatus = 'queued' | 'sent' | 'failed' | 'skipped'
export type InternalReminderTone = 'ok' | 'warn' | 'danger' | 'muted' | 'info'

export type InternalReminderStats = {
  enabledRuleCount: number
  pendingAttentionCount: number
  failedSendCount: number
}

export type InternalReminderRuleRow = {
  id: string
  domain: InternalReminderDomain
  domainLabel: string
  iconLabel: string
  iconClassName: string
  triggerType: InternalReminderTriggerType
  triggerLabel: string
  offsetDays: number | null
  enabled: boolean
  recipientSource: InternalReminderRecipientSource
  subjectTemplate: string
  bodyTemplate: string
  recipientLabel: string
  subjectPreview: string
  bodyPreview: string
  lastSentAt: string | null
  nextRunAt: string | null
  attentionCount: number
  attentionLabel: string
}

export type InternalReminderRecipient = {
  id: string
  name: string
  email: string
  roleLabel: string
  included: boolean
  chipLabel: '본인' | 'staff' | '제외'
}

export type InternalReminderLogRow = {
  id: string
  ruleId: string | null
  domain: InternalReminderDomain
  domainLabel: string
  recipientLabel: string
  status: InternalReminderSendStatus
  statusLabel: string
  tone: InternalReminderTone
  sentAt: string | null
  errorMessage: string | null
  contextLabel: string
}

export type InternalReminderAttention = {
  domain: InternalReminderDomain
  count: number
  label: string
}

export type InternalReminderProviderState = {
  configured: boolean
  label: 'ready' | 'missing'
  message: string
}

export type InternalReminderSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: CompanyHomePeriod
  stats: InternalReminderStats
  provider: InternalReminderProviderState
  rules: InternalReminderRuleRow[]
  recipients: InternalReminderRecipient[]
  recentLogs: InternalReminderLogRow[]
  attentionItems: InternalReminderAttention[]
}

type LoadInternalReminderSummaryParams = {
  tenantId: string
  userId: string
  periodKey?: string | null
  today?: DateTime
}

type StoredRule = {
  id: string
  domain: InternalReminderDomain
  triggerType: InternalReminderTriggerType
  offsetDays: number | null
  enabled: boolean
  recipientSource: InternalReminderRecipientSource
  subjectTemplate: string
  bodyTemplate: string
}

type DefaultRuleDefinition = {
  domain: InternalReminderDomain
  triggerType: InternalReminderTriggerType
  offsetDays: number | null
  enabled: boolean
  subjectTemplate: string
  bodyTemplate: string
}

type StaffRecipientInput = {
  id: string
  userId: string
  email: string
  name: string
  role: string
  active: boolean
}

const DEFAULT_TZ = 'Asia/Seoul'

export const INTERNAL_REMINDER_DOMAINS: Record<InternalReminderDomain, {
  label: string
  iconLabel: string
  iconClassName: string
}> = {
  source_collection: { label: '자료수집', iconLabel: '↥', iconClassName: 'bg-[#eff6ff] text-[#2563eb]' },
  bookkeeping_review: { label: '기장검토', iconLabel: '▤', iconClassName: 'bg-[#f5f3ff] text-[#7c3aed]' },
  vat: { label: '부가세', iconLabel: '％', iconClassName: 'bg-[#ecfeff] text-[#0891b2]' },
  payroll: { label: '급여', iconLabel: '₩', iconClassName: 'bg-[#f0fdf4] text-[#16a34a]' },
  filing_support: { label: '신고지원', iconLabel: '↧', iconClassName: 'bg-[#fff7ed] text-[#ea580c]' },
}

const DEFAULT_RULE_DEFINITIONS: DefaultRuleDefinition[] = [
  {
    domain: 'vat',
    triggerType: 'deadline_offset',
    offsetDays: 3,
    enabled: true,
    subjectTemplate: '부가세 {{periodLabel}} 마감 D-{{dDay}} · 공제 검토 {{attentionCount}}건 남음',
    bodyTemplate: '부가세 신고 마감 전에 공제 검토와 패키지 생성을 확인해 주세요.',
  },
  {
    domain: 'payroll',
    triggerType: 'daily_digest',
    offsetDays: null,
    enabled: true,
    subjectTemplate: '{{payrollLabel}} 급여 확인 필요 {{attentionCount}}건 · 마감 전 처리',
    bodyTemplate: '급여대장의 확인 필요 직원과 4대보험 고지액 매칭 상태를 확인해 주세요.',
  },
  {
    domain: 'source_collection',
    triggerType: 'daily_digest',
    offsetDays: null,
    enabled: true,
    subjectTemplate: '신고 기간 미수집 자료 {{attentionCount}}건 확인',
    bodyTemplate: '자료수집 화면에서 미수집 자료와 정규화 확인 필요 항목을 처리해 주세요.',
  },
  {
    domain: 'filing_support',
    triggerType: 'manual',
    offsetDays: null,
    enabled: false,
    subjectTemplate: '제출 접수증 보관·사후 체크리스트 확인',
    bodyTemplate: '신고지원 화면에서 접수증 보관과 사후 체크리스트를 확인해 주세요.',
  },
]

export function internalReminderRuleId(params: {
  tenantId: string
  clientId: string
  domain: InternalReminderDomain
  triggerType: InternalReminderTriggerType
  offsetDays: number | null
}) {
  return [
    'internal_reminder_rule',
    safeKeyPart(params.tenantId),
    safeKeyPart(params.clientId),
    params.domain,
    params.triggerType,
    params.offsetDays ?? 'none',
  ].join('__')
}

export function safeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function isInternalReminderProviderConfigured(
  envLike: { RESEND_API_KEY?: string; EMAIL_FROM?: string } = process.env as { RESEND_API_KEY?: string; EMAIL_FROM?: string },
) {
  const apiKey = envLike.RESEND_API_KEY?.trim()
  const from = envLike.EMAIL_FROM?.trim()
  return Boolean(apiKey && from && !apiKey.startsWith('your-') && !from.startsWith('your-'))
}

export function buildInternalReminderProviderState(configured: boolean): InternalReminderProviderState {
  return configured
    ? { configured: true, label: 'ready', message: '메일 발송 설정이 준비되어 있습니다.' }
    : {
        configured: false,
        label: 'missing',
        message: 'RESEND_API_KEY 또는 EMAIL_FROM이 없어 테스트/실제 발송이 잠겨 있습니다.',
      }
}

export function triggerLabel(rule: Pick<InternalReminderRuleRow, 'triggerType' | 'offsetDays'>) {
  if (rule.triggerType === 'deadline_offset') {
    return rule.offsetDays === 3 ? '마감 D-7 / D-3 / D-1' : `마감 D-${rule.offsetDays ?? 0}`
  }
  if (rule.triggerType === 'daily_digest') return '일일 요약 09:00'
  return '수동 발송'
}

export function buildInternalReminderRecipients(
  rows: StaffRecipientInput[],
  currentUserId: string,
): InternalReminderRecipient[] {
  return rows
    .map((row) => {
      const isSelf = row.userId === currentUserId
      const included = row.active && Boolean(row.email.trim())
      return {
        id: row.id,
        name: row.name,
        email: included ? row.email : '알림 수신 꺼짐 · 제외',
        roleLabel: isSelf ? '담당자 본인' : '담당 staff',
        included,
        chipLabel: included ? (isSelf ? '본인' : 'staff') : '제외',
      } satisfies InternalReminderRecipient
    })
    .sort((a, b) => {
      if (a.chipLabel === '본인') return -1
      if (b.chipLabel === '본인') return 1
      if (a.included !== b.included) return a.included ? -1 : 1
      return a.name.localeCompare(b.name, 'ko')
    })
}

export function renderReminderTemplate(
  template: string,
  context: {
    periodLabel: string
    payrollLabel: string
    dDay: number
    attentionCount: number
    domainLabel: string
  },
) {
  return template
    .replaceAll('{{periodLabel}}', context.periodLabel)
    .replaceAll('{{payrollLabel}}', context.payrollLabel)
    .replaceAll('{{dDay}}', String(context.dDay))
    .replaceAll('{{attentionCount}}', String(context.attentionCount))
    .replaceAll('{{domainLabel}}', context.domainLabel)
}

export function buildInternalReminderRules(params: {
  tenantId: string
  clientId: string
  period: CompanyHomePeriod
  payrollLabel: string
  attentions: InternalReminderAttention[]
  storedRules: StoredRule[]
  latestSentAtByRuleId?: Map<string, string>
  now?: DateTime
}): InternalReminderRuleRow[] {
  const latestSentAtByRuleId = params.latestSentAtByRuleId ?? new Map<string, string>()
  const storedById = new Map(params.storedRules.map((rule) => [rule.id, rule]))
  const current = params.now ?? now()

  return DEFAULT_RULE_DEFINITIONS.map((definition) => {
    const defaultId = internalReminderRuleId({
      tenantId: params.tenantId,
      clientId: params.clientId,
      domain: definition.domain,
      triggerType: definition.triggerType,
      offsetDays: definition.offsetDays,
    })
    const stored = storedById.get(defaultId)
    const merged = {
      id: defaultId,
      domain: definition.domain,
      triggerType: definition.triggerType,
      offsetDays: definition.offsetDays,
      enabled: definition.enabled,
      recipientSource: 'staff' as const,
      subjectTemplate: definition.subjectTemplate,
      bodyTemplate: definition.bodyTemplate,
      ...stored,
    }
    const domainMeta = INTERNAL_REMINDER_DOMAINS[merged.domain]
    const attention = params.attentions.find((item) => item.domain === merged.domain)
    const attentionCount = attention?.count ?? 0
    const context = {
      periodLabel: params.period.label,
      payrollLabel: params.payrollLabel,
      dDay: params.period.dDay,
      attentionCount,
      domainLabel: domainMeta.label,
    }
    return {
      ...merged,
      domainLabel: domainMeta.label,
      iconLabel: domainMeta.iconLabel,
      iconClassName: domainMeta.iconClassName,
      triggerLabel: triggerLabel(merged),
      recipientLabel: '담당자 본인',
      subjectPreview: renderReminderTemplate(merged.subjectTemplate, context),
      bodyPreview: renderReminderTemplate(merged.bodyTemplate, context),
      lastSentAt: latestSentAtByRuleId.get(merged.id) ?? null,
      nextRunAt: nextRunAtForRule(merged, params.period, current),
      attentionCount,
      attentionLabel: attention?.label ?? `${domainMeta.label} 확인 필요 없음`,
    }
  })
}

export function nextRunAtForRule(
  rule: Pick<InternalReminderRuleRow, 'triggerType' | 'offsetDays' | 'enabled'>,
  period: Pick<CompanyHomePeriod, 'filingDeadline'>,
  current: DateTime,
) {
  if (!rule.enabled || rule.triggerType === 'manual') return null
  if (rule.triggerType === 'daily_digest') {
    return current.plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toISO()
  }
  const days = rule.offsetDays ?? 0
  return current
    .set({ year: Number(period.filingDeadline.slice(0, 4)), month: Number(period.filingDeadline.slice(5, 7)), day: Number(period.filingDeadline.slice(8, 10)) })
    .minus({ days })
    .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
    .toISO()
}

export function buildLatestSentAtByRuleId(
  logs: Array<{ ruleId: string | null; status: string; sentAt: string | null; queuedAt: string }>,
) {
  const latest = new Map<string, string>()
  for (const log of logs) {
    if (!log.ruleId || log.status !== 'sent') continue
    const at = log.sentAt ?? log.queuedAt
    const current = latest.get(log.ruleId)
    if (!current || at > current) latest.set(log.ruleId, at)
  }
  return latest
}

export function buildInternalReminderStats(params: {
  rules: Array<Pick<InternalReminderRuleRow, 'enabled'>>
  attentions: InternalReminderAttention[]
  logs: Array<Pick<InternalReminderLogRow, 'status'>>
}): InternalReminderStats {
  return {
    enabledRuleCount: params.rules.filter((rule) => rule.enabled).length,
    pendingAttentionCount: params.attentions.filter((item) => item.count > 0).length,
    failedSendCount: params.logs.filter((log) => log.status === 'failed').length,
  }
}

export function mapInternalReminderLog(row: {
  id: string
  ruleId: string | null
  domain: InternalReminderDomain
  recipientLabel: string
  status: InternalReminderSendStatus
  sentAt: string | null
  queuedAt: string
  errorMessage: string | null
  contextKey: string
}): InternalReminderLogRow {
  const domainMeta = INTERNAL_REMINDER_DOMAINS[row.domain]
  return {
    id: row.id,
    ruleId: row.ruleId,
    domain: row.domain,
    domainLabel: domainMeta.label,
    recipientLabel: row.recipientLabel,
    status: row.status,
    statusLabel: sendStatusLabel(row.status),
    tone: sendStatusTone(row.status),
    sentAt: row.sentAt ?? row.queuedAt,
    errorMessage: row.errorMessage,
    contextLabel: contextLabel(row.contextKey),
  }
}

export function sendStatusLabel(status: InternalReminderSendStatus) {
  if (status === 'sent') return '발송됨'
  if (status === 'failed') return '실패'
  if (status === 'skipped') return '스킵'
  return '대기'
}

export function sendStatusTone(status: InternalReminderSendStatus): InternalReminderTone {
  if (status === 'sent') return 'ok'
  if (status === 'failed') return 'danger'
  if (status === 'skipped') return 'muted'
  return 'info'
}

export function contextLabel(contextKey: string) {
  if (contextKey.includes(':test:')) return '테스트 발송'
  if (contextKey.includes(':duplicate')) return '동일 조건 이미 발송'
  if (contextKey.includes(':disabled')) return '수신 제외'
  return '확인 필요 알림'
}

export async function loadInternalReminderSummary({
  tenantId,
  userId,
  periodKey,
  today,
}: LoadInternalReminderSummaryParams): Promise<InternalReminderSummary> {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }
  const period = buildCompanyHomePeriod({ periodKey, today, timezone: tenantRow.timezone })

  const businessEntityRows = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  const businessEntity = businessEntityRows[0] ?? null
  const provider = buildInternalReminderProviderState(isInternalReminderProviderConfigured())
  const base = { tenant: tenantRow, businessEntity, period, provider }

  if (!businessEntity) {
    return {
      ...base,
      stats: { enabledRuleCount: 0, pendingAttentionCount: 0, failedSendCount: 0 },
      rules: [],
      recipients: [],
      recentLogs: [],
      attentionItems: [],
    }
  }

  const [storedRuleRows, sendLogRows, staffRows, attentionItems, payrollLabel] = await Promise.all([
    db
      .select({
        id: internalReminderRule.id,
        domain: internalReminderRule.domain,
        triggerType: internalReminderRule.triggerType,
        offsetDays: internalReminderRule.offsetDays,
        enabled: internalReminderRule.enabled,
        recipientSource: internalReminderRule.recipientSource,
        subjectTemplate: internalReminderRule.subjectTemplate,
        bodyTemplate: internalReminderRule.bodyTemplate,
      })
      .from(internalReminderRule)
      .where(and(
        eq(internalReminderRule.tenantId, tenantId),
        eq(internalReminderRule.clientId, businessEntity.id),
      ))
      .orderBy(asc(internalReminderRule.domain), asc(internalReminderRule.triggerType)),
    db
      .select({
        id: internalReminderSendLog.id,
        ruleId: internalReminderSendLog.ruleId,
        domain: internalReminderSendLog.domain,
        contextKey: internalReminderSendLog.contextKey,
        recipientLabel: internalReminderSendLog.recipientLabel,
        status: internalReminderSendLog.status,
        sentAt: internalReminderSendLog.sentAt,
        queuedAt: internalReminderSendLog.queuedAt,
        errorMessage: internalReminderSendLog.errorMessage,
      })
      .from(internalReminderSendLog)
      .where(and(
        eq(internalReminderSendLog.tenantId, tenantId),
        eq(internalReminderSendLog.clientId, businessEntity.id),
      ))
      .orderBy(desc(internalReminderSendLog.queuedAt), desc(internalReminderSendLog.id))
      .limit(20),
    db
      .select({
        id: staff.id,
        userId: staff.userId,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        active: staff.active,
      })
      .from(staff)
      .where(eq(staff.tenantId, tenantId))
      .orderBy(desc(staff.userId), asc(staff.name)),
    loadInternalReminderAttentionItems({ tenantId, periodKey, today }),
    loadPayrollLabel({ tenantId, clientId: businessEntity.id }),
  ])

  const recentLogs = sendLogRows.map(mapInternalReminderLog)
  const rules = buildInternalReminderRules({
    tenantId,
    clientId: businessEntity.id,
    period,
    payrollLabel,
    attentions: attentionItems,
    storedRules: storedRuleRows,
    latestSentAtByRuleId: buildLatestSentAtByRuleId(sendLogRows),
    now: today,
  })

  return {
    ...base,
    stats: buildInternalReminderStats({ rules, attentions: attentionItems, logs: recentLogs }),
    rules,
    recipients: buildInternalReminderRecipients(staffRows, userId),
    recentLogs,
    attentionItems,
  }
}

async function loadPayrollLabel({
  tenantId,
  clientId,
}: {
  tenantId: string
  clientId: string
}) {
  const { db } = await import('@/lib/db')
  const [row] = await db
    .select({ payrollPeriod: payrollPeriodSummary.payrollPeriod })
    .from(payrollPeriodSummary)
    .where(and(
      eq(payrollPeriodSummary.tenantId, tenantId),
      eq(payrollPeriodSummary.clientId, clientId),
    ))
    .orderBy(desc(payrollPeriodSummary.payrollPeriod), desc(payrollPeriodSummary.createdAt))
    .limit(1)

  if (!row?.payrollPeriod) return '최근 급여'
  const month = Number(row.payrollPeriod.slice(5, 7))
  return `${row.payrollPeriod.slice(0, 4)}년 ${month}월 급여`
}

export async function loadInternalReminderAttentionItems({
  tenantId,
  periodKey,
  today,
}: {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
}): Promise<InternalReminderAttention[]> {
  const [source, bookkeeping, vat, payroll, filing] = await Promise.all([
    loadSourceCollectionSummary({ tenantId, periodKey, today }),
    loadBookkeepingReviewSummary({ tenantId, periodKey, today }),
    loadVatSummary({ tenantId, periodKey, today }),
    loadPayrollWorkspaceSummary({ tenantId, periodKey: null, today }),
    loadFilingSupportSummary({ tenantId, periodKey, today }),
  ])

  return [
    {
      domain: 'source_collection',
      count: source.completeness.missingCount + source.completeness.normalizationPendingCount,
      label: source.completeness.missingCount > 0
        ? `미수집 ${source.completeness.missingCount}건`
        : source.completeness.normalizationPendingCount > 0
          ? `정규화 확인 ${source.completeness.normalizationPendingCount}건`
          : '자료수집 확인 필요 없음',
    },
    {
      domain: 'bookkeeping_review',
      count: bookkeeping.counts.pending + bookkeeping.counts.lowConfidence,
      label: bookkeeping.counts.pending > 0
        ? `미분류 ${bookkeeping.counts.pending}건`
        : bookkeeping.counts.lowConfidence > 0
          ? `낮은 신뢰도 ${bookkeeping.counts.lowConfidence}건`
          : '기장검토 확인 필요 없음',
    },
    {
      domain: 'vat',
      count: vat.taxSummary.pendingDeductionCount,
      label: vat.taxSummary.pendingDeductionCount > 0
        ? `공제 검토 ${vat.taxSummary.pendingDeductionCount}건`
        : '부가세 확인 필요 없음',
    },
    {
      domain: 'payroll',
      count: payroll.summary.issueCount,
      label: payroll.summary.issueCount > 0
        ? `급여 확인 필요 ${payroll.summary.issueCount}건`
        : '급여 확인 필요 없음',
    },
    {
      domain: 'filing_support',
      count: filing.items.filter((item) => item.status === 'locked' || item.status === 'needs_review').length,
      label: filing.items.some((item) => item.status === 'locked' || item.status === 'needs_review')
        ? '신고지원 확인 필요'
        : '신고지원 확인 필요 없음',
    },
  ]
}

export async function loadInternalReminderAttentionCount(tenantId: string, userId = '') {
  const summary = await loadInternalReminderSummary({ tenantId, userId })
  return summary.stats.pendingAttentionCount + summary.stats.failedSendCount
}
