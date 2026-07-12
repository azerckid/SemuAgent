import Link from 'next/link'
import {
  Building2,
  CircleHelp,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import {
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import type {
  VatDeductionReviewRow,
  VatSalesGroup,
  VatSummary,
  VatTone,
} from '@/lib/vat/summary'
import { cn } from '@/lib/utils'
import {
  VatDeductionActionButtons,
} from './vat-actions'
import { VatTaxTreatmentActions } from './vat-tax-treatment-actions'
import {
  VatTaxTreatmentAiWorkflowProvider,
  VatTaxTreatmentAiWorkflowStatus,
} from './vat-tax-treatment-ai-workflow'
import { VatTaxTreatmentEvidenceAction } from './vat-tax-treatment-evidence-action'
import {
  buildVatExceptionWorkbenchModel,
  resolveVatDeductionReviewWorkbenchDecision,
  resolveVatTreatmentWorkbenchDecision,
  type VatTreatmentExceptionRow,
  type VatWorkbenchDecision,
} from './vat-exception-workbench'

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

export interface VatWorkspaceProps {
  readonly summary: VatSummary
  readonly reclassificationSavings?: ReactNode
  readonly initialProviderCallCount?: number
}

export function VatWorkspace({
  summary,
  reclassificationSavings,
  initialProviderCallCount,
}: VatWorkspaceProps) {
  const workbench = buildVatExceptionWorkbenchModel({
    treatmentRows: summary.taxTreatmentRows,
    deductionReviews: summary.deductionReviews,
  })

  return (
    <div
      className="flex min-h-full flex-col bg-company-bg"
      data-vat-initial-provider-calls={initialProviderCallCount}
    >
      <VatTopbar summary={summary} />
      <div className="flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        <TaxSummaryHero summary={summary} exceptionCount={workbench.exceptionCount} />
        {reclassificationSavings}
        <SalesGroupsSection groups={summary.salesGroups} />
        <VatExceptionWorkbench periodKey={summary.period.key} workbench={workbench} />
      </div>
    </div>
  )
}

function VatExceptionWorkbench({
  periodKey,
  workbench,
}: {
  readonly periodKey: string
  readonly workbench: ReturnType<typeof buildVatExceptionWorkbenchModel>
}) {
  const workflowStates = workbench.treatmentRows.flatMap(({ row }) => (
    row.aiWorkflow ? [row.aiWorkflow] : []
  ))
  return (
    <section className="grid gap-3">
      <SectionHeader
        title="확인 필요 거래"
        description="영세율·면세·불공제·안분·누락·취소·중복·불일치만 표시합니다"
        action={<Link href="/dashboard/bookkeeping" className="text-[12.5px] font-semibold text-[#2563eb]">전체 거래 보기 →</Link>}
      />
      <VatTaxTreatmentAiWorkflowProvider
        key={workflowStates.map((state) => `${state.rowId}:${state.status}:${state.completedAt ?? ''}`).join('|')}
        periodKey={periodKey}
        initialStates={workflowStates}
      >
        {workbench.exceptionCount > 0 ? (
          <div className={panelClass}>
            <div className="border-b border-company-border bg-[#fafafa] px-4 py-2.5 text-xs text-company-fg-muted">
              홈택스 <b className="text-foreground">자동채움 예상</b>과 확정 자료를 비교해 사용자가 처리할 예외만 모았습니다.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b border-company-border bg-[#fafafa]">
                    <TableHead>거래 / 상대처</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead>공제 판단</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {workbench.treatmentRows.map((item) => (
                    <VatTreatmentExceptionTableRow key={item.row.rowId} item={item} />
                  ))}
                  {workbench.standaloneDeductionReviews.map((review) => (
                    <VatDeductionExceptionTableRow key={review.id} review={review} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-5 py-5">
            <p className="text-sm font-semibold text-[#166534]">확인할 예외 거래가 없습니다</p>
            <p className="mt-1 text-xs text-[#15803d]">현재 확정 자료에서 추가로 확인할 거래가 없습니다.</p>
          </div>
        )}
      </VatTaxTreatmentAiWorkflowProvider>
    </section>
  )
}

function VatTreatmentExceptionTableRow({ item }: { readonly item: VatTreatmentExceptionRow }) {
  const { row, deductionReview } = item
  const decision = resolveVatTreatmentWorkbenchDecision(row)
  return (
    <tr className="border-b border-company-border last:border-b-0 hover:bg-[#fafafa]">
      <TableCell className="min-w-[220px]">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{row.description}</p>
          <ToneChip tone="muted">{row.direction === 'sale' ? '매출' : '매입'}</ToneChip>
        </div>
        <p className="mt-0.5 text-[11.5px] text-company-fg-subtle">{row.counterparty} · {row.transactionDate}</p>
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.currentVatFact.grossAmountKrw)}</TableCell>
      <TableCell className="min-w-[300px] max-w-[390px]">
        <details className="text-xs text-company-fg-muted">
          <summary className="w-fit cursor-pointer list-none">
            <ToneChip tone={vatWorkbenchDecisionTone(decision)}>{vatWorkbenchDecisionLabel(decision)}</ToneChip>
          </summary>
          <div className="mt-2 grid gap-1.5 border-l-2 border-company-border pl-3">
            <p><b className="text-foreground">출처:</b> {row.finalDecision ? '사용자 확정' : taxTreatmentSourceLabel(row.source)}</p>
            <VatTaxTreatmentAiWorkflowStatus rowId={row.rowId} recommendationFingerprint={row.recommendationFingerprint} />
            <p><b className="text-foreground">판단 근거:</b> {row.basisLabel}</p>
            {row.ruleReference ? <p><b className="text-foreground">규칙:</b> {row.ruleReference}</p> : null}
            <p><b className="text-foreground">홈택스:</b> {taxTreatmentHometaxActionLabel(row.hometaxAction)}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {row.requiredEvidence.map((evidence) => (
                <VatTaxTreatmentEvidenceAction key={evidence.code} row={row} evidence={evidence} />
              ))}
            </div>
            <p className="pt-1"><b className="text-foreground">할 일:</b> {taxTreatmentHometaxActionLabel(row.hometaxAction)}</p>
            <VatTaxTreatmentActions row={row} />
            {deductionReview ? (
              <div className="mt-2 border-t border-company-border pt-2">
                <p className="mb-1 text-[11px] font-semibold text-company-fg-muted">매입세액 공제 처리</p>
                <VatDeductionActionButtons review={deductionReview} />
              </div>
            ) : null}
          </div>
        </details>
      </TableCell>
    </tr>
  )
}

function VatDeductionExceptionTableRow({ review }: { readonly review: VatDeductionReviewRow }) {
  const decision = resolveVatDeductionReviewWorkbenchDecision(review)
  return (
    <tr className="border-b border-company-border last:border-b-0 hover:bg-[#fafafa]">
      <TableCell className="min-w-[220px]">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{review.description}</p>
          <ToneChip tone="muted">매입</ToneChip>
        </div>
        <p className="mt-0.5 text-[11.5px] text-company-fg-subtle">{review.counterparty ?? '상대처 미확인'}</p>
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(review.supplyAmountKrw + review.inputTaxKrw)}</TableCell>
      <TableCell className="min-w-[300px] max-w-[390px]">
        <details className="text-xs text-company-fg-muted">
          <summary className="w-fit cursor-pointer list-none">
            <ToneChip tone={vatWorkbenchDecisionTone(decision)}>{vatWorkbenchDecisionLabel(decision)}</ToneChip>
          </summary>
          <div className="mt-2 grid gap-1 border-l-2 border-company-border pl-3">
            <p>{review.reason || '공제 여부를 확인해야 하는 매입입니다.'}</p>
            <p>공급가액 {formatCurrency(review.supplyAmountKrw)}원 · 세액 {formatCurrency(review.inputTaxKrw)}원</p>
            <p className="pt-1"><b className="text-foreground">할 일:</b> 공제 여부 확인</p>
            <VatDeductionActionButtons review={review} />
          </div>
        </details>
      </TableCell>
    </tr>
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
      </div>
    </div>
  )
}

function TaxSummaryHero({
  summary,
  exceptionCount,
}: {
  readonly summary: VatSummary
  readonly exceptionCount: number
}) {
  const { taxSummary } = summary
  const pendingNote = exceptionCount > 0
    ? `공제 판단이 필요한 거래 ${exceptionCount}건이 남았습니다.`
    : '확인할 예외 거래가 없습니다.'

  return (
    <section className={cn(panelClass, 'px-6 py-[22px]')}>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold text-company-fg-muted">
          {summary.period.label} · {taxSummary.isFinal ? '확정 세액' : '예정 세액'}
        </p>
        <div className="group relative">
          <button type="button" className="grid size-5 place-items-center rounded-full text-company-fg-subtle hover:bg-company-nav-hover" aria-label="부가세 화면 책임 범위">
            <CircleHelp className="size-3.5" />
          </button>
          <div role="tooltip" className="pointer-events-none absolute top-6 left-0 z-20 hidden w-72 rounded-lg border border-company-border bg-company-surface p-3 text-xs font-normal leading-5 text-company-fg-muted shadow-lg group-hover:block group-focus-within:block">
            세무 에이전트는 확정 자료의 세액 집계와 확인 항목 정리를 지원합니다. 홈택스 제출·납부는 사용자가 직접 진행합니다.
          </div>
        </div>
      </div>
      <div className="mt-3 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <TaxMetricCell label="매출세액" value={taxSummary.outputTaxKrw} />
        <OperatorText>−</OperatorText>
        <TaxMetricCell label="매입세액 (공제)" value={taxSummary.inputTaxDeductibleKrw} />
        <OperatorText>=</OperatorText>
        <TaxMetricCell label="납부(예정) 세액" value={taxSummary.payableTaxKrw} result />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-company-border pt-3.5">
        <p className="flex-1 text-[12.5px] text-company-fg-muted">
          {pendingNote} {taxSummary.isFinal ? '' : '사용자 확정 전까지 예정치입니다.'}
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

function vatWorkbenchDecisionLabel(value: VatWorkbenchDecision) {
  if (value === 'deductible') return '공제 가능'
  if (value === 'non_deductible') return '공제 불가'
  if (value === 'sales_tax_type') return '과세유형 확인'
  return '자료 부족'
}

function vatWorkbenchDecisionTone(value: VatWorkbenchDecision): VatTone {
  if (value === 'deductible') return 'ok'
  if (value === 'non_deductible') return 'danger'
  return 'warn'
}

function taxTreatmentSourceLabel(value: VatTaxTreatmentDisplayRow['source']) {
  if (value === 'deterministic_rule') return '공식 규칙'
  if (value === 'prior_confirmed_pattern') return '이전 확정 패턴'
  if (value === 'ai_consensus') return 'AI 합의'
  return 'AI 보강'
}

function taxTreatmentHometaxActionLabel(value: VatTaxTreatmentDisplayRow['hometaxAction']) {
  if (value === 'expected_no_change') return '그대로 확인'
  if (value === 'review_deduction') return '공제·불공제 확인'
  if (value === 'review_sales_tax_type') return '과세유형 확인'
  if (value === 'add_or_correct_amount') return '금액 추가·수정 확인'
  if (value === 'review_proration') return '안분 확인'
  return '화면에서 비교'
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
