import Link from 'next/link'
import type { SimplifiedWageEfilingSummary } from '@/lib/efiling-simplified-wage/summary'
import {
  buildSimplifiedStatementHero,
  buildSimplifiedStatementBlockers,
  type PaymentStatementSummary,
  type SimplifiedRow,
} from '@/lib/payment-statements/summary'
import {
  ReviewCell,
  ReviewChip,
  ReviewEmployeeCell,
  ReviewHeroMetric,
  ReviewNumberCell,
  ReviewSectionHead,
  ReviewTableHeadCell,
} from '../../_components/statement-review-ui'
import { ActionBlockerList } from '../../_components/action-blocker-list'
import { SimplifiedWageEfilingPanel } from './simplified-wage-efiling-panel'

const KRW = new Intl.NumberFormat('ko-KR')

interface PaymentStatementEmptyStateProps {
  readonly tenantName: string
}

export function PaymentStatementEmptyState({ tenantName }: PaymentStatementEmptyStateProps) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 급여·지급 › 지급명세서</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">지급명세서</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[720px] rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card">
          <h2 className="text-sm font-semibold text-foreground">사업장을 먼저 등록해 주세요</h2>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">
            {tenantName}에 등록된 사업장이 있어야 지급명세서 준비 데이터를 집계할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

interface PaymentStatementReviewProps {
  readonly summary: PaymentStatementSummary
  readonly efiling: SimplifiedWageEfilingSummary | null
}

export function PaymentStatementReview({ summary, efiling }: PaymentStatementReviewProps) {
  const { context, simplified } = summary
  const hero = buildSimplifiedStatementHero(simplified)
  const blockers = buildSimplifiedStatementBlockers(simplified)

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="flex items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-company-fg-subtle">
            회사 홈 › <Link href="/dashboard/payroll" className="hover:underline">급여·지급</Link> › 지급명세서
          </p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">지급명세서</h1>
        </div>
        <span className="ml-auto text-[13px] font-medium text-company-fg-muted">{summary.tenant.name}</span>
        <span className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium">
          귀속연도 <span className="ml-1 rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-[10.5px] font-bold text-[#2563eb]">{context.year}</span>
        </span>
        <span className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium">
          기간 <span className="ml-1 rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-[10.5px] font-bold text-[#2563eb]">{context.halfLabel}</span>
        </span>
      </div>

      <div className="flex w-full max-w-[1240px] flex-col gap-[22px] px-7 pt-6 pb-12">
        <section className="grid gap-6 rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card lg:grid-cols-[1fr_300px]">
          <div>
            <p className="text-xs font-semibold text-company-fg-muted">근로소득 간이지급명세서 준비</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">반기 지급액을 홈택스 직접작성 값으로 정리합니다</h2>
            <p className="mt-2 max-w-[650px] text-[13px] text-company-fg-muted">
              월별 급여의 지급액을 반기 단위로 집계해 간이지급명세서 준비 상태와 홈택스 직접작성 값을 확인합니다.
            </p>
            <div className="mt-4 h-2 max-w-[520px] overflow-hidden rounded-full bg-company-border">
              <span className="block h-full bg-[#2563eb]" style={{ width: `${hero.readinessPercent}%` }} />
            </div>
          </div>
          <div className="grid gap-2">
            <ReviewHeroMetric label="대상 인원" value={`${hero.totalEmployees}명`} />
            <ReviewHeroMetric label="확인 필요" value={`${hero.attentionCount}명`} />
            {hero.periodOpenCount > 0 ? <ReviewHeroMetric label="기간 진행 중" value={`${hero.periodOpenCount}명`} /> : null}
            <ReviewHeroMetric label="준비 완료" value={`${hero.readyCount}명`} />
          </div>
        </section>

        <ActionBlockerList items={blockers} />

        <ReviewSectionHead title="간이지급명세서 (근로소득 · 반기)" hint="월별 급여 원천을 반기 단위로 집계한 신고 준비 데이터" />
        <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
          <p className="border-b border-company-border bg-[#fafafa] px-[18px] py-2.5 text-xs text-company-fg-muted">
            귀속기간 <b>{context.halfRangeLabel}</b> · 제출 주기 반기(근로소득 간이지급명세서) · 원천징수세액은 근로소득세(지방소득세 별도)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#fcfcfd] text-[11px] uppercase tracking-[0.03em] text-company-fg-subtle">
                  <ReviewTableHeadCell>직원</ReviewTableHeadCell>
                  <ReviewTableHeadCell>귀속기간</ReviewTableHeadCell>
                  <ReviewTableHeadCell right>지급총액</ReviewTableHeadCell>
                  <ReviewTableHeadCell right>원천징수세액</ReviewTableHeadCell>
                  <ReviewTableHeadCell>준비 상태</ReviewTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {simplified.length === 0 ? (
                  <tr><td colSpan={5} className="px-[18px] py-4 text-company-fg-muted">집계할 급여 데이터가 없습니다.</td></tr>
                ) : null}
                {simplified.map((row) => <SimplifiedRowView key={row.employeeKey} row={row} />)}
              </tbody>
            </table>
          </div>
        </section>

        {efiling ? (
          <>
            <ReviewSectionHead title="홈택스 직접작성 값" hint="근로소득 간이지급명세서" />
            <SimplifiedWageEfilingPanel efiling={efiling} />
          </>
        ) : null}

        <section className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-[18px] py-4 text-[12.5px] text-[#1e3a8a]">
          {efiling
            ? '홈택스 직접작성 경로와 입력값을 정리하며, 실제 입력·제출은 사용자가 직접 합니다.'
            : '지급명세서 준비 데이터를 정리하며, 홈택스 직접작성 값은 준비 조건을 충족한 뒤 표시합니다.'}
          {' '}자동 제출·자격증명 저장은 하지 않습니다.
        </section>
      </div>
    </div>
  )
}

function SimplifiedRowView({ row }: { readonly row: SimplifiedRow }) {
  return (
    <tr>
      <ReviewEmployeeCell name={row.employeeName} code={row.employeeCode} />
      <ReviewCell>{row.periodLabel}</ReviewCell>
      <ReviewNumberCell>{KRW.format(row.grossPayKrw)}</ReviewNumberCell>
      <ReviewNumberCell>{KRW.format(row.withholdingTaxKrw)}</ReviewNumberCell>
      <ReviewCell><ReviewChip tone={row.tone}>{row.statusLabel}</ReviewChip></ReviewCell>
    </tr>
  )
}
