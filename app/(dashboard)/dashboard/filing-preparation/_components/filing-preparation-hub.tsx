import Link from 'next/link'
import {
  businessTypeLabel,
  type FilingPrepFoundationCard,
  type FilingPrepSummary,
  type FilingPrepTone,
  type FilingPrepTrackCard,
} from '@/lib/filing-preparation/summary'
import { ActionBlockerList } from './action-blocker-list'
import { PeriodContextControl, type PeriodContext } from './period-context-control'

const CHIP_TONE: Record<FilingPrepTone, string> = {
  ok: 'text-[#16a34a] bg-[#f0fdf4] border-[#bbf7d0]',
  warn: 'text-[#d97706] bg-[#fffbeb] border-[#fde68a]',
  danger: 'text-[#dc2626] bg-[#fef2f2] border-[#fecaca]',
  plan: 'text-[#7c3aed] bg-[#f5f3ff] border-[#ddd6fe]',
  muted: 'text-company-fg-muted bg-[#f4f4f5] border-company-border',
}

function Chip({ tone, children }: { tone: FilingPrepTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${CHIP_TONE[tone]}`}>
      {children}
    </span>
  )
}

export function FilingPreparationBusinessEntityEmptyState({ tenantName }: { readonly tenantName: string }) {
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="border-b border-company-border bg-company-surface px-7 py-3.5">
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 연간신고</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">연간신고</h1>
      </div>
      <div className="px-7 pt-6">
        <div className="max-w-[720px] rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card">
          <h2 className="text-sm font-semibold text-foreground">사업장을 먼저 등록해 주세요</h2>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">
            {tenantName}에 등록된 사업장이 있어야 신고 준비 현황을 집계할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export function FilingPreparationHub({
  summary,
  periodContext,
}: {
  readonly summary: FilingPrepSummary
  readonly periodContext: PeriodContext
}) {
  const { hero, blockers, foundation, tracks, businessEntity } = summary
  const typeLabel = businessEntity ? businessTypeLabel(businessEntity.businessType) : '미지정'
  const blockerItems = blockers.map(({ domain, ...blocker }) => ({ id: domain, ...blocker }))

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="flex flex-wrap items-center gap-3 border-b border-company-border bg-company-surface px-4 py-3.5 sm:px-7">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 연간신고</p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">연간신고</h1>
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span className="hidden text-[13px] font-medium text-company-fg-muted md:inline">{summary.tenant.name}</span>
          <span className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium">
            사업자 유형 <span className="ml-1 rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-[10.5px] font-bold text-[#2563eb]">{typeLabel}</span>
          </span>
          <PeriodContextControl context={periodContext} />
        </div>
      </div>

      <div className="flex w-full max-w-[1240px] flex-col gap-[22px] px-7 pt-6 pb-12">
        {/* Hero */}
        <section className="grid gap-6 rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card lg:grid-cols-[1fr_300px]">
          <div>
            <p className="text-xs font-semibold text-company-fg-muted">신고 준비 현황</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">홈택스·위택스에 넣을 확정 데이터가 준비되고 있는지 봅니다</h2>
            <p className="mt-2 max-w-[650px] text-[13px] text-company-fg-muted">
              자료수집과 자료대조원장을 기준으로 원천세·부가세·지급명세서·연말정산·지방소득세의 준비 상태를 한 화면에서 확인합니다.
            </p>
            <div className="mt-4 h-2 max-w-[520px] overflow-hidden rounded-full bg-company-border">
              <span className="block h-full bg-[#2563eb]" style={{ width: `${hero.readinessPercent}%` }} />
            </div>
          </div>
          <div className="grid gap-2">
            <HeroMetric label="전체 준비율" value={`${hero.readinessPercent}%`} />
            <HeroMetric label="확인 필요" value={`${hero.attentionCount}건`} />
            <HeroMetric label="신고값 준비" value={`${hero.handoffReadyCount}개 준비`} />
          </div>
        </section>

        <ActionBlockerList items={blockerItems} />

        {/* 공통 기반 */}
        <SectionHead title="공통 기반" hint="모든 신고에 함께 쓰는 자료 준비 단계" />
        <section className="grid gap-4 lg:grid-cols-2">
          {foundation.map((card) => (
            <FoundationCard key={card.id} card={card} />
          ))}
        </section>

        {/* 신고 항목별 준비 */}
        <SectionHead title="신고 항목별 준비" hint="각 신고에 필요한 자료와 준비된 값을 확인합니다" />
        <section className="grid gap-4 lg:grid-cols-2">
          {tracks.map((track) => (
            <TrackCard key={track.id} track={track} />
          ))}
        </section>

        {/* 책임 경계 */}
        <section className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-[18px] py-4 text-[12.5px] text-[#1e3a8a]">
          <b className="text-[#172554]">책임 경계</b> — SemuAgent는 신고서에 넣을 확정 데이터와 제출 보조 자료를 준비합니다. 최종 제출·납부는 사용자가 홈택스·위택스에서 직접 진행하며, SemuAgent는 자동 제출하거나 자격증명을 저장하지 않습니다.
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

function FoundationCard({ card }: { card: FilingPrepFoundationCard }) {
  return (
    <article className="rounded-xl border border-company-border bg-company-surface p-[18px] shadow-company-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">{card.title}</h3>
          <p className="mt-1 text-[12.5px] text-company-fg-muted">{card.description}</p>
        </div>
        <Chip tone={card.chipTone}>{card.chipLabel}</Chip>
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-3 rounded-[10px] border border-company-border bg-[#fafafa] px-3 py-2.5">
        <p className="text-[12.5px]">{card.output}</p>
        <Link
          href={card.href}
          className="whitespace-nowrap rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-xs font-semibold"
        >
          열기
        </Link>
      </div>
    </article>
  )
}

function TrackCard({ track }: { track: FilingPrepTrackCard }) {
  return (
    <article className={`flex flex-col gap-3.5 rounded-xl border border-company-border bg-company-surface p-[18px] shadow-company-card ${track.applicable ? '' : 'opacity-55'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">{track.title}</h3>
          <p className="mt-0.5 text-[11.5px] text-company-fg-muted">{track.cycle}</p>
        </div>
        <Chip tone={track.chipTone}>{track.chipLabel}</Chip>
      </div>
      {track.applicable ? (
        <div className="grid gap-2">
          <ContractLine k="입력" v={track.input} />
          <ContractLine k="산출" v={track.output} />
        </div>
      ) : (
        <p className="rounded-[9px] border border-company-border bg-[#fcfcfd] px-2.5 py-2 text-[12px] text-company-fg-muted">
          {track.inapplicableReason}
        </p>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-company-border pt-3">
        <span className="text-xs text-company-fg-muted">{track.handoffLabel}</span>
        {!track.applicable
          ? <Chip tone="muted">해당 없음</Chip>
          : track.href
            ? (
                <Link href={track.href} className="whitespace-nowrap rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-xs font-semibold">
                  열기
                </Link>
              )
            : <Chip tone="muted">{track.status === 'roadmap' ? '준비 중' : '예정'}</Chip>}
      </div>
    </article>
  )
}

function ContractLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[9px] border border-company-border bg-[#fcfcfd] px-2.5 py-2">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-company-fg-subtle">{k}</p>
      <p className="mt-0.5 text-[12.5px]">{v}</p>
    </div>
  )
}
