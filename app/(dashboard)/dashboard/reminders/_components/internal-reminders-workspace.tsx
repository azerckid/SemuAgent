import Link from 'next/link'
import type { ReactNode } from 'react'
import type {
  InternalReminderRecipient,
  InternalReminderRuleRow,
  InternalReminderSummary,
  InternalReminderTone,
} from '@/lib/internal-reminders/summary'
import { cn } from '@/lib/utils'
import { ReminderRuleToggle, ReminderSendNowButton, ReminderTestSendButton } from './reminder-actions'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'

const statusChipClass: Record<InternalReminderTone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
  info: 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
}

export interface InternalRemindersWorkspaceProps {
  readonly summary: InternalReminderSummary
}

export function InternalRemindersWorkspace({ summary }: InternalRemindersWorkspaceProps) {
  const companyName = summary.businessEntity?.name ?? summary.tenant.name
  const sendDisabled = !summary.provider.configured || summary.rules.every((rule) => !rule.enabled)

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <InternalReminderTopbar companyName={companyName} sendDisabled={sendDisabled} />
      <div className="flex w-full max-w-[1240px] flex-col gap-5 px-7 pt-6 pb-12">
        <InternalOnlyBanner />
        <ReminderStats summary={summary} />

        <SectionHeader title="리마인드 규칙" description="업무 영역별 마감·확인 필요 알림" />
        <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
          <ReminderRuleList summary={summary} />
          <RecipientPreview recipients={summary.recipients} />
        </div>

        <SectionHeader title="최근 발송 로그" description="성공 / 실패 / 스킵 · 중복 발송 방지" />
        <SendLogTable summary={summary} />
      </div>
    </div>
  )
}

function InternalReminderTopbar({
  companyName,
  sendDisabled,
}: {
  readonly companyName: string
  readonly sendDisabled: boolean
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
      <div>
        <p className="text-[12.5px] font-medium text-company-fg-subtle">
          <Link href="/dashboard" className="hover:text-company-fg-muted hover:underline">회사 홈</Link>
          <span aria-hidden="true"> › </span>
          <span>리마인드</span>
        </p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">리마인드</h1>
      </div>
      <span className="text-[13px] font-medium text-company-fg-muted">{companyName}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ReminderSendNowButton disabled={sendDisabled} />
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="기본 규칙으로 시작합니다. 커스텀 규칙 편집은 후속 단계입니다."
          className="rounded-lg border border-[#18181b] bg-[#18181b] px-3 py-2 text-[12.5px] font-semibold text-white disabled:cursor-not-allowed"
        >
          리마인드 규칙 추가
        </button>
      </div>
    </div>
  )
}

function InternalOnlyBanner() {
  return (
    <section className="flex items-start gap-2.5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3">
      <span className="shrink-0 text-sm font-bold text-[#2563eb]" aria-hidden="true">ⓘ</span>
      <div>
        <h2 className="text-[12.5px] font-bold text-[#1e40af]">회사 내부 업무 알림입니다</h2>
        <p className="mt-0.5 text-[12px] leading-5 text-[#1d4ed8]">
          회사 담당자에게 마감·확인 필요 상태를 알려줍니다. 외부 요청 메일·자동 홈택스 제출·납부 기능은 제공하지 않습니다.
        </p>
      </div>
    </section>
  )
}

function ReminderStats({ summary }: InternalRemindersWorkspaceProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="활성 규칙" value={summary.stats.enabledRuleCount} unit="개" dot="bg-[#16a34a]" />
      <StatCard
        label="리마인드 대상 (확인 필요)"
        value={summary.stats.pendingAttentionCount}
        unit="건"
        dot="bg-[#d97706]"
        attn={summary.stats.pendingAttentionCount > 0}
      />
      <StatCard label="발송 실패" value={summary.stats.failedSendCount} unit="건" dot="bg-[#dc2626]" />
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
  dot,
  attn = false,
}: {
  readonly label: string
  readonly value: number
  readonly unit: string
  readonly dot: string
  readonly attn?: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl border bg-company-surface px-[18px] py-4 shadow-company-card',
      attn ? 'border-[#fde68a] bg-[#fffbeb]' : 'border-company-border',
    )}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-company-fg-muted">
        <span className={cn('inline-block size-[7px] rounded-full', dot)} aria-hidden="true" />
        {label}
      </p>
      <p className={cn(
        'mt-1 text-2xl font-bold tracking-[-0.02em] tabular-nums',
        attn ? 'text-[#d97706]' : 'text-foreground',
      )}>
        {value.toLocaleString('ko-KR')}
        <span className="ml-1 text-[13px] font-semibold text-company-fg-subtle">{unit}</span>
      </p>
    </div>
  )
}

function ReminderRuleList({ summary }: InternalRemindersWorkspaceProps) {
  return (
    <section className={cn(panelClass, 'px-[18px] py-[5px]')}>
      {summary.rules.length > 0 ? summary.rules.map((rule) => (
        <ReminderRuleItem key={rule.id} rule={rule} providerConfigured={summary.provider.configured} />
      )) : (
        <div className="flex min-h-[220px] flex-col items-center justify-center px-4 py-10 text-center">
          <p className="text-[13px] font-semibold text-foreground">리마인드 규칙이 없습니다</p>
          <p className="mt-1 text-[12px] text-company-fg-subtle">기본 리마인드 규칙을 생성하면 업무 영역별 알림을 보낼 수 있습니다.</p>
        </div>
      )}
    </section>
  )
}

function ReminderRuleItem({
  rule,
  providerConfigured,
}: {
  readonly rule: InternalReminderRuleRow
  readonly providerConfigured: boolean
}) {
  const subText = `제목: ${rule.subjectPreview}`

  return (
    <article className="flex items-center gap-3 border-b border-company-border py-[13px] last:border-b-0">
      <div className={cn('grid size-[30px] shrink-0 place-items-center rounded-lg text-[13px] font-bold', rule.iconClassName)}>
        {rule.iconLabel}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[13px] font-semibold text-foreground">{rule.domainLabel} 리마인드</h3>
        <p className="mt-0.5 truncate text-[11.5px] text-company-fg-subtle" title={subText}>{subText}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <RuleTag tone="trigger">{rule.triggerLabel}</RuleTag>
          <RuleTag>{`수신: ${rule.recipientLabel}`}</RuleTag>
          {rule.enabled ? (
            <RuleTag>{rule.lastSentAt ? `마지막 발송 ${formatDateTime(rule.lastSentAt)}` : rule.nextRunAt ? `다음 실행 ${formatDateTime(rule.nextRunAt)}` : '수동 발송 대기'}</RuleTag>
          ) : (
            <RuleTag>비활성</RuleTag>
          )}
          {rule.attentionCount > 0 ? <RuleTag tone="warn">{rule.attentionLabel}</RuleTag> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <ReminderRuleToggle ruleId={rule.id} enabled={rule.enabled} />
        <ReminderTestSendButton ruleId={rule.id} disabled={!providerConfigured} />
      </div>
    </article>
  )
}

function RuleTag({ children, tone = 'muted' }: { readonly children: ReactNode; readonly tone?: 'muted' | 'trigger' | 'warn' }) {
  return (
    <span className={cn(
      'rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold',
      tone === 'trigger'
        ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]'
        : tone === 'warn'
          ? 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]'
          : 'border-company-border bg-company-nav-hover text-company-fg-muted',
    )}>
      {children}
    </span>
  )
}

function RecipientPreview({ recipients }: { readonly recipients: InternalReminderRecipient[] }) {
  return (
    <section className={cn(panelClass, 'p-[18px]')}>
      <h2 className="text-[13px] font-semibold text-foreground">수신자 미리보기</h2>
      <p className="mt-1 mb-3.5 text-xs text-company-fg-subtle">기본 수신자는 등록된 회사 담당자입니다</p>
      {recipients.length > 0 ? recipients.map((recipient) => (
        <RecipientRow key={recipient.id} recipient={recipient} />
      )) : (
        <div className="rounded-lg border border-dashed border-company-border-strong px-4 py-8 text-center text-[12px] text-company-fg-subtle">
          수신 가능한 내부 담당자가 없습니다.
        </div>
      )}
      <div className="mt-3.5 rounded-[10px] border border-company-border bg-[#fafafa] px-3.5 py-3 text-xs leading-5 text-company-fg-subtle">
        현재 리마인드는 회사 담당자에게 발송됩니다. 직원별 알림은 직원 명부 연동이 준비된 뒤 제공됩니다.
      </div>
    </section>
  )
}

function RecipientRow({ recipient }: { readonly recipient: InternalReminderRecipient }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-company-border py-2.5 last:border-b-0">
      <div className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[#e4e4e7] text-[11px] font-semibold text-company-fg-muted">
        {initial(recipient.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-foreground">
          {recipient.name}
          {recipient.chipLabel === 'staff' ? <span className="font-medium text-company-fg-muted"> · 담당 staff</span> : null}
        </p>
        <p className="truncate text-[11px] text-company-fg-subtle">{recipient.email}</p>
      </div>
      <span className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        recipient.chipLabel === '본인'
          ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]'
          : 'border-company-border bg-company-nav-hover text-company-fg-muted',
      )}>
        {recipient.chipLabel}
      </span>
    </div>
  )
}

function SendLogTable({ summary }: InternalRemindersWorkspaceProps) {
  return (
    <section className={panelClass}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-company-border bg-[#fafafa]">
              <TableHead>발송 시각</TableHead>
              <TableHead>영역</TableHead>
              <TableHead>수신자</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>사유</TableHead>
            </tr>
          </thead>
          <tbody>
            {summary.recentLogs.length > 0 ? summary.recentLogs.map((log) => (
              <tr key={log.id} className="border-b border-company-border last:border-b-0 hover:bg-[#fafafa]">
                <TableCell className="whitespace-nowrap font-mono text-[12px] text-company-fg-muted">
                  {formatDateTime(log.sentAt)}
                </TableCell>
                <TableCell>{log.domainLabel}</TableCell>
                <TableCell>{log.recipientLabel}</TableCell>
                <TableCell>
                  <StatusChip tone={log.tone}>{log.statusLabel}</StatusChip>
                </TableCell>
                <TableCell>
                  <span className={cn('text-company-fg-subtle', log.status === 'failed' && 'text-[#dc2626]')}>
                    {log.errorMessage ?? log.contextLabel}
                  </span>
                </TableCell>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-company-fg-muted">
                  아직 발송 로그가 없습니다. 메일 발송 설정 후 테스트 발송으로 로그를 확인할 수 있습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SectionHeader({
  title,
  description,
}: {
  readonly title: string
  readonly description: string
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      <span className="text-xs text-company-fg-subtle">{description}</span>
    </div>
  )
}

function TableHead({ children }: { readonly children: ReactNode }) {
  return (
    <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.02em] text-company-fg-subtle whitespace-nowrap">
      {children}
    </th>
  )
}

function TableCell({
  children,
  className,
}: {
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <td className={cn('px-3.5 py-3 text-[12.5px] align-middle text-foreground', className)}>
      {children}
    </td>
  )
}

function StatusChip({ tone, children }: { readonly tone: InternalReminderTone; readonly children: ReactNode }) {
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold', statusChipClass[tone])}>
      {children}
    </span>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const normalized = value.replace('T', ' ').replace('.000Z', '').replace('Z', '')
  return normalized.slice(0, 16)
}

function initial(name: string) {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1) : '담'
}

export function InternalReminderBusinessEntityEmptyState({ tenantName }: { readonly tenantName: string }) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 리마인드</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">리마인드</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[760px] rounded-xl border border-company-border bg-company-surface p-6 text-center shadow-company-card">
          <p className="text-sm font-semibold text-foreground">사업장이 아직 없습니다</p>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">{tenantName}의 사업장을 먼저 등록하면 내부 리마인드를 설정할 수 있습니다.</p>
        </div>
      </div>
    </div>
  )
}
