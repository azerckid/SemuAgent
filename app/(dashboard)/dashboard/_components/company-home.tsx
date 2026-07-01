import Link from 'next/link'
import { Building2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  CompanyHomeActionItem,
  CompanyHomeRecentRow,
  CompanyHomeSummary,
  CompanyHomeTone,
  CompanyHomeWorkspaceCard,
} from '@/lib/company-home/summary'
import { cn } from '@/lib/utils'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'

const toneDotClass: Record<Exclude<CompanyHomeTone, 'muted'>, string> = {
  danger: 'bg-[#dc2626]',
  warn: 'bg-[#d97706]',
  ok: 'bg-[#16a34a]',
}

const chipClass: Record<CompanyHomeTone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
}

const iconToneClass: Record<CompanyHomeWorkspaceCard['iconTone'], string> = {
  amber: 'bg-[#fffbeb] text-[#d97706]',
  blue: 'bg-[#eff6ff] text-[#2563eb]',
  green: 'bg-[#f0fdf4] text-[#16a34a]',
}

const recentKindLabel: Record<CompanyHomeRecentRow['kind'], string> = {
  upload: '자료',
  bookkeeping: '기장',
  vat: '부가세',
  payroll: '원천세',
  filing_receipt: '접수증',
}

interface CompanyHomeViewProps {
  readonly summary: CompanyHomeSummary
}

export function CompanyHomeView({ summary }: CompanyHomeViewProps) {
  if (!summary.businessEntity) {
    return <BusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  return (
    <div className="flex min-h-full flex-col">
      <CompanyHomeTopbar summary={summary} />
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        <PeriodHero summary={summary} />
        <ActionItemsSection items={summary.actionItems} />
        <WorkspaceCardsSection cards={summary.workspaceCards} />
        <RecentRowsSection rows={summary.recentRows} />
        <StateCoverageSection />
        <PreviewNote />
      </div>
    </div>
  )
}

interface NoTenantCompanyStateProps {
  readonly userName?: string | null
}

export function NoTenantCompanyState({ userName }: NoTenantCompanyStateProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <Building2 className="size-6" />
          </div>
          <CardTitle className="text-lg">회사 워크스페이스가 없습니다</CardTitle>
          <CardDescription>
            {userName ? `${userName}님이 사용할 회사 공간을 먼저 만들거나 초대를 수락해 주세요.` : '사용할 회사 공간을 먼저 만들거나 초대를 수락해 주세요.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="font-medium text-foreground">처음 시작하시나요?</p>
            <p className="mt-1 text-muted-foreground">회사 정보를 등록하면 자료수집·기장검토·세무 일정 관리를 시작할 수 있습니다.</p>
            <Link href="/onboarding" className={cn(buttonVariants(), 'mt-4 w-full')}>
              회사 워크스페이스 만들기
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface BusinessEntityEmptyStateProps {
  readonly tenantName: string
}

function BusinessEntityEmptyState({ tenantName }: BusinessEntityEmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">아직 등록된 사업장이 없습니다</CardTitle>
          <CardDescription>
            {tenantName}에서 자료수집과 신고 준비를 시작하려면 사업장 정보를 먼저 등록해야 합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/clients" className={buttonVariants()}>
            사업장 등록으로 이동
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function CompanyHomeTopbar({ summary }: CompanyHomeViewProps) {
  const companyName = summary.businessEntity?.name ?? summary.tenant.name
  const currentYear = Number(summary.period.key.slice(0, 4))
  const periodLabel = summary.period.key.endsWith('H2')
    ? `${currentYear}년 부가세 2기 (7~12월)`
    : `${currentYear}년 부가세 1기 (1~6월)`

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
      <h1 className="text-base font-semibold tracking-tight text-foreground">회사 홈</h1>
      <span className="text-[13px] font-medium text-company-fg-muted">{companyName}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground">
          {periodLabel}
          <span className="text-[11px] text-company-fg-subtle">▾</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground">
          확정 신고
          <span className="text-[11px] text-company-fg-subtle">▾</span>
        </span>
      </div>
    </div>
  )
}

function PeriodHero({ summary }: CompanyHomeViewProps) {
  const dDayLabel = summary.period.dDay >= 0 ? `D-${summary.period.dDay}` : `D+${Math.abs(summary.period.dDay)}`

  return (
    <div className="grid items-center gap-5 rounded-xl border border-company-border bg-company-surface px-6 py-[22px] shadow-company-card md:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <p className="text-xs font-semibold text-company-fg-muted">현재 회계기간</p>
        <div className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-foreground">
          {summary.period.label}
          <span className="ml-2 inline-flex items-center rounded-full border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 align-middle text-xs font-semibold text-[#d97706]">
            진행 중
          </span>
        </div>
        <div className="mt-3 h-2 max-w-[460px] overflow-hidden rounded-full bg-[#ececee]">
          <div
            className="h-full rounded-full bg-[#2563eb]"
            style={{ width: `${summary.heroMeta.readinessPercent}%` }}
          />
        </div>
        <p className="mt-2 text-[12.5px] text-company-fg-muted">{summary.heroMeta.metaLine}</p>
      </div>
      <div className="text-left md:text-right">
        <p className="text-xs font-semibold text-company-fg-muted">신고 마감</p>
        <p className="mt-1 text-xl font-bold tracking-[-0.01em] text-foreground">{summary.period.filingDeadline}</p>
        <span className="mt-1.5 inline-flex rounded-full border border-[#fecaca] bg-[#fef2f2] px-2.5 py-0.5 text-xs font-semibold text-[#dc2626]">
          {dDayLabel}
        </span>
      </div>
    </div>
  )
}

interface ActionItemsSectionProps {
  readonly items: CompanyHomeActionItem[]
}

function ActionItemsSection({ items }: ActionItemsSectionProps) {
  return (
    <section className="grid gap-3" aria-labelledby="company-home-actions">
      <SectionHeader
        id="company-home-actions"
        title="다음 할 일"
        hint="신고 전 해결해야 할 항목"
      />
      <div className={panelClass}>
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-3.5 px-[18px] py-3.5',
              index > 0 && 'border-t border-company-border',
            )}
          >
            <span className={cn('size-2 shrink-0 rounded-full', toneDotClass[item.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-foreground">{item.title}</p>
              <p className="mt-0.5 text-[12.5px] text-company-fg-muted">{item.description}</p>
            </div>
            <Link
              href={item.href}
              className={cn(
                'shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors',
                item.tone === 'danger'
                  ? 'border-[#18181b] bg-[#18181b] text-white hover:bg-[#18181b]/90'
                  : 'border-company-border-strong bg-company-surface text-foreground hover:bg-company-nav-hover',
              )}
            >
              {item.ctaLabel}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

interface WorkspaceCardsSectionProps {
  readonly cards: CompanyHomeWorkspaceCard[]
}

function WorkspaceCardsSection({ cards }: WorkspaceCardsSectionProps) {
  return (
    <section className="grid gap-3" aria-labelledby="company-home-workspaces">
      <SectionHeader
        id="company-home-workspaces"
        title="준비 현황"
        hint="워크스페이스별 상태"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            id={card.id === 'vat' ? 'vat-status' : card.id === 'filing_support' ? 'filing-support-status' : undefined}
            className="flex min-h-[148px] flex-col gap-3 rounded-xl border border-company-border bg-company-surface p-[18px] shadow-company-card transition-colors hover:border-company-border-strong"
          >
            <div className="flex items-center gap-2.5">
              <div className={cn('flex size-[30px] items-center justify-center rounded-lg text-[15px]', iconToneClass[card.iconTone])}>
                {card.iconGlyph}
              </div>
              <p className="text-[13px] font-semibold text-company-fg-muted">{card.title}</p>
            </div>
            <p className="text-[26px] font-bold tracking-tight text-foreground">
              {card.valueMain}
              {card.valueSuffix && (
                <span className="ml-0.5 text-sm font-semibold text-company-fg-subtle">{card.valueSuffix}</span>
              )}
            </p>
            <div className="mt-auto flex items-center gap-2">
              <PreviewChip tone={card.footChip.tone}>{card.footChip.label}</PreviewChip>
              <span className="text-xs text-company-fg-subtle">{card.footSub}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

interface RecentRowsSectionProps {
  readonly rows: CompanyHomeRecentRow[]
}

function RecentRowsSection({ rows }: RecentRowsSectionProps) {
  return (
    <section id="recent-activity" className="grid gap-3" aria-labelledby="company-home-recent">
      <SectionHeader
        id="company-home-recent"
        title="최근 제출 · 영수증"
        action={(
          <Link href="#recent-activity" className="text-[12.5px] font-semibold text-[#2563eb] hover:underline">
            전체 보기 →
          </Link>
        )}
      />
      <div className={panelClass}>
        {rows.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-company-border bg-[#fafafa]">
                {['구분', '항목', '기간', '상태', '일시'].map((head) => (
                  <th
                    key={head}
                    className="px-[18px] py-[11px] text-left text-[11.5px] font-semibold tracking-[0.03em] text-company-fg-subtle uppercase"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-company-border last:border-b-0 hover:bg-[#fafafa]">
                  <td className="px-[18px] py-[13px] text-[13px]">
                    <PreviewChip tone="muted">{recentKindLabel[row.kind]}</PreviewChip>
                  </td>
                  <td className="px-[18px] py-[13px] text-[13px] font-semibold text-foreground">
                    <Link href={row.href} className="hover:underline">{row.title}</Link>
                  </td>
                  <td className="px-[18px] py-[13px] font-mono text-[13px] text-company-fg-muted tabular-nums">{row.periodLabel}</td>
                  <td className="px-[18px] py-[13px] text-[13px]">
                    <PreviewChip tone={row.statusTone}>{row.statusLabel}</PreviewChip>
                  </td>
                  <td className="px-[18px] py-[13px] font-mono text-[13px] text-company-fg-muted tabular-nums">{row.occurredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="grid place-items-center px-[18px] py-12 text-center">
            <p className="text-[22px] text-company-fg-subtle/50">＋</p>
            <p className="mt-1.5 text-[12.5px] text-company-fg-subtle">아직 수집된 자료가 없습니다</p>
            <Link href="/dashboard/direct-upload" className="mt-2.5 text-xs font-semibold text-[#2563eb] hover:underline">
              첫 자료 업로드하기
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

function StateCoverageSection() {
  return (
    <section className="grid gap-3" aria-labelledby="company-home-states">
      <SectionHeader
        id="company-home-states"
        title="화면 상태 예시"
        hint="로딩 / 빈 상태 / 오류 — 카드 컴포넌트 상태 커버리지"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex min-h-[132px] flex-col rounded-xl border border-dashed border-company-border-strong bg-company-surface p-[18px]">
          <p className="mb-3 text-[11px] font-bold tracking-[0.04em] text-company-fg-subtle uppercase">Loading</p>
          <div className="h-3 w-[40%] rounded-md bg-linear-to-r from-[#eee] via-[#f5f5f5] to-[#eee]" />
          <div className="mt-2.5 h-3 w-[80%] rounded-md bg-linear-to-r from-[#eee] via-[#f5f5f5] to-[#eee]" />
          <div className="mt-2.5 h-3 w-[60%] rounded-md bg-linear-to-r from-[#eee] via-[#f5f5f5] to-[#eee]" />
        </div>
        <div className="flex min-h-[132px] flex-col rounded-xl border border-dashed border-company-border-strong bg-company-surface p-[18px]">
          <p className="mb-3 text-[11px] font-bold tracking-[0.04em] text-company-fg-subtle uppercase">Empty</p>
          <div className="flex flex-1 items-center justify-center text-center text-company-fg-subtle">
            <div>
              <p className="text-[22px] opacity-50">＋</p>
              <p className="mt-1.5 text-[12.5px]">아직 수집된 자료가 없습니다</p>
              <p className="mt-2.5 text-xs font-semibold text-[#2563eb]">첫 자료 업로드하기</p>
            </div>
          </div>
        </div>
        <div className="flex min-h-[132px] flex-col rounded-xl border border-dashed border-company-border-strong bg-company-surface p-[18px]">
          <p className="mb-3 text-[11px] font-bold tracking-[0.04em] text-company-fg-subtle uppercase">Error</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[13px] font-semibold text-[#dc2626]">현황을 불러오지 못했습니다</p>
            <p className="mt-1 text-xs text-company-fg-muted">일시적 오류입니다. 잠시 후 다시 시도해 주세요.</p>
            <button type="button" className="mt-2.5 w-fit rounded-lg border border-company-border-strong px-2.5 py-1 text-xs font-semibold">
              다시 시도
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function PreviewNote() {
  return (
    <div className="rounded-[10px] border border-company-border bg-[#fafafa] px-3.5 py-3 text-xs text-company-fg-subtle">
      <span className="font-semibold text-company-fg-muted">Preview 안내</span>
      {' '}
      — 이 화면은 회사 홈(대시보드) UI입니다. 표시 데이터는 선택한 회계기간과 실제 업로드·검토 결과를 반영합니다.
    </div>
  )
}

interface SectionHeaderProps {
  readonly id: string
  readonly title: string
  readonly hint?: string
  readonly action?: ReactNode
}

function SectionHeader({ id, title, hint, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-2.5">
      <h2 id={id} className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      {hint && <span className="text-xs text-company-fg-subtle">{hint}</span>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

interface PreviewChipProps {
  readonly tone: CompanyHomeTone
  readonly children: ReactNode
}

function PreviewChip({ tone, children }: PreviewChipProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11.5px] font-semibold', chipClass[tone])}>
      {children}
    </span>
  )
}
