import Link from 'next/link'
import type { SimplifiedWageEfilingSummary } from '@/lib/efiling-simplified-wage/summary'
import type {
  PaymentStatementSummary,
  PaymentStatementTone,
  SimplifiedRow,
  YearEndRow,
} from '@/lib/payment-statements/summary'
import { SimplifiedWageEfilingPanel } from './simplified-wage-efiling-panel'

const CHIP_TONE: Record<PaymentStatementTone, string> = {
  ok: 'text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]',
  warn: 'text-[#d97706] bg-[#fffbeb] border-[#fde68a]',
  danger: 'text-[#dc2626] bg-[#fef2f2] border-[#fecaca]',
  muted: 'text-company-fg-muted bg-[#f4f4f5] border-company-border',
}

const KRW = new Intl.NumberFormat('ko-KR')

function Chip({ tone, children }: { tone: PaymentStatementTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${CHIP_TONE[tone]}`}>
      {children}
    </span>
  )
}

export function PaymentStatementEmptyState({ tenantName }: { readonly tenantName: string }) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 급여·지급 › 지급명세서·연말정산</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">지급명세서 · 연말정산</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[720px] rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card">
          <h2 className="text-sm font-semibold text-foreground">사업장을 먼저 등록해 주세요</h2>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">
            {tenantName}에 등록된 사업장이 있어야 지급명세서·연말정산 준비 데이터를 집계할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export function PaymentStatementReview({
  summary,
  efiling,
}: {
  readonly summary: PaymentStatementSummary
  readonly efiling: SimplifiedWageEfilingSummary | null
}) {
  const { context, hero, blockers, simplified, yearEnd } = summary

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="flex items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-company-fg-subtle">
            회사 홈 › <Link href="/dashboard/payroll" className="hover:underline">급여·지급</Link> › 지급명세서·연말정산
          </p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">지급명세서 · 연말정산</h1>
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
        {/* Hero */}
        <section className="grid gap-6 rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card lg:grid-cols-[1fr_300px]">
          <div>
            <p className="text-xs font-semibold text-company-fg-muted">근로소득 지급명세서 · 연말정산 준비</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">직원별 소득·원천세 데이터를 신고 준비 기준으로 정리합니다</h2>
            <p className="mt-2 max-w-[650px] text-[13px] text-company-fg-muted">
              월별 급여의 지급액·원천세를 반기/연 단위로 집계해, 간이지급명세서와 연말정산에 넣을 신고 준비 데이터를 확인·검토합니다. 간이지급명세서는 아래에서 홈택스 직접작성 값까지 정리합니다.
            </p>
            <div className="mt-4 h-2 max-w-[520px] overflow-hidden rounded-full bg-company-border">
              <span className="block h-full bg-[#2563eb]" style={{ width: `${hero.readinessPercent}%` }} />
            </div>
          </div>
          <div className="grid gap-2">
            <HeroMetric label="대상 인원" value={`${hero.totalEmployees}명`} />
            <HeroMetric label="확인 필요" value={`${hero.attentionCount}명`} />
            {hero.periodOpenCount > 0 ? <HeroMetric label="기간 진행 중" value={`${hero.periodOpenCount}명`} /> : null}
            <HeroMetric label="데이터 준비 완료" value={`${hero.readyCount}명`} />
          </div>
        </section>

        {/* 확인 필요 */}
        {blockers.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
            {blockers.map((blocker) => (
              <div key={blocker.id} className="grid grid-cols-[12px_1fr_auto] items-center gap-3.5 border-b border-company-border px-[18px] py-3.5 last:border-b-0">
                <span className={`size-2 rounded-full ${blocker.tone === 'danger' ? 'bg-[#dc2626]' : 'bg-[#d97706]'}`} />
                <div>
                  <p className="text-[13.5px] font-semibold">{blocker.title}</p>
                  <p className="mt-0.5 text-xs text-company-fg-subtle">{blocker.description}</p>
                </div>
                <Link
                  href={blocker.href}
                  className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold ${blocker.tone === 'danger' ? 'border-[#18181b] bg-[#18181b] text-white' : 'border-company-border-strong bg-company-surface'}`}
                >
                  {blocker.ctaLabel}
                </Link>
              </div>
            ))}
          </section>
        )}

        {/* 간이지급명세서 */}
        <SectionHead title="간이지급명세서 (근로소득 · 반기)" hint="월별 급여 원천을 반기 단위로 집계한 신고 준비 데이터" />
        <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
          <p className="border-b border-company-border bg-[#fafafa] px-[18px] py-2.5 text-xs text-company-fg-muted">
            귀속기간 <b>{context.halfRangeLabel}</b> · 제출 주기 반기(근로소득 간이지급명세서) · 원천징수세액은 근로소득세(지방소득세 별도)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#fcfcfd] text-[11px] uppercase tracking-[0.03em] text-company-fg-subtle">
                  <Th>직원</Th><Th>귀속기간</Th><Th right>지급총액</Th><Th right>원천징수세액</Th><Th>준비 상태</Th>
                </tr>
              </thead>
              <tbody>
                {simplified.length === 0 && (
                  <tr><td colSpan={5} className="px-[18px] py-4 text-company-fg-muted">집계할 급여 데이터가 없습니다.</td></tr>
                )}
                {simplified.map((row) => <SimplifiedTr key={row.employeeKey} row={row} />)}
              </tbody>
            </table>
          </div>
        </section>

        {efiling && (
          <>
            <SectionHead
              title="홈택스 직접작성 값 (JC-030)"
              hint="근로소득 간이지급명세서 · Path 1b"
            />
            <SimplifiedWageEfilingPanel efiling={efiling} />
          </>
        )}

        {/* 연말정산 */}
        <SectionHead title="연말정산 준비·검토" hint="직원별 연간 지급·기납부 원천세 집계 (정산액 계산은 범위 밖)" />
        <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
          <p className="border-b border-company-border bg-[#fafafa] px-[18px] py-2.5 text-xs text-company-fg-muted">
            귀속연도 <b>{context.year}</b> · 이 화면은 연간 집계·누락 검토까지 제공하며, 결정세액·환급/추징 계산은 범위 밖입니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#fcfcfd] text-[11px] uppercase tracking-[0.03em] text-company-fg-subtle">
                  <Th>직원</Th><Th>재직</Th><Th right>연간 지급합계</Th><Th right>기납부 원천세</Th><Th>누락</Th><Th>검토 상태</Th>
                </tr>
              </thead>
              <tbody>
                {yearEnd.length === 0 && (
                  <tr><td colSpan={6} className="px-[18px] py-4 text-company-fg-muted">집계할 급여 데이터가 없습니다.</td></tr>
                )}
                {yearEnd.map((row) => <YearEndTr key={row.employeeKey} row={row} />)}
              </tbody>
            </table>
          </div>
        </section>

        {/* 책임 경계 */}
        <section className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-[18px] py-4 text-[12.5px] text-[#1e3a8a]">
          <b className="text-[#172554]">책임 경계</b> — 홈택스 입력·제출 전에 확인할 <b>신고 준비 데이터</b>를 정리합니다. 정산액 계산·연말정산 자동 제출은 이번 범위에 포함하지 않습니다.
          {efiling
            ? ' 간이지급명세서(JC-030)는 위 패널에서 홈택스 직접작성 경로와 입력값을 제공하며, 실제 입력·제출은 사용자가 직접 합니다.'
            : ' 홈택스 직접작성 값 정리·제출은 이번 범위에 포함하지 않습니다.'}
          {' '}자동 제출·자격증명 저장은 하지 않습니다.
        </section>
      </div>
    </div>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-company-border bg-[#fcfcfd] px-3 py-2.5">
      <p className="text-[11px] text-company-fg-subtle">{label}</p>
      <p className="mt-0.5 text-lg font-bold tracking-tight">{value}</p>
    </div>
  )
}

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <span className="text-xs text-company-fg-subtle">{hint}</span>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`whitespace-nowrap border-b border-company-border px-[18px] py-2.5 font-bold ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}

function EmployeeCell({ name, code }: { name: string; code: string | null }) {
  return (
    <td className="whitespace-nowrap border-b border-company-border px-[18px] py-2.5">
      <div className="text-[13px] font-semibold">{name}</div>
      {code && <div className="text-[11px] text-company-fg-subtle">{code}</div>}
    </td>
  )
}

function Num({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap border-b border-company-border px-[18px] py-2.5 text-right tabular-nums">{children}</td>
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap border-b border-company-border px-[18px] py-2.5">{children}</td>
}

function SimplifiedTr({ row }: { row: SimplifiedRow }) {
  return (
    <tr>
      <EmployeeCell name={row.employeeName} code={row.employeeCode} />
      <Cell>{row.periodLabel}</Cell>
      <Num>{KRW.format(row.grossPayKrw)}</Num>
      <Num>{KRW.format(row.withholdingTaxKrw)}</Num>
      <Cell><Chip tone={row.tone}>{row.statusLabel}</Chip></Cell>
    </tr>
  )
}

function YearEndTr({ row }: { row: YearEndRow }) {
  return (
    <tr>
      <EmployeeCell name={row.employeeName} code={row.employeeCode} />
      <Cell><Chip tone={row.employeeStatus === 'terminated' ? 'muted' : 'ok'}>{row.employeeStatusLabel}</Chip></Cell>
      <Num>{row.annualGrossPayKrw === null ? <span className="text-company-fg-subtle">집계 대기</span> : KRW.format(row.annualGrossPayKrw)}</Num>
      <Num>{row.annualWithholdingTaxKrw === null ? <span className="text-company-fg-subtle">—</span> : KRW.format(row.annualWithholdingTaxKrw)}</Num>
      <Cell><span className={row.missingLabel === '없음' ? '' : 'font-semibold text-[#dc2626]'}>{row.missingLabel}</span></Cell>
      <Cell><Chip tone={row.tone}>{row.statusLabel}</Chip></Cell>
    </tr>
  )
}
