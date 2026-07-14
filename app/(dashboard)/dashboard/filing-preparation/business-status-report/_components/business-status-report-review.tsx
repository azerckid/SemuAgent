import Link from 'next/link'
import type {
  BusinessStatusAmountRow,
  BusinessStatusHandoffRow,
  BusinessStatusReportSummary,
  BusinessStatusTone,
} from '@/lib/business-status-report/summary'
import { ActionBlockerList } from '../../_components/action-blocker-list'

const CHIP_TONE: Record<BusinessStatusTone, string> = {
  ok: 'text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]',
  warn: 'text-[#d97706] bg-[#fffbeb] border-[#fde68a]',
  danger: 'text-[#dc2626] bg-[#fef2f2] border-[#fecaca]',
  muted: 'text-company-fg-muted bg-[#f4f4f5] border-company-border',
}

const KRW = new Intl.NumberFormat('ko-KR')

function Chip({ tone, children }: { tone: BusinessStatusTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${CHIP_TONE[tone]}`}>
      {children}
    </span>
  )
}

export function BusinessStatusReportEmptyState({ tenantName }: { readonly tenantName: string }) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 연간신고 › 사업장현황신고</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">사업장현황신고</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[720px] rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card">
          <h2 className="text-sm font-semibold text-foreground">사업장을 먼저 등록해 주세요</h2>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">
            {tenantName}에 등록된 사업장이 있어야 사업장현황신고 준비 데이터를 집계할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export function BusinessStatusReportReview({ summary }: { readonly summary: BusinessStatusReportSummary }) {
  const { fiscalYear, eligibility, hero, blockers, revenueRows, expenseRows, handoffRows } = summary

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="flex items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-company-fg-subtle">
            회사 홈 › <Link href="/dashboard/filing-preparation" className="hover:underline">연간신고</Link> › 사업장현황신고
          </p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">사업장현황신고</h1>
        </div>
        <span className="ml-auto text-[13px] font-medium text-company-fg-muted">{summary.tenant.name}</span>
        <span className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium">
          사업자 유형 <span className="ml-1 rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-[10.5px] font-bold text-[#2563eb]">{eligibilityLabel(summary)}</span>
        </span>
        <span className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium">
          귀속연도 <span className="ml-1 rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-[10.5px] font-bold text-[#2563eb]">{fiscalYear}</span>
        </span>
      </div>

      <div className="flex w-full max-w-[1240px] flex-col gap-[22px] px-7 pt-6 pb-12">
        {eligibility.state !== 'applicable' && <EligibilityState summary={summary} />}

        <section className="grid gap-6 rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card lg:grid-cols-[1fr_300px]">
          <div>
            <p className="text-xs font-semibold text-company-fg-muted">면세 개인사업자 사업장현황신고 준비</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">부가세 대신 사업장현황신고에 넣을 수입금액과 자료 상태를 봅니다</h2>
            <p className="mt-2 max-w-[710px] text-[13px] text-company-fg-muted">
              자료수집과 기장검토에서 확정한 수입금액, 매입·경비 자료, 누락/미확정 항목을 귀속연도 기준으로 정리합니다. 홈택스 제출과 전자신고 파일 생성은 이 화면 범위 밖입니다.
            </p>
            <div className="mt-4 h-2 max-w-[520px] overflow-hidden rounded-full bg-company-border">
              <span className="block h-full bg-[#2563eb]" style={{ width: `${hero.preparationPercent}%` }} />
            </div>
          </div>
          <div className="grid gap-2">
            <HeroMetric label="적용 대상" value={eligibility.state === 'applicable' ? '면세 개인' : '해당 없음'} />
            <HeroMetric label="준비율" value={`${hero.preparationPercent}%`} />
            <HeroMetric label="확인 필요" value={`${hero.attentionCount}건`} />
          </div>
        </section>

        <section className="rounded-xl border border-[#ddd6fe] bg-[#f5f3ff] px-[18px] py-4 text-[12.5px] text-[#4c1d95]">
          <b className="text-[#2e1065]">대상 분기</b> — 이 화면은 사업자 유형이 <b>면세 개인</b>인 사업장만 사용합니다. 과세사업자와 법인은 사업장현황신고 대상이 아니며, 사업자 유형이 미지정이면 설정에서 먼저 확인합니다.
        </section>

        <ActionBlockerList items={blockers} />

        <section className="grid gap-4 lg:grid-cols-4">
          <SummaryCard label="수입금액" value={`${KRW.format(hero.revenueTotalKrw)}원`} />
          <SummaryCard label="매입·경비" value={`${KRW.format(hero.expenseTotalKrw)}원`} />
          <SummaryCard label="확인 필요" value={`${hero.attentionCount}건`} tone={hero.attentionCount > 0 ? 'warn' : 'ok'} />
          <SummaryCard label="귀속연도" value={`${fiscalYear}년`} />
        </section>

        <SectionHead title="수입금액 분류" hint="확정 기장 행의 수입 거래를 계정별로 집계합니다" />
        <AmountTable rows={revenueRows} emptyText="확정된 수입금액 기장 행이 없습니다." />

        <SectionHead title="매입·경비 자료" hint="확정 기장 행의 매입·경비 거래를 계정별로 집계합니다" />
        <AmountTable rows={expenseRows} emptyText="확정된 매입·경비 기장 행이 없습니다." />

        <SectionHead title="홈택스 입력 전 확인" hint="SemuAgent는 입력할 데이터를 준비하고, 제출은 사용자가 직접 수행합니다" />
        <HandoffTable rows={handoffRows} />

        <section className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-[18px] py-4 text-[12.5px] text-[#1e3a8a]">
          <b className="text-[#172554]">책임 경계</b> — SemuAgent는 사업장현황신고에 넣을 수입금액·자료 상태를 준비하고 누락을 보여줍니다. 홈택스 제출, 전자신고 파일 생성, 자동 제출, 세무대리 행위는 이 화면 범위 밖입니다.
        </section>
      </div>
    </div>
  )
}

function EligibilityState({ summary }: { summary: BusinessStatusReportSummary }) {
  const href = summary.eligibility.state === 'needs_business_type' ? '/dashboard/settings' : '/dashboard/filing-preparation'
  const cta = summary.eligibility.state === 'needs_business_type' ? '설정 열기' : '신고 준비로 돌아가기'
  const title = summary.eligibility.state === 'needs_business_type' ? '사업자 유형을 먼저 설정해 주세요' : '현재 사업자 유형은 사업장현황신고 대상이 아닙니다'
  const body = summary.eligibility.state === 'needs_business_type'
    ? '면세 개인사업자인지 확인해야 사업장현황신고 준비 화면을 사용할 수 있습니다.'
    : '과세 개인사업자와 법인은 부가세·법인세 등 해당하는 신고 항목을 사용합니다.'
  return (
    <section className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-[18px] py-4 text-[12.5px] text-[#92400e]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <b className="text-[#78350f]">{title}</b>
          <p className="mt-1">{body}</p>
        </div>
        <Link href={href} className="whitespace-nowrap rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-xs font-semibold text-foreground">
          {cta}
        </Link>
      </div>
    </section>
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

function SummaryCard({ label, value, tone = 'ok' }: { label: string; value: string; tone?: BusinessStatusTone }) {
  return (
    <div className="rounded-xl border border-company-border bg-company-surface p-[18px] shadow-company-card">
      <p className="text-xs text-company-fg-subtle">{label}</p>
      <p className="mt-2 text-xl font-bold tracking-tight tabular-nums">{value}</p>
      <div className="mt-2"><Chip tone={tone}>{tone === 'warn' ? '확인 필요' : '준비 상태'}</Chip></div>
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

function AmountTable({ rows, emptyText }: { rows: BusinessStatusAmountRow[]; emptyText: string }) {
  const total = rows.reduce((sum, row) => sum + row.amountKrw, 0)
  const sourceCount = rows.reduce((sum, row) => sum + row.sourceCount, 0)
  return (
    <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-[#fcfcfd] text-[11px] uppercase tracking-[0.03em] text-company-fg-subtle">
              <Th>분류</Th><Th right>금액</Th><Th right>자료</Th><Th>상태</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-[18px] py-4 text-company-fg-muted">{emptyText}</td></tr>}
            {rows.map((row) => (
              <tr key={row.id}>
                <Cell>{row.label}</Cell>
                <Num>{KRW.format(row.amountKrw)}</Num>
                <Num>{row.sourceCount}건</Num>
                <Cell><Chip tone={row.tone}>{row.statusLabel}</Chip></Cell>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-[#fafafa] font-semibold">
                <td className="border-t border-company-border px-[18px] py-2.5">합계</td>
                <Num strong>{KRW.format(total)}</Num>
                <Num strong>{sourceCount}건</Num>
                <td className="border-t border-company-border px-[18px] py-2.5" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function HandoffTable({ rows }: { rows: BusinessStatusHandoffRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-[#fcfcfd] text-[11px] uppercase tracking-[0.03em] text-company-fg-subtle">
              <Th>항목</Th><Th>값</Th><Th>상태</Th><Th>담당 화면</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.item}>
                <Cell>{row.item}</Cell>
                <Cell>{row.value}</Cell>
                <Cell><Chip tone={row.tone}>{row.statusLabel}</Chip></Cell>
                <Cell>{row.owner}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`whitespace-nowrap border-b border-company-border px-[18px] py-2.5 font-bold ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap border-b border-company-border px-[18px] py-2.5">{children}</td>
}

function Num({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  const border = strong ? 'border-t' : 'border-b'
  return <td className={`whitespace-nowrap ${border} border-company-border px-[18px] py-2.5 text-right tabular-nums`}>{children}</td>
}

function eligibilityLabel(summary: BusinessStatusReportSummary) {
  if (summary.eligibility.state === 'applicable') return '면세 개인'
  if (summary.eligibility.state === 'needs_business_type') return '미지정'
  return summary.businessEntity?.taxEntityType === 'corporation' ? '법인' : '개인'
}
