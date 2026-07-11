import Link from 'next/link'
import {
  ArrowDownToLine,
  CheckCircle2,
  ClipboardList,
  FileText,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import type {
  FilingChecklistRow,
  FilingPreparationValues,
  FilingReceiptRow,
  FilingSupportItem,
  FilingSupportSummary,
  FilingTone,
} from '@/lib/filing-support/summary'
import { cn } from '@/lib/utils'
import {
  FilingChecklistToggle,
  FilingReceiptDeleteButton,
  FilingReceiptUploadButton,
} from './filing-actions'
import { WithholdingEfilingPanel } from './withholding-efiling-panel'
import type { WithholdingEfilingSummary } from '@/lib/efiling-withholding/summary'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'

const toneChipClass: Record<FilingTone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
  info: 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
}

const filingIcon: Record<FilingSupportItem['type'], { label: string; className: string; icon: ComponentType<{ className?: string }> }> = {
  vat: { label: '부', className: 'bg-[#eff6ff] text-[#2563eb]', icon: FileText },
  withholding: { label: '원', className: 'bg-[#f5f3ff] text-[#7c3aed]', icon: ReceiptText },
  social_insurance: { label: '4', className: 'bg-[#f0fdf4] text-[#16a34a]', icon: ShieldCheck },
}

export interface FilingSupportWorkspaceProps {
  readonly summary: FilingSupportSummary
  readonly withholdingEfiling?: WithholdingEfilingSummary | null
}

export function FilingSupportWorkspace({ summary, withholdingEfiling }: FilingSupportWorkspaceProps) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <FilingTopbar summary={summary} />
      <div className="flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        <ResponsibilityBanner summary={summary} />
        {summary.hasSourceArtifacts ? (
          <>
            <FilingItemsSection items={summary.items} />
            {withholdingEfiling ? <WithholdingEfilingPanel efiling={withholdingEfiling} /> : null}
            <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <PreparationValuesCard guide={summary.guide} periodKey={summary.period.payrollPeriodKey} />
              <ReceiptsCard periodKey={summary.period.filingPeriodKey} receipts={summary.receipts} />
            </div>
            <ChecklistSection periodKey={summary.period.filingPeriodKey} checklist={summary.checklist} />
          </>
        ) : (
          <FilingSupportEmptyState />
        )}
        <StateCoverageSection />
        <PreviewNote />
      </div>
    </div>
  )
}

function FilingTopbar({ summary }: FilingSupportWorkspaceProps) {
  const companyName = summary.businessEntity?.name ?? summary.tenant.name

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
      <div>
        <p className="text-[12.5px] font-medium text-company-fg-subtle">
          <Link href="/dashboard" className="hover:text-company-fg-muted hover:underline">회사 홈</Link>
          <span aria-hidden="true"> › </span>
          <Link href="/dashboard/payroll" className="hover:text-company-fg-muted hover:underline">급여·지급</Link>
          <span aria-hidden="true"> › </span>
          <span>원천세</span>
        </p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">원천세</h1>
      </div>
      <span className="text-[13px] font-medium text-company-fg-muted">{companyName}</span>
      <div className="ml-auto">
        <Link
          href={`/dashboard/filing-support?period=${summary.period.filingPeriodKey}`}
          className="inline-flex items-center gap-2 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground"
        >
          {summary.period.filingLabel} / {summary.period.payrollLabel}
          <span className="text-[11px] text-company-fg-subtle">▾</span>
        </Link>
      </div>
    </div>
  )
}

function ResponsibilityBanner({ summary }: FilingSupportWorkspaceProps) {
  return (
    <section className="flex items-center gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3.5">
      <div className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-[#dbeafe] text-[#2563eb]">
        <ArrowDownToLine className="size-4" />
      </div>
      <p className="text-[12.5px] text-[#1e40af]">
        <strong className="font-bold">{summary.responsibility.title}</strong>
        {' '}
        {summary.responsibility.description}
      </p>
    </section>
  )
}

function FilingItemsSection({ items }: { readonly items: FilingSupportItem[] }) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        title="신고 항목 · 첨부 패키지"
        description="앞 단계에서 생성된 신고 자료"
      />
      <div className="grid gap-3">
        {items.map((item) => (
          <FilingItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

function FilingItemCard({ item }: { readonly item: FilingSupportItem }) {
  const icon = filingIcon[item.type]
  const Icon = icon.icon
  const locked = item.status === 'locked' || item.packageStatus === 'locked'

  return (
    <article className={cn(panelClass, 'grid items-center gap-3 px-[18px] py-4 md:grid-cols-[auto_1fr_auto]')}>
      <div className={cn('grid size-[38px] place-items-center rounded-[9px] text-[15px] font-bold', icon.className)}>
        <Icon className="size-4" aria-hidden="true" />
        <span className="sr-only">{icon.label}</span>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
        <p className="mt-0.5 text-xs text-company-fg-muted">{item.description}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-company-fg-subtle">
          {item.meta.map((meta) => <span key={meta}>{meta}</span>)}
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 md:items-end">
        <ToneChip tone={item.tone}>{item.statusLabel}</ToneChip>
        <div className="flex flex-wrap gap-1.5">
          {locked ? (
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={item.lockReason ?? undefined}
              className="cursor-not-allowed rounded-lg border border-company-border bg-[#f1f1f2] px-3 py-1.5 text-[12px] font-semibold text-company-fg-subtle"
            >
              {item.primaryActionLabel}
            </button>
          ) : (
            <Link
              href={item.secondaryHref}
              className="rounded-lg border border-[#18181b] bg-[#18181b] px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              {item.primaryActionLabel}
            </Link>
          )}
          <Link
            href={item.secondaryHref}
            className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-company-nav-hover"
          >
            {item.secondaryActionLabel}
          </Link>
        </div>
        {item.lockReason ? (
          <p className="max-w-[260px] text-right text-[11.5px] text-company-fg-subtle">{item.lockReason}</p>
        ) : null}
      </div>
    </article>
  )
}

function PreparationValuesCard({ guide, periodKey }: { readonly guide: FilingPreparationValues; readonly periodKey: string }) {
  return (
    <section className={cn(panelClass, 'p-[18px]')}>
      <h2 className="text-[13px] font-semibold text-foreground">{guide.title}</h2>
      <p className="mt-1 text-xs text-company-fg-subtle">{guide.description}</p>
      <div className="mt-3 grid">
        {guide.steps.map((step) => (
          <PreparationStep key={step.number} step={step} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/payroll?period=${periodKey}`}
          className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-2 text-center text-[12px] font-semibold text-foreground hover:bg-company-nav-hover"
        >
          {guide.downloadActionLabel ?? '급여 산출물 확인'}
        </Link>
      </div>
    </section>
  )
}

function PreparationStep({ step }: { readonly step: FilingPreparationValues['steps'][number] }) {
  return (
    <div className="flex gap-3 border-b border-company-border py-2.5 last:border-b-0">
      <div className={cn(
        'grid size-[22px] shrink-0 place-items-center rounded-full text-[11.5px] font-bold',
        step.done ? 'bg-[#16a34a] text-white' : 'bg-[#f1f1f2] text-company-fg-muted',
      )}>
        {step.number}
      </div>
      <div>
        <p className="text-[12.5px] font-semibold text-foreground">{step.title}</p>
        <p className="mt-0.5 text-[11.5px] text-company-fg-subtle">{step.description}</p>
        {step.values.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
            {step.values.map((value) => (
              <span key={value.label} className="text-company-fg-muted">
                {value.label}
                {' '}
                <strong className="font-semibold text-[#2563eb]">{value.value}</strong>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ReceiptsCard({
  periodKey,
  receipts,
}: {
  readonly periodKey: string
  readonly receipts: FilingReceiptRow[]
}) {
  return (
    <section className={cn(panelClass, 'p-[18px]')}>
      <h2 className="text-[13px] font-semibold text-foreground">제출 접수증 보관</h2>
      <p className="mt-1 text-xs text-company-fg-subtle">홈택스에서 받은 접수증을 업로드해 보관합니다</p>
      <div className="mt-3 grid gap-2.5">
        {receipts.map((receipt) => (
          <ReceiptRow key={receipt.id} periodKey={periodKey} receipt={receipt} />
        ))}
      </div>
    </section>
  )
}

function ReceiptRow({
  periodKey,
  receipt,
}: {
  readonly periodKey: string
  readonly receipt: FilingReceiptRow
}) {
  if (receipt.status === 'missing') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[9px] border border-dashed border-company-border px-3 py-3 text-[12.5px] text-company-fg-subtle">
        <span>{receipt.title} — {receipt.description}</span>
        <FilingReceiptUploadButton
          filingPeriodKey={periodKey}
          itemType={receipt.itemType}
          receiptType={receipt.receiptType}
          compact
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-[9px] border border-company-border px-3 py-2.5">
      <div className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-[#f0fdf4] text-[10px] font-bold text-[#16a34a]">
        PDF
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-foreground">{receipt.title}</p>
        <p className="text-[11px] text-company-fg-subtle">{receipt.description}</p>
      </div>
      <FilingReceiptDeleteButton receiptId={receipt.id} />
    </div>
  )
}

function ChecklistSection({
  periodKey,
  checklist,
}: {
  readonly periodKey: string
  readonly checklist: FilingChecklistRow[]
}) {
  return (
    <section className="grid gap-3">
      <SectionHeader title="사후 체크리스트" description="제출 후 확인 항목" />
      <div className={cn(panelClass, 'p-[18px]')}>
        <div className="grid">
          {checklist.map((item) => (
            <div key={item.id} className="flex gap-2.5 border-b border-company-border py-2.5 last:border-b-0">
              <FilingChecklistToggle
                itemId={item.id}
                filingPeriodKey={periodKey}
                code={item.code}
                completed={item.completed}
              />
              <div>
                <p className={cn(
                  'text-[12.5px] font-semibold',
                  item.completed ? 'text-company-fg-muted line-through' : 'text-foreground',
                )}>
                  {item.label}
                </p>
                <p className="mt-0.5 text-[11.5px] text-company-fg-subtle">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StateCoverageSection() {
  return (
    <section className="grid gap-3">
      <SectionHeader title="화면 상태 예시" description="로딩 / 빈 상태 / 오류" />
      <div className="grid gap-4 lg:grid-cols-3">
        <StateCard label="Loading">
          <div className="h-3 w-2/5 rounded-full bg-company-border" />
          <div className="mt-2 h-3 w-4/5 rounded-full bg-company-border" />
          <div className="mt-2 h-3 w-3/5 rounded-full bg-company-border" />
        </StateCard>
        <StateCard label="Empty">
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <ArrowDownToLine className="mx-auto size-5 text-company-fg-subtle" />
              <p className="mt-1.5 text-[12.5px] text-company-fg-subtle">아직 신고할 항목이 없습니다</p>
              <p className="mt-2 text-xs font-semibold text-[#2563eb]">부가세·급여 먼저 확정하기</p>
            </div>
          </div>
        </StateCard>
        <StateCard label="Error">
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[13px] font-semibold text-[#dc2626]">신고 항목을 불러오지 못했습니다</p>
            <p className="mt-1 text-xs text-company-fg-muted">일시적 오류입니다. 잠시 후 다시 시도해 주세요.</p>
            <button
              type="button"
              className="mt-2 w-fit rounded-lg border border-company-border-strong px-2.5 py-1 text-xs font-semibold text-foreground"
            >
              다시 시도
            </button>
          </div>
        </StateCard>
      </div>
    </section>
  )
}

function StateCard({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-h-[132px] flex-col rounded-xl border border-dashed border-company-border-strong bg-company-surface p-[18px]">
      <p className="mb-3 text-[11px] font-bold tracking-[0.04em] text-company-fg-subtle uppercase">{label}</p>
      {children}
    </div>
  )
}

function PreviewNote() {
  return (
    <div className="rounded-[10px] border border-company-border bg-[#fafafa] px-3.5 py-3 text-xs text-company-fg-subtle">
      <strong className="font-semibold text-company-fg-muted">책임 경계</strong>
      {' '}
      신고서 자동 제출·세금 자동 납부는 제공하지 않습니다. 첨부 패키지 생성 · 신고 준비값 확인 · 제출 접수증 보관 · 사후 체크리스트까지 지원하며, 업로드·제출/납부는 회사가 홈택스에서 직접 수행합니다.
    </div>
  )
}

function FilingSupportEmptyState() {
  return (
    <section className={cn(panelClass, 'grid min-h-[240px] place-items-center p-8 text-center')}>
      <div>
        <ClipboardList className="mx-auto size-8 text-company-fg-subtle" />
        <h2 className="mt-3 text-base font-semibold text-foreground">아직 신고할 항목이 없습니다</h2>
        <p className="mt-1 text-[12.5px] text-company-fg-muted">부가세·급여를 먼저 확정하면 신고 항목과 준비값 확인 영역이 채워집니다.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/dashboard/vat" className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[12px] font-semibold text-foreground">부가세 열기</Link>
          <Link href="/dashboard/payroll" className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[12px] font-semibold text-foreground">급여 열기</Link>
        </div>
      </div>
    </section>
  )
}

export function FilingSupportBusinessEntityEmptyState({ tenantName }: { readonly tenantName: string }) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 급여·지급 › 원천세</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">원천세</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[720px] rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card">
          <BuildingIcon />
          <h2 className="mt-3 text-lg font-semibold text-foreground">사업장을 먼저 등록해 주세요</h2>
          <p className="mt-1 text-sm text-company-fg-muted">
            {tenantName}에 연결된 사업장이 있어야 신고 항목을 구성할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function BuildingIcon() {
  return (
    <div className="grid size-10 place-items-center rounded-xl bg-company-nav-hover text-company-fg-muted">
      <CheckCircle2 className="size-5" />
    </div>
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
    <div className="flex flex-wrap items-baseline gap-2.5">
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-xs text-company-fg-subtle">{description}</p>
    </div>
  )
}

function ToneChip({ tone, children }: { readonly tone: FilingTone; readonly children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-semibold', toneChipClass[tone])}>
      {children}
    </span>
  )
}
