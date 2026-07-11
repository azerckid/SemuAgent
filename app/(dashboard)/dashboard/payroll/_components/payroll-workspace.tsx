import Link from 'next/link'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import type {
  PayrollDeductionBreakdownItem,
  PayrollDocumentPreview,
  PayrollRegisterRow,
  PayrollTone,
  PayrollWorkspaceSummary,
} from '@/lib/payroll-workspace/summary'
import { cn } from '@/lib/utils'
import { EditablePayrollRow } from './editable-payroll-row'
import { PayrollCloseButton } from './payroll-actions'
import { WithholdingBreakdownCell } from './withholding-breakdown-cell'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'

const toneChipClass: Record<PayrollTone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
  info: 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
}

const documentLabel: Record<PayrollDocumentPreview['id'], string> = {
  payslip: 'PDF',
  withholding_statement: 'XLS',
  insurance_statement: 'DOC',
}

export interface PayrollWorkspaceProps {
  readonly summary: PayrollWorkspaceSummary
}

export function PayrollWorkspace({ summary }: PayrollWorkspaceProps) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <PayrollTopbar summary={summary} />
      <div className="flex w-full max-w-[1280px] flex-col gap-5 px-7 pt-6 pb-12">
        <PayrollSummaryHero summary={summary} />
        <IssueAlert summary={summary} />
        <PayrollRegisterSection summary={summary} />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <DeductionBreakdownCard items={summary.deductionBreakdown} />
          <PayrollDocumentsCard summary={summary} />
        </div>
        <SectionHeader title="화면 상태 예시" description="로딩 / 빈 상태 / 오류" />
        <StateCoverageSection />
        <PreviewNote />
      </div>
    </div>
  )
}

function PayrollTopbar({ summary }: PayrollWorkspaceProps) {
  const companyName = summary.businessEntity?.name ?? summary.tenant.name

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
      <div>
        <p className="text-[12.5px] font-medium text-company-fg-subtle">
          <Link href="/dashboard" className="hover:text-company-fg-muted hover:underline">회사 홈</Link>
          <span aria-hidden="true"> › </span>
          <span>급여·지급</span>
        </p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">급여·지급</h1>
      </div>
      <span className="text-[13px] font-medium text-company-fg-muted">{companyName}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/payroll?period=${summary.period.key}`}
          className="inline-flex items-center gap-2 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground"
        >
          {summary.period.label}
          <span className="text-[11px] text-company-fg-subtle">▾</span>
        </Link>
      </div>
    </div>
  )
}

function PayrollSummaryHero({ summary }: PayrollWorkspaceProps) {
  const { summary: totals } = summary
  const statusTone: PayrollTone = totals.issueCount > 0 || totals.closeStatus === 'blocked'
    ? 'warn'
    : totals.closeStatus === 'closed'
      ? 'ok'
      : 'muted'
  const statusLabel = totals.closeStatus === 'closed'
    ? '마감 완료'
    : totals.issueCount > 0 || totals.closeStatus === 'blocked'
      ? `확인 필요 ${totals.issueCount || 1}건 · 미마감`
      : '마감 가능'

  return (
    <section className={cn(panelClass, 'px-6 py-[22px]')}>
      <p className="text-xs font-semibold text-company-fg-muted">
        {summary.period.label} · 대상 직원 {totals.employeeCount.toLocaleString('ko-KR')}명
      </p>
      <div className="mt-3 grid items-center md:grid-cols-[repeat(3,1fr)_auto]">
        <PayrollMetricCell label="지급총액" value={totals.grossPayKrw} />
        <PayrollMetricCell label="공제총액 (원천세·4대보험)" value={totals.deductionTotalKrw} />
        <PayrollMetricCell label="실지급액" value={totals.netPayKrw} result />
        <div className="pt-2 text-left md:pl-6 md:text-right">
          <p className="text-xs font-semibold text-company-fg-muted">마감 상태</p>
          <ToneChip tone={statusTone} className="mt-1.5 text-[12.5px]">
            {statusLabel}
          </ToneChip>
        </div>
      </div>
    </section>
  )
}

interface PayrollMetricCellProps {
  readonly label: string
  readonly value: number
  readonly result?: boolean
}

function PayrollMetricCell({ label, value, result = false }: PayrollMetricCellProps) {
  return (
    <div className={cn(
      'border-company-border px-4 py-3 md:border-r md:px-6 md:py-1',
      'first:pl-0',
      result && 'md:border-r-0',
    )}>
      <p className="text-xs font-semibold text-company-fg-muted">{label}</p>
      <p className={cn(
        'mt-1 text-[23px] font-bold tracking-[-0.02em] tabular-nums',
        result ? 'text-[#2563eb]' : 'text-foreground',
      )}>
        {formatCurrency(value)}
        <span className="ml-1 text-[13px] font-semibold text-company-fg-subtle">원</span>
      </p>
    </div>
  )
}

function IssueAlert({ summary }: PayrollWorkspaceProps) {
  if (!summary.issueAlert.visible) return null

  return (
    <section className="flex items-center gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3.5">
      <span className="size-2 rounded-full bg-[#d97706]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[13.5px] font-semibold text-[#92400e]">{summary.issueAlert.title}</h2>
        <p className="mt-0.5 text-[12.5px] text-[#a16207]">{summary.issueAlert.description}</p>
      </div>
      {summary.issueAlert.targetEmployeeLineId ? (
        <Link
          href={`#payroll-line-${summary.issueAlert.targetEmployeeLineId}`}
          className="rounded-lg border border-[#d97706] bg-company-surface px-3 py-1.5 text-[12.5px] font-semibold text-[#d97706]"
        >
          해당 직원 열기
        </Link>
      ) : (
        <Link
          href="#payroll-register"
          className="rounded-lg border border-[#d97706] bg-company-surface px-3 py-1.5 text-[12.5px] font-semibold text-[#d97706]"
        >
          확인하기
        </Link>
      )}
    </section>
  )
}

function PayrollRegisterSection({ summary }: PayrollWorkspaceProps) {
  const totals = summary.summary
  const hasFreelancer = summary.registerRows.some((row) => row.jobType === '프리랜서')
  const hasDailyWorker = summary.registerRows.some((row) => row.jobType === '일용직')

  return (
    <section id="payroll-register" className="grid gap-3">
      <SectionHeader
        title="급여대장"
        description="직원별 지급·공제·실지급 내역"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-company-nav-hover"
            >
              직원 추가
            </button>
            <Link href="/dashboard/payroll" className="text-[12.5px] font-semibold text-[#2563eb]">엑셀 내보내기 →</Link>
          </div>
        }
      />
      {(hasFreelancer || hasDailyWorker) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-company-fg-muted">
          {hasFreelancer && <EmploymentTypeLegend swatchClass="bg-[#eef3ff]" label="프리랜서(외주) · 사업소득 3.3%" />}
          {hasDailyWorker && <EmploymentTypeLegend swatchClass="bg-[#e9f6ee]" label="일용직 · 일용근로소득" />}
        </div>
      )}
      <div className={panelClass}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse">
            <thead>
              <tr className="border-b border-company-border bg-[#fafafa]">
                <TableHead>직원</TableHead>
                <TableHead className="text-right">기본급</TableHead>
                <TableHead className="text-right">식대(비과세)</TableHead>
                <TableHead className="text-right">수당</TableHead>
                <TableHead className="text-right">지급계</TableHead>
                <TableHead className="text-right">원천세</TableHead>
                <TableHead className="text-right">4대보험</TableHead>
                <TableHead className="text-right">공제계</TableHead>
                <TableHead className="text-right">실지급액</TableHead>
              </tr>
            </thead>
            <tbody>
              {summary.registerRows.length > 0 ? summary.registerRows.map((row) => (
                <EditablePayrollRow key={row.id} row={row} />
              )) : (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[13px] text-company-fg-muted">
                    이 급여월에 집계된 급여대장이 없습니다. 자료수집에서 급여 자료를 먼저 업로드해 주세요.
                  </td>
                </tr>
              )}
            </tbody>
            {summary.registerRows.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-company-border-strong bg-[#fafafa]">
                  <td className="px-3.5 py-2.5 text-left text-[12.5px] font-bold">
                    합계 · {totals.employeeCount.toLocaleString('ko-KR')}명
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[12.5px] font-bold tabular-nums">
                    {formatCurrency(sumBy(summary.registerRows, (row) => row.baseSalaryKrw))}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[12.5px] font-bold tabular-nums">
                    {formatCurrency(sumBy(summary.registerRows, (row) => row.mealAllowanceKrw))}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[12.5px] font-bold tabular-nums">
                    {formatCurrency(sumBy(summary.registerRows, (row) => row.allowanceKrw))}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[12.5px] font-bold tabular-nums">
                    {formatCurrency(totals.grossPayKrw)}
                  </td>
                  <WithholdingBreakdownCell
                    strong
                    incomeTaxKrw={sumBy(summary.registerRows, (row) => row.incomeTaxKrw)}
                    localIncomeTaxKrw={sumBy(summary.registerRows, (row) => row.localIncomeTaxKrw)}
                    withholdingTaxKrw={totals.withholdingTaxKrw}
                  />
                  <td className="px-3.5 py-2.5 text-right text-[12.5px] font-bold tabular-nums">
                    {formatCurrency(totals.socialInsuranceKrw)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[12.5px] font-bold tabular-nums text-[#dc2626]">
                    {formatCurrency(totals.deductionTotalKrw)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-[12.5px] font-bold tabular-nums">
                    {formatCurrency(totals.netPayKrw)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </section>
  )
}

function EmploymentTypeLegend({ swatchClass, label }: { readonly swatchClass: string; readonly label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('inline-block size-3 rounded-[3px] border border-company-border', swatchClass)} aria-hidden />
      {label}
    </span>
  )
}

function DeductionBreakdownCard({ items }: { readonly items: PayrollDeductionBreakdownItem[] }) {
  const total = items.reduce((sum, item) => sum + item.amountKrw, 0)

  return (
    <section className={cn(panelClass, 'p-[18px]')}>
      <SectionHeader title="공제 상세 (원천세·4대보험)" description="신고·납부 기준 공제 집계" compact />
      <div className="mt-3 divide-y divide-company-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-[12.5px] font-medium text-company-fg-muted">{item.label}</p>
            </div>
            <p className="text-[13px] font-semibold tabular-nums text-foreground">{formatCurrency(item.amountKrw)}</p>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3.5">
          <p className="text-[12.5px] font-semibold text-foreground">공제 합계</p>
          <p className="text-[15px] font-bold tabular-nums text-[#dc2626]">{formatCurrency(total)}</p>
        </div>
      </div>
    </section>
  )
}

function PayrollDocumentsCard({ summary }: PayrollWorkspaceProps) {
  const closeNote = summary.closeAction.locked
    ? '확인 필요 1건을 처리해야 마감할 수 있습니다.'
    : '급여 마감이 가능합니다.'

  return (
    <section className={cn(panelClass, 'p-[18px]')}>
      <SectionHeader title="명세서 · 마감" description="급여명세서 발급 및 급여 확정" compact />
      <div className="mt-3 flex flex-col gap-2.5">
        {summary.documents.map((document) => {
          return (
            <div key={document.id} className="flex items-center gap-2.5 rounded-[9px] border border-company-border px-3 py-2.5">
              <div className="grid size-7 place-items-center rounded-[7px] bg-[#eff6ff] text-[11px] font-bold text-[#2563eb]">
                {documentLabel[document.id]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-foreground">{document.title}</p>
                <p className="truncate text-[11px] text-company-fg-subtle">{document.description}</p>
              </div>
              <span className="text-xs font-semibold text-[#2563eb]">미리보기</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-company-border pt-3.5">
        <p className="flex-1 text-xs text-company-fg-subtle">{closeNote}</p>
        <button
          type="button"
          className="rounded-lg border border-company-border-strong bg-company-surface px-3.5 py-2 text-[12.5px] font-semibold text-foreground"
        >
          임시 저장
        </button>
        <PayrollCloseButton periodKey={summary.period.key} closeAction={summary.closeAction} />
      </div>
    </section>
  )
}

function StateCoverageSection() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <StateCard label="Loading">
        <div className="h-3 w-2/5 rounded-full bg-muted" />
        <div className="mt-2 h-3 w-4/5 rounded-full bg-muted" />
        <div className="mt-2 h-3 w-3/5 rounded-full bg-muted" />
      </StateCard>
      <StateCard label="Empty">
        <div className="flex flex-1 flex-col items-center justify-center text-center text-company-fg-subtle">
          <span className="text-[22px] opacity-50">₩</span>
          <p className="mt-1.5 text-[12.5px]">이 달 급여 입력이 없습니다</p>
          <Link href="/dashboard/direct-upload?kind=payroll" className="mt-2 text-xs font-semibold text-[#2563eb]">
            급여 자료 불러오기
          </Link>
        </div>
      </StateCard>
      <StateCard label="Error">
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-[13px] font-semibold text-[#dc2626]">급여 계산을 불러오지 못했습니다</p>
          <p className="mt-1 text-xs text-company-fg-muted">일시적 오류입니다. 잠시 후 다시 시도해 주세요.</p>
          <Link href="/dashboard/payroll" className="mt-2 w-fit rounded-lg border border-company-border-strong px-2.5 py-1 text-xs font-semibold">
            다시 시도
          </Link>
        </div>
      </StateCard>
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
    <p className="rounded-[10px] border border-company-border bg-[#fafafa] px-3.5 py-3 text-xs text-company-fg-subtle">
      {/* 건강보험 EDI/사회보험 고지액은 업로드/수동 입력만 허용한다. 자동 로그인/공동인증서 저장 UI는 렌더하지 않는다. */}
      <b className="text-company-fg-muted">Preview 안내</b> — 이 화면은 <b className="text-company-fg-muted">급여</b> UI 확인용 정적 프리뷰입니다.
      데이터는 전부 가공값(샘플컴퍼니(주))이며 실제 급여·개인정보가 아닙니다. 구성: 급여 요약(지급·공제·실지급·마감상태) ·
      확인 필요 직원 알림 · 급여대장(직원별 지급/공제/실지급) · 공제 상세(원천세·4대보험) · 급여명세서/지급명세서 ·
      마감·확정 · 상태(로딩/빈/오류) 예시. 원천징수 지급명세서는 <b className="text-company-fg-muted">원천세</b> 화면으로 전달됩니다.
    </p>
  )
}

function SectionHeader({
  title,
  description,
  action,
  compact = false,
}: {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
  readonly compact?: boolean
}) {
  return (
    <div className={cn('flex items-baseline gap-2.5', compact && 'mb-1')}>
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-xs text-company-fg-subtle">{description}</p>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  )
}

function TableHead({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <th className={cn('px-3.5 py-2.5 text-left text-[11px] font-semibold tracking-[0.02em] text-company-fg-subtle uppercase', className)}>
      {children}
    </th>
  )
}

function ToneChip({
  tone,
  children,
  className,
}: {
  readonly tone: PayrollTone
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold',
      toneChipClass[tone],
      className,
    )}>
      {children}
    </span>
  )
}

export function PayrollBusinessEntityEmptyState({ tenantName }: { readonly tenantName: string }) {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 bg-company-bg p-6">
      <div className={cn(panelClass, 'p-6')}>
        <h1 className="text-lg font-semibold text-foreground">사업장을 먼저 등록해 주세요</h1>
        <p className="mt-2 text-sm text-company-fg-muted">
          {tenantName}에 연결된 사업장이 없어서 급여대장을 구성할 수 없습니다.
        </p>
        <Link href="/dashboard/settings" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          설정으로 이동
        </Link>
      </div>
    </div>
  )
}

function formatCurrency(value: number) {
  return value.toLocaleString('ko-KR')
}

function sumBy(rows: PayrollRegisterRow[], selector: (row: PayrollRegisterRow) => number) {
  return rows.reduce((sum, row) => sum + selector(row), 0)
}
