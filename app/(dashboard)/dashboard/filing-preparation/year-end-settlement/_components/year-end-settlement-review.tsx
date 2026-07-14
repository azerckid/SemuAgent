import Link from 'next/link'
import {
  buildYearEndSettlementHero,
  type PaymentStatementSummary,
} from '@/lib/payment-statements/summary'
import { PeriodContextControl, type PeriodContext } from '../../_components/period-context-control'
import { ReviewTableHeadCell } from '../../_components/statement-review-ui'
import { YearEndSettlementEmployeeRow } from './year-end-settlement-employee-row'

interface YearEndSettlementEmptyStateProps {
  readonly tenantName: string
}

export function YearEndSettlementEmptyState({ tenantName }: YearEndSettlementEmptyStateProps) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <YearEndSettlementHeader tenantName={tenantName} />
      <div className="px-4 pt-6 sm:px-7">
        <div className="max-w-[720px] rounded-lg border border-company-border bg-company-surface p-6 shadow-company-card">
          <h2 className="text-sm font-semibold text-foreground">사업장을 먼저 등록해 주세요</h2>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">
            {tenantName}에 등록된 사업장이 있어야 홈택스 지급명세서 생성용 급여 기초자료를 준비할 수 있습니다.
          </p>
          <Link
            href="/dashboard/clients"
            className="mt-4 inline-flex rounded-md border border-company-border-strong bg-company-surface px-3 py-1.5 text-[12.5px] font-semibold text-foreground"
          >
            사업장 등록으로 이동
          </Link>
        </div>
      </div>
    </div>
  )
}

interface YearEndSettlementReviewProps {
  readonly summary: PaymentStatementSummary
  readonly periodContext: PeriodContext
}

const HOMETAX_STEPS = ['기초자료 등록', '공제신고서 확인', '지급명세서 생성', '확인·수정', '제출'] as const

export function YearEndSettlementReview({ summary, periodContext }: YearEndSettlementReviewProps) {
  const { context, yearEnd } = summary
  const hero = buildYearEndSettlementHero(yearEnd)
  const isYearOpen = context.yearPeriodStatus === 'open'

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <YearEndSettlementHeader
        periodContext={periodContext}
        tenantName={summary.tenant.name}
      />

      <main className="flex w-full max-w-[1440px] flex-col gap-5 px-4 pt-6 pb-12 sm:px-7">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <p className="text-xs font-semibold text-company-fg-muted">근로소득 지급명세서 · 홈택스 생성 준비</p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
              홈택스 편리한 연말정산에서 지급명세서를 생성합니다
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-company-fg-muted">
              SemuAgent는 회사 급여 기초자료를 정리하고, 공제신고서 확인과 최종 생성·제출은 홈택스에서 진행합니다.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-2 divide-x divide-company-border overflow-hidden rounded-lg border border-company-border bg-company-surface sm:grid-cols-4">
            <SummaryMetric label="대상" value={`${hero.totalEmployees}명`} />
            <SummaryMetric label="준비 완료" value={`${hero.readyCount}명`} tone="ok" />
            <SummaryMetric label="급여 보완" value={`${hero.payrollActionCount}명`} tone="warn" />
            <SummaryMetric label="특례 확인" value={`${hero.specialCaseCount}명`} tone="warn" />
          </div>
        </section>

        <nav
          aria-label="홈택스 연말정산 처리 흐름"
          className="flex min-h-11 items-center gap-2 overflow-x-auto border-y border-company-border py-2 text-xs"
        >
          <span className="shrink-0 font-semibold text-company-fg-muted">홈택스 처리 흐름</span>
          {HOMETAX_STEPS.map((step, index) => (
            <span key={step} className="contents">
              {index > 0 ? <span className="shrink-0 text-company-fg-subtle">→</span> : null}
              <span className={index === 0
                ? 'shrink-0 rounded-full bg-[#18181b] px-2.5 py-1 font-semibold text-white'
                : 'shrink-0 text-company-fg-muted'}
              >
                {step}
              </span>
            </span>
          ))}
        </nav>

        <section className="overflow-hidden rounded-lg border border-company-border bg-company-surface shadow-company-card">
          <header className="flex flex-col gap-1 border-b border-company-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-[18px]">
            <div>
              <h3 className="text-sm font-semibold">직원별 급여 기초자료</h3>
              <p className="mt-0.5 text-xs text-company-fg-subtle">
                {context.year}-01-01 ~ {context.year}-12-31 · {isYearOpen ? '완료 월까지의 확정 급여 기준' : '확정 급여 기준'}
              </p>
            </div>
            {isYearOpen ? (
              <span className="w-fit rounded-full border border-company-border bg-[#f4f4f5] px-2.5 py-1 text-[11.5px] font-semibold text-company-fg-muted">
                연도 진행 중 · 준비 완료로 확정하지 않음
              </span>
            ) : null}
          </header>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-[12.5px]">
              <colgroup>
                <col className="w-[180px]" />
                <col className="w-[150px]" />
                <col />
                <col className="w-[230px]" />
                <col className="w-[130px]" />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr className="bg-[#fcfcfd] text-[11px] text-company-fg-subtle">
                  <ReviewTableHeadCell>직원</ReviewTableHeadCell>
                  <ReviewTableHeadCell>근무기간</ReviewTableHeadCell>
                  <ReviewTableHeadCell>급여 준비값</ReviewTableHeadCell>
                  <ReviewTableHeadCell>홈택스에서 확인</ReviewTableHeadCell>
                  <ReviewTableHeadCell>상태</ReviewTableHeadCell>
                  <ReviewTableHeadCell><span className="sr-only">상세</span></ReviewTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {yearEnd.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-[18px] py-10 text-center">
                      <p className="text-sm font-semibold text-foreground">완료 연도의 확정 급여가 없습니다</p>
                      <p className="mt-1 text-xs text-company-fg-muted">급여와 직원 명부를 준비하면 직원별 기초자료가 표시됩니다.</p>
                      <Link href="/dashboard/payroll" className="mt-3 inline-flex text-xs font-semibold text-[#2563eb] hover:underline">
                        급여로 이동
                      </Link>
                    </td>
                  </tr>
                ) : null}
                {yearEnd.map((row, index) => (
                  <YearEndSettlementEmployeeRow
                    key={row.employeeKey}
                    row={row}
                    defaultExpanded={index === 0}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <footer className="border-t border-company-border bg-[#fafafa] px-4 py-3 text-xs text-company-fg-muted sm:px-[18px]">
            <strong className="text-foreground">개인정보 경계:</strong> 주민등록번호와 공제신고서·공제증빙은 SemuAgent에 입력하거나 업로드하지 않고 홈택스에서 직접 확인합니다.
            <span className="ml-1">결정세액·환급·추징도 홈택스 결과를 확인합니다.</span>
          </footer>
        </section>
      </main>
    </div>
  )
}

interface YearEndSettlementHeaderProps {
  readonly tenantName: string
  readonly periodContext?: PeriodContext
}

function YearEndSettlementHeader({ tenantName, periodContext }: YearEndSettlementHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-company-border bg-company-surface px-4 py-3.5 sm:px-7">
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium text-company-fg-subtle">
          회사 홈 › <Link href="/dashboard/payroll" className="hover:underline">급여·지급</Link> › 연말정산
        </p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">연말정산</h1>
      </div>
      <span className="ml-auto hidden text-[13px] font-medium text-company-fg-muted sm:inline">{tenantName}</span>
      {periodContext ? <PeriodContextControl context={periodContext} /> : null}
    </header>
  )
}

interface SummaryMetricProps {
  readonly label: string
  readonly value: string
  readonly tone?: 'ok' | 'warn'
}

function SummaryMetric({ label, value, tone }: SummaryMetricProps) {
  const toneClass = tone === 'ok' ? 'text-[#15803d]' : tone === 'warn' ? 'text-[#b45309]' : 'text-foreground'
  return (
    <div className="min-w-[92px] px-3 py-2.5">
      <p className="text-[11px] text-company-fg-subtle">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  )
}
