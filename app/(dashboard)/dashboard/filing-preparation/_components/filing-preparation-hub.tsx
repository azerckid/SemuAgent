import Link from 'next/link'
import {
  businessTypeLabel,
  type FilingPrepFoundationCard,
  type FilingPrepSummary,
  type FilingPrepTone,
  type FilingPrepTrackCard,
} from '@/lib/filing-preparation/summary'

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
        <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 신고 준비</p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">신고 준비</h1>
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

export function FilingPreparationHub({ summary }: { readonly summary: FilingPrepSummary }) {
  const { period, hero, blockers, foundation, tracks, schedule, businessEntity } = summary
  const typeLabel = businessEntity ? businessTypeLabel(businessEntity.businessType) : '미지정'

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <div className="flex items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-company-fg-subtle">회사 홈 › 신고 준비</p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">신고 준비</h1>
        </div>
        <span className="ml-auto text-[13px] font-medium text-company-fg-muted">{summary.tenant.name}</span>
        <span className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium">
          사업자 유형 <span className="ml-1 rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-[10.5px] font-bold text-[#2563eb]">{typeLabel}</span>
        </span>
        <span className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium">
          기준 기간 <span className="ml-1 rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-[10.5px] font-bold text-[#2563eb]">{period.label}</span>
        </span>
      </div>

      <div className="flex w-full max-w-[1240px] flex-col gap-[22px] px-7 pt-6 pb-12">
        {/* Hero */}
        <section className="grid gap-6 rounded-xl border border-company-border bg-company-surface p-6 shadow-company-card lg:grid-cols-[1fr_300px]">
          <div>
            <p className="text-xs font-semibold text-company-fg-muted">신고 데이터 준비 파이프라인</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">홈택스·위택스에 넣을 확정 데이터가 준비되고 있는지 봅니다</h2>
            <p className="mt-2 max-w-[650px] text-[13px] text-company-fg-muted">
              자료수집과 기장검토를 공통 기반으로 두고, 원천세·부가세·지급명세서/연말정산·지방소득세 트랙의 입력, 산출, handoff 상태를 한 화면에서 확인합니다.
            </p>
            <div className="mt-4 h-2 max-w-[520px] overflow-hidden rounded-full bg-company-border">
              <span className="block h-full bg-[#2563eb]" style={{ width: `${hero.readinessPercent}%` }} />
            </div>
          </div>
          <div className="grid gap-2">
            <HeroMetric label="전체 준비율" value={`${hero.readinessPercent}%`} />
            <HeroMetric label="확인 필요" value={`${hero.attentionCount}건`} />
            <HeroMetric label="신고지원 handoff" value={`${hero.handoffReadyCount}개 준비`} />
          </div>
        </section>

        {/* 다음 할 일 (blockers) */}
        {blockers.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
            {blockers.map((blocker) => (
              <div key={blocker.domain} className="grid grid-cols-[12px_1fr_auto] items-center gap-3.5 border-b border-company-border px-[18px] py-3.5 last:border-b-0">
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

        {/* 공통 기반 */}
        <SectionHead title="공통 기반" hint="모든 신고 트랙의 소스가 되는 준비 단계" />
        <section className="grid gap-4 lg:grid-cols-2">
          {foundation.map((card) => (
            <FoundationCard key={card.id} card={card} />
          ))}
        </section>

        {/* 병렬 신고 트랙 */}
        <SectionHead title="병렬 신고 트랙" hint="각 트랙은 입력 → 산출 → 신고지원 handoff로 읽습니다" />
        <section className="grid gap-4 lg:grid-cols-2">
          {tracks.map((track) => (
            <TrackCard key={track.id} track={track} />
          ))}
        </section>

        {/* 다가오는 세무 일정 (보조) */}
        <SectionHead title="다가오는 세무 일정" hint="일정은 신고 준비 안의 보조 정보입니다" />
        <section className="overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card">
          {schedule.length === 0 && (
            <p className="px-[18px] py-4 text-[12.5px] text-company-fg-muted">다가오는 세무 일정이 없습니다.</p>
          )}
          {schedule.map((item) => (
            <div key={item.id} className="grid grid-cols-[64px_1fr] items-center gap-3.5 border-b border-company-border px-[18px] py-3 last:border-b-0">
              <div className="text-center">
                <p className={`text-[15px] font-extrabold ${item.soon ? 'text-[#dc2626]' : ''}`}>D-{item.dDay}</p>
                <p className="text-[10px] text-company-fg-subtle">{item.dateLabel}</p>
              </div>
              <div>
                <p className="text-[13.5px] font-semibold">{item.title}</p>
                <p className="mt-0.5 text-[11.5px] text-company-fg-subtle">신고 준비 완료 후 홈택스·위택스에서 직접 신고합니다.</p>
              </div>
            </div>
          ))}
        </section>

        {/* 책임 경계 */}
        <section className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-[18px] py-4 text-[12.5px] text-[#1e3a8a]">
          <b className="text-[#172554]">책임 경계</b> — SemuAgent는 신고서에 넣을 확정 데이터와 제출 보조 자료를 준비합니다. 최종 제출·납부는 사용자가 홈택스·위택스에서 직접 수행합니다. 자동 제출은 JC-023의 별도 법무·보안·사용자 승인 게이트 없이는 도입하지 않습니다.
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
      <p className="mt-3.5 rounded-[10px] border border-company-border bg-[#fafafa] px-3 py-2.5 text-[12.5px]">{card.output}</p>
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
