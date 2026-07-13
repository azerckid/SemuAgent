import Link from 'next/link'
import {
  buildYearEndSettlementBlockers,
  buildYearEndSettlementHero,
  type PaymentStatementSummary,
  type YearEndRow,
} from '@/lib/payment-statements/summary'
import {
  ReviewBlockers,
  ReviewCell,
  ReviewChip,
  ReviewEmployeeCell,
  ReviewHeroMetric,
  ReviewNumberCell,
  ReviewSectionHead,
  ReviewTableHeadCell,
} from '../../_components/statement-review-ui'

const KRW = new Intl.NumberFormat('ko-KR')

interface YearEndSettlementEmptyStateProps {
  readonly tenantName: string
}

export function YearEndSettlementEmptyState({ tenantName }: YearEndSettlementEmptyStateProps) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 급여·지급 › 연말정산</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">연말정산</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[720px] rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card">
          <h2 className="text-sm font-semibold text-foreground">사업장을 먼저 등록해 주세요</h2>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">
            {tenantName}에 등록된 사업장이 있어야 연말정산 준비 데이터를 집계할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

interface YearEndSettlementReviewProps {
  readonly summary: PaymentStatementSummary
}

export function YearEndSettlementReview({ summary }: YearEndSettlementReviewProps) {
  const { context, yearEnd } = summary
  const hero = buildYearEndSettlementHero(yearEnd)
  const blockers = buildYearEndSettlementBlockers(yearEnd)
  const isYearOpen = context.yearPeriodStatus === 'open'

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="flex items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-company-fg-subtle">
            회사 홈 › <Link href="/dashboard/payroll" className="hover:underline">급여·지급</Link> › 연말정산
          </p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">연말정산</h1>
        </div>
        <span className="ml-auto text-[13px] font-medium text-company-fg-muted">{summary.tenant.name}</span>
        <span className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium">
          귀속연도 <span className="ml-1 rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-[10.5px] font-bold text-[#2563eb]">{context.year}</span>
        </span>
      </div>

      <div className="flex w-full max-w-[1240px] flex-col gap-[22px] px-7 pt-6 pb-12">
        <section className="grid gap-6 rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card lg:grid-cols-[1fr_300px]">
          <div>
            <p className="text-xs font-semibold text-company-fg-muted">연말정산 준비·검토</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">직원별 연간 지급액과 기납부 원천세를 확인합니다</h2>
            <p className="mt-2 max-w-[650px] text-[13px] text-company-fg-muted">
              연간 급여와 기납부 원천세, 누락 및 중도퇴사 정산 필요 여부를 검토합니다. 결정세액·환급·추징 계산은 현재 범위에 포함하지 않습니다.
            </p>
            <div className="mt-4 h-2 max-w-[520px] overflow-hidden rounded-full bg-company-border">
              <span className="block h-full bg-[#2563eb]" style={{ width: `${hero.readinessPercent}%` }} />
            </div>
          </div>
          <div className="grid gap-2">
            <ReviewHeroMetric label="대상 인원" value={`${hero.totalEmployees}명`} />
            <ReviewHeroMetric label="확인 필요" value={`${hero.attentionCount}명`} />
            {hero.periodOpenCount > 0 ? <ReviewHeroMetric label="연도 진행 중" value={`${hero.periodOpenCount}명`} /> : null}
            <ReviewHeroMetric label="검토 준비" value={`${hero.readyCount}명`} />
          </div>
        </section>

        <ReviewBlockers blockers={blockers} />

        <ReviewSectionHead title="연말정산 준비·검토" hint="직원별 연간 지급·기납부 원천세 집계" />
        <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
          <p className="border-b border-company-border bg-[#fafafa] px-[18px] py-2.5 text-xs text-company-fg-muted">
            귀속연도 <b>{context.year}</b> · {isYearOpen ? '진행 중 연도는 현재까지 집계하며 검토 준비로 확정하지 않습니다.' : '완료 연도의 연간 집계와 누락을 검토합니다.'} 결정세액·환급·추징 계산은 범위 밖입니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#fcfcfd] text-[11px] uppercase tracking-[0.03em] text-company-fg-subtle">
                  <ReviewTableHeadCell>직원</ReviewTableHeadCell>
                  <ReviewTableHeadCell>재직</ReviewTableHeadCell>
                  <ReviewTableHeadCell right>{isYearOpen ? '현재까지 지급합계' : '연간 지급합계'}</ReviewTableHeadCell>
                  <ReviewTableHeadCell right>기납부 원천세</ReviewTableHeadCell>
                  <ReviewTableHeadCell>누락</ReviewTableHeadCell>
                  <ReviewTableHeadCell>검토 상태</ReviewTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {yearEnd.length === 0 ? (
                  <tr><td colSpan={6} className="px-[18px] py-4 text-company-fg-muted">집계할 급여 데이터가 없습니다.</td></tr>
                ) : null}
                {yearEnd.map((row) => <YearEndRowView key={row.employeeKey} row={row} />)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-[18px] py-4 text-[12.5px] text-[#1e3a8a]">
          이 화면은 연말정산에 필요한 연간 급여와 기납부 원천세의 준비 상태를 확인합니다. 정산액 계산과 홈택스 자동 입력·제출은 하지 않습니다.
        </section>
      </div>
    </div>
  )
}

function YearEndRowView({ row }: { readonly row: YearEndRow }) {
  return (
    <tr>
      <ReviewEmployeeCell name={row.employeeName} code={row.employeeCode} />
      <ReviewCell>
        <ReviewChip tone={row.employeeStatus === 'terminated' ? 'muted' : 'ok'}>{row.employeeStatusLabel}</ReviewChip>
      </ReviewCell>
      <ReviewNumberCell>
        {row.annualGrossPayKrw === null ? <span className="text-company-fg-subtle">집계 대기</span> : KRW.format(row.annualGrossPayKrw)}
      </ReviewNumberCell>
      <ReviewNumberCell>
        {row.annualWithholdingTaxKrw === null ? <span className="text-company-fg-subtle">-</span> : KRW.format(row.annualWithholdingTaxKrw)}
      </ReviewNumberCell>
      <ReviewCell>
        <span className={row.missingLabel === '없음' ? '' : 'font-semibold text-[#dc2626]'}>{row.missingLabel}</span>
      </ReviewCell>
      <ReviewCell><ReviewChip tone={row.tone}>{row.statusLabel}</ReviewChip></ReviewCell>
    </tr>
  )
}
