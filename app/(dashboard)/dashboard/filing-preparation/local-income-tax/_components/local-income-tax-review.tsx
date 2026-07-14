import Link from 'next/link'
import type { LocalIncomeTaxRow, LocalIncomeTaxSummary, LocalIncomeTaxTone } from '@/lib/local-income-tax/summary'
import { ActionBlockerList } from '../../_components/action-blocker-list'
import { PeriodContextControl, type PeriodContext } from '../../_components/period-context-control'

const CHIP_TONE: Record<LocalIncomeTaxTone, string> = {
  ok: 'text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]',
  warn: 'text-[#d97706] bg-[#fffbeb] border-[#fde68a]',
  danger: 'text-[#dc2626] bg-[#fef2f2] border-[#fecaca]',
  muted: 'text-company-fg-muted bg-[#f4f4f5] border-company-border',
}

const KRW = new Intl.NumberFormat('ko-KR')

function Chip({ tone, children }: { tone: LocalIncomeTaxTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${CHIP_TONE[tone]}`}>
      {children}
    </span>
  )
}

export function LocalIncomeTaxEmptyState({ tenantName }: { readonly tenantName: string }) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 급여·지급 › 지방소득세</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">지방소득세</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[720px] rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card">
          <h2 className="text-sm font-semibold text-foreground">사업장을 먼저 등록해 주세요</h2>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">
            {tenantName}에 등록된 사업장이 있어야 원천세 특별징수 지방소득세를 집계할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export function LocalIncomeTaxReview({
  summary,
  periodContext,
}: {
  readonly summary: LocalIncomeTaxSummary
  readonly periodContext: PeriodContext
}) {
  const { period, hero, blockers, rows, totals } = summary

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="flex flex-wrap items-center gap-3 border-b border-company-border bg-company-surface px-4 py-3.5 sm:px-7">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-company-fg-subtle">
            회사 홈 › <Link href="/dashboard/payroll" className="hover:underline">급여·지급</Link> › 지방소득세
          </p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">지방소득세</h1>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <span className="hidden text-[13px] font-medium text-company-fg-muted md:inline">{summary.tenant.name}</span>
          <PeriodContextControl context={periodContext} />
        </div>
      </div>

      <div className="flex w-full max-w-[1240px] flex-col gap-[22px] px-7 pt-6 pb-12">
        <section className="grid gap-6 rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card lg:grid-cols-[1fr_300px]">
          <div>
            <p className="text-xs font-semibold text-company-fg-muted">원천세 특별징수 지방소득세 준비</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">원천세 신고 주기 기준으로 넣을 지방소득세를 확인합니다</h2>
            <p className="mt-2 max-w-[710px] text-[13px] text-company-fg-muted">
              급여에서 실제로 원천징수된 지방소득세 기록을 직원별로 집계합니다. 근사치를 다시 계산하지 않고, 확정 급여에 기록된 실제 값을 그대로 보여줍니다. 종합소득세·법인세분 지방소득세와 위택스 제출은 이 화면 범위 밖입니다.
            </p>
            <div className="mt-4 h-2 max-w-[520px] overflow-hidden rounded-full bg-company-border">
              <span className="block h-full bg-[#2563eb]" style={{ width: `${hero.readinessPercent}%` }} />
            </div>
          </div>
          <div className="grid gap-2">
            <HeroMetric label="대상 인원" value={`${hero.totalEmployees}명`} />
            <HeroMetric label="확인 필요" value={`${hero.attentionCount}명`} />
            <HeroMetric label="지방소득세 합계" value={KRW.format(hero.localIncomeTaxTotalKrw)} />
          </div>
        </section>

        <ActionBlockerList items={blockers} />

        <SectionHead title="직원별 지방소득세 내역 (원천세 특별징수분)" hint="급여에 기록된 실제 원천징수·지방소득세 값" />
        <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
          <p className="border-b border-company-border bg-[#fafafa] px-[18px] py-2.5 text-xs text-company-fg-muted">
            귀속기간 <b>{period.periodKey}</b> · 원천세 신고 주기 기준 · 값은 확정 급여에서 집계됩니다(근사 계산 아님).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#fcfcfd] text-[11px] uppercase tracking-[0.03em] text-company-fg-subtle">
                  <Th>직원</Th><Th right>지급총액</Th><Th right>소득세(국세)</Th><Th right>지방소득세(특별징수)</Th><Th>상태</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-[18px] py-4 text-company-fg-muted">급여를 먼저 확정하면 지방소득세 준비 데이터가 채워집니다.</td></tr>
                )}
                {rows.map((row) => <LocalIncomeTaxTr key={`${row.employeeCode ?? row.employeeName}-${row.employeeName}`} row={row} />)}
                {rows.length > 0 && (
                  <tr className="bg-[#fafafa] font-semibold">
                    <td className="border-t border-company-border px-[18px] py-2.5">합계(준비 완료 {hero.readyEmployees}명)</td>
                    <Num strong>{KRW.format(totals.grossPayKrw)}</Num>
                    <Num strong>{KRW.format(totals.incomeTaxKrw)}</Num>
                    <Num strong>{KRW.format(totals.localIncomeTaxKrw)}</Num>
                    <td className="border-t border-company-border px-[18px] py-2.5" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#ddd6fe] bg-[#f5f3ff] px-[18px] py-4 text-[12.5px] text-[#4c1d95]">
          <b className="text-[#2e1065]">원천세와 동일한 값</b> — 이 지방소득세 값은 원천세 준비값 확인에 표시되는 지방소득세와 같은 실제 급여 기록에서 옵니다. 두 화면에서 다른 숫자가 보이지 않습니다.
        </section>

        <section className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-[18px] py-4 text-[12.5px] text-[#1e3a8a]">
          <b className="text-[#172554]">책임 경계</b> — SemuAgent는 원천세에 딸린 지방소득세 특별징수 확정 데이터를 준비합니다. 종합소득세·법인세분 지방소득세, 위택스 신고·제출은 이 화면 범위 밖이며 사용자가 직접 수행합니다. 자동 제출·자격증명 저장은 하지 않습니다.
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

function Num({ children, muted, strong }: { children: React.ReactNode; muted?: boolean; strong?: boolean }) {
  const border = strong ? 'border-t' : 'border-b'
  return <td className={`whitespace-nowrap ${border} border-company-border px-[18px] py-2.5 text-right tabular-nums ${muted ? 'text-company-fg-subtle' : ''}`}>{children}</td>
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap border-b border-company-border px-[18px] py-2.5">{children}</td>
}

function LocalIncomeTaxTr({ row }: { row: LocalIncomeTaxRow }) {
  return (
    <tr>
      <EmployeeCell name={row.employeeName} code={row.employeeCode} />
      <Num muted={!row.includedInTotals}>{row.includedInTotals ? KRW.format(row.grossPayKrw) : '집계 대기'}</Num>
      <Num muted={!row.includedInTotals}>{row.includedInTotals ? KRW.format(row.incomeTaxKrw) : '—'}</Num>
      <Num muted={!row.includedInTotals}>{row.includedInTotals ? KRW.format(row.localIncomeTaxKrw) : '—'}</Num>
      <Cell><Chip tone={row.tone}>{row.statusLabel}</Chip></Cell>
    </tr>
  )
}
