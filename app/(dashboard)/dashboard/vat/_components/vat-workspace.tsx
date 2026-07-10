import Link from 'next/link'
import {
  Building2,
  FileText,
  ListChecks,
  Percent,
  ReceiptText,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import {
  applyVatPackageGateToPreview,
  type VatPackageGate,
} from '@/lib/vat/package-gate'
import type {
  VatDeductionDecision,
  VatDeductionKind,
  VatDeductionReviewRow,
  VatPackagePreview,
  VatSalesGroup,
  VatSchedule,
  VatSummary,
  VatTone,
} from '@/lib/vat/summary'
import { cn } from '@/lib/utils'
import { VatDeductionActionButtons, VatPackageActionButton } from './vat-actions'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'

const toneChipClass: Record<VatTone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
  info: 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
}

const salesGroupTagClass: Record<VatSalesGroup['id'], string> = {
  taxable: 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
  zero_rated: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  exempt: 'border-company-border bg-company-nav-hover text-company-fg-muted',
}

const scheduleIcon: Record<VatSchedule['id'], ComponentType<{ className?: string }>> = {
  sales_tax_invoice: FileText,
  purchase_tax_invoice: ReceiptText,
  card_receipt: ListChecks,
  non_deductible_input_tax: Percent,
}

export interface VatWorkspaceProps {
  readonly summary: VatSummary
  readonly packageGate: VatPackageGate
}

export function VatWorkspace({ summary, packageGate }: VatWorkspaceProps) {
  const packagePreview = applyVatPackageGateToPreview(summary.packagePreview, packageGate)

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <VatTopbar summary={summary} />
      <div className="flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        <TaxSummaryHero summary={summary} />
        <SalesGroupsSection groups={summary.salesGroups} />
        <DeductionReviewSection reviews={summary.deductionReviews} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SchedulesSection schedules={summary.schedules} />
          <PackagePreviewCard
            periodKey={summary.period.key}
            packagePreview={packagePreview}
            packageGate={packageGate}
          />
        </div>
        <StateCoverageSection />
        <PreviewNote />
      </div>
    </div>
  )
}

function VatTopbar({ summary }: { readonly summary: VatSummary }) {
  const companyName = summary.businessEntity?.name ?? summary.tenant.name

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
      <div>
        <p className="text-[12.5px] font-medium text-company-fg-subtle">
          <Link href="/dashboard" className="hover:text-company-fg-muted hover:underline">회사 홈</Link>
          <span aria-hidden="true"> › </span>
          <span>부가세</span>
        </p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">부가세</h1>
      </div>
      <span className="text-[13px] font-medium text-company-fg-muted">{companyName}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/vat?period=${summary.period.key}`}
          className="inline-flex items-center gap-2 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground"
        >
          {formatPeriodPillLabel(summary.period.key)}
          <span className="text-[11px] text-company-fg-subtle">▾</span>
        </Link>
        <span className="inline-flex items-center gap-2 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground">
          확정 신고
          <span className="text-[11px] text-company-fg-subtle">▾</span>
        </span>
      </div>
    </div>
  )
}

function TaxSummaryHero({ summary }: { readonly summary: VatSummary }) {
  const { taxSummary } = summary
  const pendingNote = taxSummary.pendingDeductionCount > 0
    ? `불공제 후보 ${taxSummary.pendingDeductionCount}건 검토 시 매입세액이 달라질 수 있습니다.`
    : '공제 검토가 완료되어 현재 세액 기준으로 패키지 생성이 가능합니다.'

  return (
    <section className={cn(panelClass, 'px-6 py-[22px]')}>
      <p className="text-xs font-semibold text-company-fg-muted">
        {summary.period.label} · {taxSummary.isFinal ? '확정 세액' : '예정 세액'}
      </p>
      <div className="mt-3 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <TaxMetricCell label="매출세액" value={taxSummary.outputTaxKrw} />
        <OperatorText>−</OperatorText>
        <TaxMetricCell label="매입세액 (공제)" value={taxSummary.inputTaxDeductibleKrw} />
        <OperatorText>=</OperatorText>
        <TaxMetricCell label="납부(예정) 세액" value={taxSummary.payableTaxKrw} result />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-company-border pt-3.5">
        <p className="flex-1 text-[12.5px] text-company-fg-muted">
          {pendingNote} 검토 확정 전까지 예정치입니다.
        </p>
        <span className="rounded-full border border-[#fecaca] bg-[#fef2f2] px-2.5 py-1 text-xs font-semibold text-[#dc2626]">
          신고 마감 {taxSummary.filingDeadline} · {formatDday(taxSummary.dDay)}
        </span>
      </div>
    </section>
  )
}

interface TaxMetricCellProps {
  readonly label: string
  readonly value: number
  readonly result?: boolean
}

function TaxMetricCell({ label, value, result = false }: TaxMetricCellProps) {
  return (
    <div className={cn(
      'rounded-lg border border-company-border bg-company-surface px-4 py-3 md:border-0 md:px-0 md:py-1',
      result && 'text-right',
    )}>
      <p className="text-xs font-semibold text-company-fg-muted">{label}</p>
      <p className={cn(
        'mt-1 text-[24px] font-bold tracking-[-0.02em] tabular-nums',
        result ? 'text-[#2563eb]' : 'text-foreground',
      )}>
        {formatCurrency(value)}
        <span className="ml-1 text-[13px] font-semibold text-company-fg-subtle">원</span>
      </p>
    </div>
  )
}

function OperatorText({ children }: { readonly children: ReactNode }) {
  return (
    <div className="hidden place-items-center text-[20px] font-normal text-company-fg-subtle md:grid">
      {children}
    </div>
  )
}

function SalesGroupsSection({ groups }: { readonly groups: VatSalesGroup[] }) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        title="매출 구분"
        description="과세 · 영세율 · 면세 그룹별 매출과 세액"
      />
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((group) => (
          <div key={group.id} className={cn(panelClass, 'p-[18px]')}>
            <div className="mb-3 flex items-center gap-2">
              <span className={cn('rounded-md border px-2 py-0.5 text-[11.5px] font-bold', salesGroupTagClass[group.id])}>
                {salesGroupShortLabel(group.id)}
              </span>
              <span className="text-[12.5px] font-semibold text-company-fg-muted">{group.title}</span>
            </div>
            <SalesAmountRow label="공급가액" value={formatCurrency(group.supplyAmountKrw)} />
            <SalesAmountRow
              label="매출세액"
              value={group.outputTaxKrw == null ? '해당 없음' : formatCurrency(group.outputTaxKrw)}
              strong
            />
          </div>
        ))}
      </div>
    </section>
  )
}

interface SalesAmountRowProps {
  readonly label: string
  readonly value: string
  readonly strong?: boolean
}

function SalesAmountRow({ label, value, strong = false }: SalesAmountRowProps) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-xs text-company-fg-muted">{label}</span>
      <span className={cn(
        'font-semibold tabular-nums text-foreground',
        strong ? 'text-[18px] font-bold' : 'text-sm',
      )}>
        {value}
      </span>
    </div>
  )
}

function DeductionReviewSection({ reviews }: { readonly reviews: VatDeductionReviewRow[] }) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        title="매입세액 공제 검토"
        description={reviews.length > 0 ? `검토 대상 ${reviews.length}건` : '검토할 매입세액 후보가 없습니다'}
        action={<Link href="/dashboard/bookkeeping" className="text-[12.5px] font-semibold text-[#2563eb]">전체 매입 보기 →</Link>}
      />
      <div className={panelClass}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b border-company-border bg-[#fafafa]">
                <TableHead>매입 내용 / 상대처</TableHead>
                <TableHead className="text-right">공급가액</TableHead>
                <TableHead className="text-right">세액</TableHead>
                <TableHead>공제 판정</TableHead>
                <TableHead>사유</TableHead>
                <TableHead>처리</TableHead>
              </tr>
            </thead>
            <tbody>
              {reviews.length > 0 ? reviews.map((review) => (
                <tr key={review.id} className="border-b border-company-border last:border-b-0 hover:bg-[#fafafa]">
                  <TableCell>
                    <p className="font-semibold text-foreground">{review.description}</p>
                    <p className="mt-0.5 text-[11.5px] text-company-fg-subtle">{review.counterparty ?? '상대처 미확인'}</p>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(review.supplyAmountKrw)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(review.inputTaxKrw)}</TableCell>
                  <TableCell>
                    <ToneChip tone={deductionToneForDisplay(review.kind, review.decision)}>
                      {deductionStatusLabel(review.kind, review.decision)}
                    </ToneChip>
                  </TableCell>
                  <TableCell className="max-w-[240px] text-[12.5px] text-company-fg-muted">
                    {review.reason || '일반 매입세액'}
                  </TableCell>
                  <TableCell>
                    <VatDeductionActionButtons review={review} />
                  </TableCell>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-company-fg-muted">
                    집계할 매입세액 검토 항목이 없습니다. 기장검토에서 확정 전표를 먼저 생성해 주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function SchedulesSection({ schedules }: { readonly schedules: VatSchedule[] }) {
  return (
    <section className={cn(panelClass, 'p-[18px]')}>
      <h2 className="text-[13px] font-semibold text-foreground">부속 명세</h2>
      <p className="mt-1 text-xs text-company-fg-subtle">신고서에 첨부되는 명세 서식</p>
      <div className="mt-3 grid">
        {schedules.map((schedule) => {
          const Icon = scheduleIcon[schedule.id]
          return (
            <div key={schedule.id} className="flex items-center gap-2.5 border-b border-company-border py-2.5 last:border-b-0">
              <div className="grid size-[26px] place-items-center rounded-[7px] bg-company-nav-hover text-company-fg-muted">
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">{schedule.title}</p>
                <p className="truncate text-[11.5px] text-company-fg-subtle">{schedule.description}</p>
              </div>
              <ToneChip tone={schedule.tone}>{schedule.statusLabel}</ToneChip>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PackagePreviewCard({
  periodKey,
  packagePreview,
  packageGate,
}: {
  readonly periodKey: string
  readonly packagePreview: VatPackagePreview
  readonly packageGate: VatPackageGate
}) {
  return (
    <section className={cn(panelClass, 'p-[18px]')}>
      <h2 className="text-[13px] font-semibold text-foreground">신고 패키지 미리보기</h2>
      <p className="mt-1 text-xs text-company-fg-subtle">홈택스 업로드용 파일 준비 + 첨부 서류 묶음</p>
      <div className="mt-3 flex items-center gap-2.5 rounded-[9px] border border-company-border px-3 py-2.5">
        <div className="grid size-7 place-items-center rounded-[7px] bg-[#fef2f2] text-[11px] font-bold text-[#dc2626]">
          PDF
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-foreground">{packagePreview.fileName}</p>
          <p className="truncate text-[11px] text-company-fg-subtle">{packagePreview.description}</p>
        </div>
      </div>
      {packageGate.reasons.length > 0 ? (
        <div id="vat-package-locknote" className="mt-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-xs text-[#92400e]">
          <p className="font-semibold">{packagePreview.lockReason}</p>
          <ul className="mt-2 grid gap-1.5">
            {packageGate.reasons.map((reason) => (
              <li key={reason.code} className="flex items-start justify-between gap-3">
                <span>{reason.message}</span>
                <Link
                  href={reason.targetRoute}
                  className="shrink-0 font-semibold text-[#b45309] underline underline-offset-2"
                >
                  확인
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : packagePreview.lockReason ? (
        <p id="vat-package-locknote" className="mt-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#d97706]">
          {packagePreview.lockReason}
        </p>
      ) : null}
      <VatPackageActionButton periodKey={periodKey} packagePreview={packagePreview} />
    </section>
  )
}

function StateCoverageSection() {
  return (
    <section className="grid gap-3">
      <SectionHeader title="화면 상태 예시" description="로딩 / 빈 상태 / 오류" />
      <div className="grid gap-4 md:grid-cols-3">
        <StateCard label="Loading">
          <SkeletonLine className="w-20" />
          <SkeletonLine className="mt-2 w-full" />
          <SkeletonLine className="mt-2 w-2/3" />
        </StateCard>
        <StateCard label="Empty">
          <div className="grid flex-1 place-items-center text-center text-company-fg-subtle">
            <div>
              <Percent className="mx-auto size-5 opacity-60" />
              <p className="mt-1.5 text-[12.5px]">집계할 매출·매입 자료가 없습니다</p>
              <Link href="/dashboard/bookkeeping" className="mt-2 inline-block text-xs font-semibold text-[#2563eb]">
                기장검토 먼저 확정하기
              </Link>
            </div>
          </div>
        </StateCard>
        <StateCard label="Error">
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[13px] font-semibold text-[#dc2626]">세액 집계를 불러오지 못했습니다</p>
            <p className="mt-1 text-xs text-company-fg-muted">일시적 오류입니다. 잠시 후 다시 시도해 주세요.</p>
            <Link href="/dashboard/vat" className="mt-2 w-fit rounded-lg border border-company-border-strong px-2.5 py-1 text-xs font-semibold">
              다시 시도
            </Link>
          </div>
        </StateCard>
      </div>
    </section>
  )
}

function PreviewNote() {
  return (
    <p className="rounded-[10px] border border-company-border bg-[#fafafa] px-3.5 py-3 text-xs text-company-fg-subtle">
      <b className="text-company-fg-muted">책임 경계</b> — 세무 에이전트는 부가세 세액 집계, 공제 검토, 신고 패키지 초안과 신고 준비값 확인까지만 지원합니다.
      자동 홈택스 제출, 자동 납부, 외부 세무사 대행 흐름은 v1 범위 밖입니다.
    </p>
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

function SkeletonLine({ className = '' }: { readonly className?: string }) {
  return <div className={cn('h-3 rounded-full bg-muted', className)} />
}

interface SectionHeaderProps {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
}

function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-2.5">
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-xs text-company-fg-subtle">{description}</p>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

function ToneChip({ tone, children }: { readonly tone: VatTone; readonly children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11.5px] font-semibold', toneChipClass[tone])}>
      {children}
    </span>
  )
}

function TableHead({ className, children }: { readonly className?: string; readonly children: ReactNode }) {
  return (
    <th className={cn('px-4 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-company-fg-subtle uppercase', className)}>
      {children}
    </th>
  )
}

function TableCell({ className, children }: { readonly className?: string; readonly children: ReactNode }) {
  return <td className={cn('px-4 py-3 text-[13px]', className)}>{children}</td>
}

function formatCurrency(value: number) {
  return value.toLocaleString('ko-KR')
}

function formatDday(value: number) {
  if (value === 0) return 'D-Day'
  if (value > 0) return `D-${value}`
  return `D+${Math.abs(value)}`
}

function formatPeriodPillLabel(periodKey: string) {
  const year = periodKey.slice(0, 4)
  if (periodKey.endsWith('H2')) return `${year}년 부가세 2기 (7~12월)`
  if (periodKey.endsWith('H1')) return `${year}년 부가세 1기 (1~6월)`
  return periodKey
}

function salesGroupShortLabel(id: VatSalesGroup['id']) {
  if (id === 'taxable') return '과세'
  if (id === 'zero_rated') return '영세율'
  return '면세'
}

function deductionStatusLabel(kind: VatDeductionKind, decision: VatDeductionDecision) {
  if (decision === 'deductible') return '공제 확정'
  if (decision === 'non_deductible') return '불공제 확정'
  if (decision === 'prorated') return '안분 확정'
  if (kind === 'non_deductible_candidate') return '불공제 후보'
  if (kind === 'proration_required') return '안분 필요'
  return '공제 검토'
}

function deductionToneForDisplay(kind: VatDeductionKind, decision: VatDeductionDecision): VatTone {
  if (decision === 'deductible') return 'ok'
  if (decision === 'non_deductible') return 'danger'
  if (decision === 'prorated') return 'warn'
  if (kind === 'non_deductible_candidate') return 'danger'
  if (kind === 'proration_required') return 'warn'
  return 'info'
}

export function VatBusinessEntityEmptyState({ tenantName }: { readonly tenantName: string }) {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 bg-company-bg p-6">
      <div className="rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card">
        <div className="flex size-10 items-center justify-center rounded-full bg-company-nav-hover text-company-fg-muted">
          <Building2 className="size-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">사업장을 먼저 등록해 주세요</h1>
        <p className="mt-2 text-sm text-company-fg-muted">
          {tenantName}의 부가세 세액을 집계하려면 회사 내부 사업장 정보가 필요합니다.
        </p>
        <Link href="/dashboard/settings" className={cn(buttonVariants({ variant: 'outline' }), 'mt-5')}>
          설정으로 이동
        </Link>
      </div>
    </div>
  )
}
