import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Loader2,
  ReceiptText,
  UploadCloud,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type {
  CompanyHomeActionItem,
  CompanyHomeRecentRow,
  CompanyHomeSummary,
  CompanyHomeTone,
  CompanyHomeWorkspaceCard,
} from '@/lib/company-home/summary'
import { cn } from '@/lib/utils'

const toneBadgeVariant: Record<CompanyHomeTone, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ok: 'success',
  warn: 'warning',
  danger: 'destructive',
  muted: 'secondary',
}

const toneDotClass: Record<Exclude<CompanyHomeTone, 'muted'>, string> = {
  danger: 'bg-red-600',
  warn: 'bg-amber-600',
  ok: 'bg-emerald-600',
}

const workspaceIcon: Record<CompanyHomeWorkspaceCard['id'], ComponentType<{ className?: string }>> = {
  source_collection: UploadCloud,
  bookkeeping: ClipboardCheck,
  vat: ReceiptText,
  payroll: FileSpreadsheet,
  filing_support: FileText,
  receipts: CheckCircle2,
}

const recentKindLabel: Record<CompanyHomeRecentRow['kind'], string> = {
  upload: '자료',
  bookkeeping: '기장',
  vat: '부가세',
  payroll: '급여',
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
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
      <CompanyHomeHeader summary={summary} />
      <PeriodHero summary={summary} />
      <ActionItemsSection items={summary.actionItems} />
      <WorkspaceCardsSection cards={summary.workspaceCards} />
      <RecentRowsSection rows={summary.recentRows} />
      <StateCoverageSection />
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
          <p className="text-center text-xs text-muted-foreground">
            이미 초대받은 회사가 있다면 초대 링크를 다시 열거나 관리자에게 멤버 추가 상태를 확인해 주세요.
          </p>
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
          <Badge variant="warning" className="w-fit">사업장 필요</Badge>
          <CardTitle className="text-lg">아직 등록된 사업장이 없습니다</CardTitle>
          <CardDescription>
            {tenantName}에서 자료수집과 신고 준비를 시작하려면 사업장 정보를 먼저 등록해야 합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/clients" className={buttonVariants()}>
            사업장 등록으로 이동
            <ArrowRight className="size-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function CompanyHomeHeader({ summary }: CompanyHomeViewProps) {
  const currentYear = Number(summary.period.key.slice(0, 4))
  const currentHalf = summary.period.key.endsWith('H2') ? 'H2' : 'H1'
  const periodLinks = [
    { key: `${currentYear}-H1`, label: `${currentYear}년 1기` },
    { key: `${currentYear}-H2`, label: `${currentYear}년 2기` },
  ]

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">회사 홈</h1>
          <Badge variant="info">읽기 전용</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {summary.businessEntity?.name}의 신고 준비 상태와 다음 할 일을 한 화면에서 확인합니다.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {periodLinks.map((period) => (
          <Link
            key={period.key}
            href={`/dashboard?period=${period.key}`}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              summary.period.key === period.key || (summary.period.key.endsWith(currentHalf) && period.key.endsWith(currentHalf))
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {period.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function PeriodHero({ summary }: CompanyHomeViewProps) {
  const dDayLabel = summary.period.dDay >= 0 ? `D-${summary.period.dDay}` : `D+${Math.abs(summary.period.dDay)}`

  return (
    <Card className="border-border bg-card">
      <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">현재 회계기간</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{summary.period.label}</h2>
            <Badge variant={summary.period.dDay <= 7 ? 'destructive' : 'warning'}>
              진행 중
            </Badge>
          </div>
          <div className="mt-4 h-2 max-w-xl overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${summary.period.progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            전체 기간 진행 {summary.period.progressPercent}% · {summary.period.startMonth}~{summary.period.endMonth} · 부가세/신고지원은 선행 검토 후 확정
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-5 py-4 text-left md:text-right">
          <p className="text-xs font-semibold text-muted-foreground">신고 마감</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{summary.period.filingDeadline}</p>
          <Badge variant={summary.period.dDay <= 7 ? 'destructive' : 'warning'} className="mt-2">
            {dDayLabel}
          </Badge>
        </div>
      </CardContent>
    </Card>
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
        description="신고 전 해결해야 할 항목"
      />
      <Card>
        <CardContent className="grid gap-0 p-0">
          {items.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex items-center gap-4 px-4 py-4 text-sm transition-colors hover:bg-muted/40',
                index > 0 && 'border-t',
              )}
            >
              <span className={cn('size-2 rounded-full', toneDotClass[item.tone])} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{item.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
              </span>
              <span className={cn(buttonVariants({ variant: item.tone === 'danger' ? 'default' : 'outline', size: 'sm' }), 'shrink-0')}>
                열기
                <ArrowRight className="size-3" />
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
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
        description="워크스페이스별 상태"
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = workspaceIcon[card.id]

          return (
            <Link key={card.id} href={card.href} className="block">
              <Card id={card.id === 'vat' ? 'vat-status' : card.id === 'filing_support' ? 'filing-support-status' : undefined} className="h-full transition-colors hover:border-primary/40 hover:bg-muted/20">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground">
                        <Icon className="size-4" />
                      </div>
                      <CardDescription className="truncate font-medium">{card.title}</CardDescription>
                    </div>
                    <Badge variant={toneBadgeVariant[card.tone]}>{card.statusLabel}</Badge>
                  </div>
                  <CardTitle className="text-2xl font-semibold tracking-tight">{card.value}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
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
        title="최근 제출·영수증"
        description="파일명·저장소 키 같은 민감 정보는 표시하지 않습니다"
      />
      <Card>
        <CardContent className="p-0">
          {rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>구분</TableHead>
                  <TableHead>항목</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell><Badge variant="secondary">{recentKindLabel[row.kind]}</Badge></TableCell>
                    <TableCell>
                      <Link href={row.href} className="font-medium text-foreground hover:underline">
                        {row.title}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.periodLabel}</TableCell>
                    <TableCell>{row.statusLabel}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.occurredAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid place-items-center p-8 text-center">
              <div>
                <CheckCircle2 className="mx-auto size-8 text-muted-foreground/60" />
                <p className="mt-3 font-medium text-foreground">최근 이력이 없습니다</p>
                <p className="mt-1 text-sm text-muted-foreground">자료 업로드나 급여 초안이 생성되면 이곳에 안전한 제목으로 표시됩니다.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function StateCoverageSection() {
  return (
    <section className="grid gap-3" aria-labelledby="company-home-states">
      <SectionHeader
        id="company-home-states"
        title="화면 상태"
        description="로딩·빈 상태·오류 상태 커버리지"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <StateCard
          label="Loading"
          icon={Loader2}
          title="현황을 불러오는 중"
          description="카드와 표는 스켈레톤으로 먼저 표시됩니다."
        />
        <StateCard
          label="Empty"
          icon={CheckCircle2}
          title="아직 자료가 없습니다"
          description="사업장과 기간별 빈 상태를 분리해 안내합니다."
        />
        <StateCard
          label="Error"
          icon={AlertCircle}
          title="현황을 불러오지 못했습니다"
          description="일시적 오류는 다시 시도로 복구할 수 있습니다."
        />
      </div>
    </section>
  )
}

interface SectionHeaderProps {
  readonly id: string
  readonly title: string
  readonly description: string
}

function SectionHeader({ id, title, description }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <h2 id={id} className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

interface StateCardProps {
  readonly label: string
  readonly icon: ComponentType<{ className?: string }>
  readonly title: string
  readonly description: string
}

function StateCard({ label, icon: Icon, title, description }: StateCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1 text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
