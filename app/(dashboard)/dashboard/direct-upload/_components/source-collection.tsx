import Link from 'next/link'
import {
  Building2,
  CreditCard,
  FileText,
  Landmark,
  ReceiptText,
  RefreshCw,
  UploadCloud,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CompanyHomePeriod } from '@/lib/company-home/summary'
import {
  sourceCollectionSourceTypeLabel,
  type SourceCollectionCompleteness,
  type SourceCollectionImportRow,
  type SourceCollectionMissingItem,
  type SourceCollectionSourceTypeTile,
  type SourceCollectionSummary,
  type SourceCollectionTone,
} from '@/lib/source-collection/summary'
import { cn } from '@/lib/utils'
import { SourceCollectionUploadDropzone } from './source-collection-upload'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'

const toneChipClass: Record<SourceCollectionTone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
  info: 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
}

const fileStatusChipClass: Record<string, string> = {
  matched: toneChipClass.ok,
  needs_review: toneChipClass.warn,
  analyzing: toneChipClass.info,
  uploaded: toneChipClass.muted,
  failed: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  rejected: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
}

const sourceTypeIcon: Record<SourceCollectionSourceTypeTile['id'], ComponentType<{ className?: string }>> = {
  tax_invoice: FileText,
  bank_statement: Landmark,
  card_purchase: CreditCard,
  receipt_other: ReceiptText,
}

function formatPeriodEyebrow(period: CompanyHomePeriod) {
  if (period.key.endsWith('H1')) return `${period.key.slice(0, 4)}년 1기`
  if (period.key.endsWith('H2')) return `${period.key.slice(0, 4)}년 2기`
  return period.label
}

function formatPeriodPillLabel(period: CompanyHomePeriod) {
  const year = period.key.slice(0, 4)
  if (period.key.endsWith('H2')) return `${year}년 부가세 2기 (7~12월)`
  if (period.key.endsWith('H1')) return `${year}년 부가세 1기 (1~6월)`
  return period.label
}

function formatUploadDate(isoDate: string) {
  const [, month, day] = isoDate.split('-')
  if (!month || !day) return isoDate
  return `${month}-${day}`
}

function PreviewChip({ className, children }: { readonly className?: string; readonly children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11.5px] font-semibold', className)}>
      {children}
    </span>
  )
}

interface SectionHeaderProps {
  readonly id?: string
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
}

function SectionHeader({ id, title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-2.5">
      <h2 id={id} className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-xs text-company-fg-subtle">{description}</p>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

type UploadSessionProps = {
  readonly id: string
  readonly rawToken: string | null
  readonly status: string
}

type UploadedFileProps = {
  readonly id: string
  readonly originalFilename: string
  readonly fileSize: number
  readonly status: string
  readonly passwordStatus?: string | null
}

export interface SourceCollectionViewProps {
  readonly summary: SourceCollectionSummary
  readonly uploadSession: UploadSessionProps | null
  readonly uploadedFiles: UploadedFileProps[]
  readonly focusFileId?: string | null
  readonly retryAction?: boolean
}

export function SourceCollectionView({
  summary,
  uploadSession,
  uploadedFiles,
  focusFileId,
  retryAction,
}: SourceCollectionViewProps) {
  const accountingPeriod = `${summary.period.startMonth}~${summary.period.endMonth}`

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <SourceCollectionTopbar summary={summary} />
      <div className="flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        <CompletenessHeader completeness={summary.completeness} period={summary.period} />
        <SourceCollectionUploadDropzone
          businessEntityId={summary.businessEntity!.id}
          periodKey={summary.period.key}
          periodLabel={summary.period.label}
          accountingPeriod={accountingPeriod}
          session={uploadSession}
          uploadedFiles={uploadedFiles}
          focusFileId={focusFileId}
          retryAction={retryAction}
        />
        <SourceTypeTilesSection tiles={summary.sourceTypeTiles} />
        <ImportStatusTableSection rows={summary.importRows} focusFileId={focusFileId} />
        <MissingChecklistSection items={summary.missingItems} />
      </div>
    </div>
  )
}

function SourceCollectionTopbar({ summary }: { readonly summary: SourceCollectionSummary }) {
  const companyName = summary.businessEntity?.name ?? summary.tenant.name

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
      <div>
        <p className="text-[12.5px] font-medium text-company-fg-subtle">
          <Link href="/dashboard" className="hover:text-company-fg-muted hover:underline">회사 홈</Link>
          <span aria-hidden="true"> › </span>
          <span>자료수집</span>
        </p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">자료수집</h1>
      </div>
      <span className="text-[13px] font-medium text-company-fg-muted">{companyName}</span>
      <div className="ml-auto">
        <Link
          href={`/dashboard/direct-upload?period=${summary.period.key}`}
          className="inline-flex items-center gap-2 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground"
        >
          {formatPeriodPillLabel(summary.period)}
          <span className="text-[11px] text-company-fg-subtle">▾</span>
        </Link>
      </div>
    </div>
  )
}

interface CompletenessHeaderProps {
  readonly completeness: SourceCollectionCompleteness
  readonly period: CompanyHomePeriod
}

export function CompletenessHeader({ completeness, period }: CompletenessHeaderProps) {
  const metaParts: string[] = []
  const hasRequiredItems = completeness.requiredCount > 0
  if (!hasRequiredItems) {
    metaParts.push('자료를 업로드하면 수집 기준과 정규화 상태가 채워집니다')
  } else if (completeness.missingCount > 0) {
    metaParts.push(`필수 자료 ${completeness.missingCount}건 미수집`)
  }
  if (hasRequiredItems && completeness.normalizationPendingCount > 0) {
    metaParts.push(`정규화 대기 ${completeness.normalizationPendingCount}건`)
  }
  if (hasRequiredItems && metaParts.length === 0) {
    metaParts.push('나머지 확정 완료')
  } else if (hasRequiredItems && completeness.collectedCount > 0) {
    metaParts.push('나머지 확정 완료')
  }

  return (
    <div className={cn(panelClass, 'grid items-center gap-5 px-6 py-5 md:grid-cols-[minmax(0,1fr)_auto]')}>
      <div>
        <p className="text-xs font-semibold text-company-fg-muted">
          수집 완결성 · {formatPeriodEyebrow(period)}
        </p>
        <h2 className="mt-1 text-[20px] font-bold tracking-[-0.02em] text-foreground">
          {hasRequiredItems
            ? `자료 ${completeness.collectedCount} / ${completeness.requiredCount}건 수집됨`
            : '자료 기준이 아직 없습니다'}
        </h2>
        <div className="mt-3 h-2 max-w-[460px] overflow-hidden rounded-full bg-[#ececee]">
          <div
            className="h-full rounded-full bg-[#2563eb]"
            style={{ width: `${completeness.progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-[12.5px] text-company-fg-muted">{metaParts.join(' · ')}</p>
      </div>
      <div className="text-left md:text-right">
        <p className="text-[28px] font-bold tracking-[-0.02em] text-foreground">
          {completeness.missingCount}
          <span className="text-[15px] font-semibold text-company-fg-subtle"> 건</span>
        </p>
        <p className="text-xs font-semibold text-company-fg-muted">미수집</p>
      </div>
    </div>
  )
}

export function SourceTypeTilesSection({ tiles }: { readonly tiles: SourceCollectionSourceTypeTile[] }) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        title="자료유형 정규화"
        description="업로드된 파일을 표준 자료유형으로 자동 분류"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = sourceTypeIcon[tile.id]
          const showRequired = tile.requiredCount > 0
          return (
            <div key={tile.id} className={cn(panelClass, 'flex flex-col gap-2 p-3.5')}>
              <div className="flex items-center gap-2">
                <div className="grid size-[26px] place-items-center rounded-[7px] bg-company-nav-hover text-[13px] text-company-fg-muted">
                  <Icon className="size-3.5" />
                </div>
                <p className="text-[12.5px] font-semibold text-foreground">{tile.title}</p>
              </div>
              <p className="text-[20px] font-bold tracking-[-0.01em] text-foreground">
                {tile.collectedCount}
                {showRequired ? (
                  <span className="text-xs font-semibold text-company-fg-subtle"> / {tile.requiredCount}건</span>
                ) : (
                  <span className="text-xs font-semibold text-company-fg-subtle"> 건</span>
                )}
              </p>
              <PreviewChip className={toneChipClass[tile.tone]}>{tile.statusLabel}</PreviewChip>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function ImportStatusTableSection({
  rows,
  focusFileId,
}: {
  readonly rows: SourceCollectionImportRow[]
  readonly focusFileId?: string | null
}) {
  return (
    <section id="import-status" className="grid gap-3">
      <SectionHeader
        title="수집(가져오기) 상태"
        description="업로드 → 파싱 → 정규화 진행 상황"
        action={(
          <Link href="#import-status" className="text-[12.5px] font-semibold text-[#2563eb] hover:underline">
            전체 보기 →
          </Link>
        )}
      />
      <div className={panelClass}>
        {rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="bg-[#fafafa] text-[11.5px] font-semibold uppercase tracking-wide text-company-fg-subtle">파일</TableHead>
                <TableHead className="bg-[#fafafa] text-[11.5px] font-semibold uppercase tracking-wide text-company-fg-subtle">자료유형</TableHead>
                <TableHead className="bg-[#fafafa] text-[11.5px] font-semibold uppercase tracking-wide text-company-fg-subtle">진행</TableHead>
                <TableHead className="bg-[#fafafa] text-[11.5px] font-semibold uppercase tracking-wide text-company-fg-subtle">상태</TableHead>
                <TableHead className="bg-[#fafafa] text-[11.5px] font-semibold uppercase tracking-wide text-company-fg-subtle">업로드</TableHead>
                <TableHead className="bg-[#fafafa]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-file-id={row.id}
                  className={cn(
                    'hover:bg-[#fafafa]',
                    focusFileId === row.id && 'bg-[#eff6ff]/60',
                  )}
                >
                  <TableCell>
                    <p className="font-semibold text-foreground">{row.safeTitle}</p>
                    {row.rowCountLabel && (
                      <p className="text-[11.5px] text-company-fg-subtle">{row.rowCountLabel}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <PreviewChip className={toneChipClass.muted}>
                      {sourceCollectionSourceTypeLabel(row.sourceType)}
                    </PreviewChip>
                  </TableCell>
                  <TableCell>
                    <div className="inline-block h-1.5 w-[90px] overflow-hidden rounded-full bg-[#ececee] align-middle">
                      <div
                        className={cn('h-full rounded-full', row.status === 'failed' ? 'bg-[#dc2626]' : 'bg-[#2563eb]')}
                        style={{ width: `${row.progressPercent}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <PreviewChip className={fileStatusChipClass[row.status] ?? toneChipClass.muted}>
                      {row.statusLabel}
                    </PreviewChip>
                  </TableCell>
                  <TableCell className="font-mono text-[13px] text-company-fg-muted">
                    {formatUploadDate(row.uploadedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={row.href} className="text-xs font-semibold text-[#2563eb] hover:underline">
                      {row.canRetry ? (
                        <span className="inline-flex items-center gap-1">
                          <RefreshCw className="size-3" />
                          다시 시도
                        </span>
                      ) : '보기'}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="grid place-items-center p-8 text-center">
            <div>
              <UploadCloud className="mx-auto size-8 text-company-fg-subtle/60" />
              <p className="mt-3 text-[12.5px] font-medium text-foreground">아직 업로드된 자료가 없습니다</p>
              <Link href="#upload-dropzone" className="mt-2 inline-block text-xs font-semibold text-[#2563eb]">
                첫 자료 업로드하기
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function MissingChecklistSection({ items }: { readonly items: SourceCollectionMissingItem[] }) {
  if (items.length === 0) {
    return (
      <section className="grid gap-3">
        <SectionHeader title="미수집 · 확인 필요" description="신고 전 확보해야 할 자료" />
        <div className={cn(panelClass, 'grid place-items-center p-8 text-center')}>
          <p className="text-sm font-medium text-foreground">확인이 필요한 항목이 없습니다</p>
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-3">
      <SectionHeader title="미수집 · 확인 필요" description="신고 전 확보해야 할 자료" />
      <div className={panelClass}>
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-3.5 px-[18px] py-3',
              index !== items.length - 1 && 'border-b border-company-border',
            )}
          >
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                item.tone === 'danger' ? 'bg-[#dc2626]' : 'bg-[#d97706]',
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-foreground">{item.title}</p>
              <p className="mt-0.5 text-[12.5px] text-company-fg-muted">{item.description}</p>
            </div>
            <Link href={item.href} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}>
              {item.ctaLabel}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

interface BusinessEntityEmptyStateProps {
  readonly tenantName: string
}

export function SourceCollectionBusinessEntityEmptyState({ tenantName }: BusinessEntityEmptyStateProps) {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 bg-company-bg p-6">
      <div className={cn(panelClass, 'grid gap-3 p-6')}>
        <h2 className="text-lg font-semibold text-foreground">아직 등록된 사업장이 없습니다</h2>
        <p className="text-sm text-company-fg-muted">
          {tenantName}에서 자료수집을 시작하려면 사업장 정보를 먼저 등록해야 합니다.
        </p>
        <Link href="/dashboard/clients" className={cn(buttonVariants(), 'w-fit')}>
          <Building2 className="size-4" />
          사업장 등록으로 이동
        </Link>
      </div>
    </div>
  )
}

// Legacy exports kept for loading/tests
export function SourceCollectionHeader({ summary }: { readonly summary: Pick<SourceCollectionSummary, 'tenant' | 'businessEntity' | 'period'> }) {
  return <SourceCollectionTopbar summary={summary as SourceCollectionSummary} />
}
