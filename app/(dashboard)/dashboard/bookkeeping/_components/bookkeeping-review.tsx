'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type MouseEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Building2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  BOOKKEEPING_ACCOUNT_CATEGORIES,
  labelForBookkeepingAccountCategory,
} from '@/lib/bookkeeping/account-categories'
import type {
  BookkeepingReviewQueueRow,
  BookkeepingReviewSummary,
  BookkeepingReviewTab,
  BookkeepingReviewTone,
} from '@/lib/bookkeeping-review/summary'
import { cn } from '@/lib/utils'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'

const chipClass: Record<BookkeepingReviewTone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
}

const confidenceBarClass: Record<BookkeepingReviewQueueRow['confidence'], string> = {
  high: 'bg-[#16a34a]',
  medium: 'bg-[#d97706]',
  low: 'bg-[#dc2626]',
}

const confidencePercent: Record<BookkeepingReviewQueueRow['confidence'], number> = {
  high: 92,
  medium: 68,
  low: 38,
}

const tabLabels: Array<{ id: BookkeepingReviewTab; label: string; countKey: keyof BookkeepingReviewSummary['counts'] }> = [
  { id: 'pending', label: '검토 대기', countKey: 'pending' },
  { id: 'low_confidence', label: '신뢰도 낮음', countKey: 'lowConfidence' },
  { id: 'confirmed', label: '확정', countKey: 'confirmed' },
  { id: 'all', label: '전체', countKey: 'total' },
]

export interface BookkeepingReviewViewProps {
  readonly summary: BookkeepingReviewSummary
}

export function BookkeepingReviewView({ summary }: BookkeepingReviewViewProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState(() => new Set(
    summary.rows
      .filter(canApproveRow)
      .slice(0, 3)
      .map((row) => row.id),
  ))
  const [isPending, startTransition] = useTransition()
  const selectedRows = useMemo(
    () => summary.rows.filter((row) => selectedIds.has(row.id) && canApproveRow(row)),
    [selectedIds, summary.rows],
  )

  function toggleRowSelection(row: BookkeepingReviewQueueRow) {
    if (!canApproveRow(row)) {
      toast.info('신뢰도 낮은 거래는 먼저 계정과목을 지정해야 합니다.')
      return
    }
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
  }

  function replaceSelectedRow(row: BookkeepingReviewQueueRow) {
    router.replace(buildBookkeepingHref({
      periodKey: summary.period.key,
      tab: summary.tab,
      rowId: row.id,
    }), { scroll: false })
  }

  function approveOne(row: BookkeepingReviewQueueRow) {
    if (!canApproveRow(row)) {
      toast.info('계정 지정 후 승인할 수 있습니다.')
      return
    }
    startTransition(async () => {
      const result = await confirmRow(row)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('거래 1건을 승인했습니다.')
      router.refresh()
    })
  }

  function approveWithAccount(row: BookkeepingReviewQueueRow, finalAccount: string) {
    startTransition(async () => {
      const result = await confirmRow(row, finalAccount)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('계정과목을 지정하고 거래를 승인했습니다.')
      router.refresh()
    })
  }

  function approveSelected() {
    if (selectedRows.length === 0) {
      toast.info('승인할 거래를 선택해 주세요.')
      return
    }
    startTransition(async () => {
      const result = await confirmRowsBySession(selectedRows)
      if (result.failedSessions.length > 0 && result.confirmedCount > 0) {
        toast.warning(`${result.confirmedCount}건 승인, ${result.failedSessions.length}개 세션은 실패했습니다.`)
      } else if (result.failedSessions.length > 0) {
        toast.error('선택 거래를 승인하지 못했습니다.')
      } else {
        toast.success(`${result.confirmedCount}건을 승인했습니다.`)
      }
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <BookkeepingReviewTopbar summary={summary} />
      <div className="flex w-full max-w-[1200px] flex-col gap-5 px-7 pt-6 pb-12">
        <ClassificationProgressHeader summary={summary} />
        <Toolbar
          summary={summary}
          selectedCount={selectedRows.length}
          isPending={isPending}
          onApproveSelected={approveSelected}
        />
        <ClassificationQueueTable
          rows={summary.rows}
          selectedRowId={summary.selected?.row.id ?? null}
          selectedIds={selectedIds}
          isPending={isPending}
          onToggleSelection={toggleRowSelection}
          onSelectRow={replaceSelectedRow}
          onApproveOne={approveOne}
          onApproveWithAccount={approveWithAccount}
        />
        <SelectedTransactionDetail
          selected={summary.selected}
          isPending={isPending}
          onApproveOne={approveOne}
          onApproveWithAccount={approveWithAccount}
        />
        <StateCoverageSection />
        <PreviewNote />
      </div>
    </div>
  )
}

interface BookkeepingReviewTopbarProps {
  readonly summary: BookkeepingReviewSummary
}

function BookkeepingReviewTopbar({ summary }: BookkeepingReviewTopbarProps) {
  const companyName = summary.businessEntity?.name ?? summary.tenant.name

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
      <div>
        <p className="text-[12.5px] font-medium text-company-fg-subtle">
          <Link href="/dashboard" className="hover:text-company-fg-muted hover:underline">회사 홈</Link>
          <span aria-hidden="true"> › </span>
          <span>기장검토</span>
        </p>
        <h1 className="text-base font-semibold tracking-tight text-foreground">기장검토</h1>
      </div>
      <span className="text-[13px] font-medium text-company-fg-muted">{companyName}</span>
      <div className="ml-auto">
        <Link
          href={buildBookkeepingHref({ periodKey: summary.period.key, tab: summary.tab })}
          className="inline-flex items-center gap-2 rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground"
        >
          {formatPeriodPillLabel(summary.period.key)}
          <span className="text-[11px] text-company-fg-subtle">▾</span>
        </Link>
      </div>
    </div>
  )
}

interface ClassificationProgressHeaderProps {
  readonly summary: BookkeepingReviewSummary
}

function ClassificationProgressHeader({ summary }: ClassificationProgressHeaderProps) {
  const progress = summary.counts.total > 0
    ? Math.round((summary.counts.confirmed / summary.counts.total) * 1000) / 10
    : 0
  const lowHint = summary.counts.lowConfidence > 0
    ? `신뢰도 낮음 ${summary.counts.lowConfidence}건은 수정 권장`
    : '신뢰도 낮음 거래 없음'

  return (
    <div className={cn(panelClass, 'grid items-center gap-5 px-6 py-5 md:grid-cols-[minmax(0,1fr)_auto]')}>
      <div>
        <p className="text-xs font-semibold text-company-fg-muted">거래 분류 현황 · {formatPeriodEyebrow(summary.period.key)}</p>
        <h2 className="mt-1 text-[20px] font-bold tracking-[-0.02em] text-foreground">
          {summary.counts.confirmed} / {summary.counts.total}건 계정과목 확정
        </h2>
        <div className="mt-3 h-2 max-w-[460px] overflow-hidden rounded-full bg-[#ececee]">
          <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-[12.5px] text-company-fg-muted">
          AI 추천 계정항목을 확인하고 확정합니다. 자료 대조·증빙 연결은 자료대조원장에서 확인합니다. 검토 대기 {summary.counts.pending}건 · {lowHint}
        </p>
      </div>
      <div className="text-left md:text-right">
        <p className="text-[28px] font-bold tracking-[-0.02em] text-[#dc2626]">
          {summary.counts.pending}
          <span className="text-[15px] font-semibold text-company-fg-subtle"> 건</span>
        </p>
        <p className="text-xs font-semibold text-company-fg-muted">검토 대기</p>
      </div>
    </div>
  )
}

interface ToolbarProps {
  readonly summary: BookkeepingReviewSummary
  readonly selectedCount: number
  readonly isPending: boolean
  readonly onApproveSelected: () => void
}

function Toolbar({ summary, selectedCount, isPending, onApproveSelected }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex gap-0.5 rounded-[9px] bg-[#f1f1f2] p-[3px]">
        {tabLabels.map((tab) => (
          <Link
            key={tab.id}
            href={buildBookkeepingHref({ periodKey: summary.period.key, tab: tab.id })}
            className={cn(
              'rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
              summary.tab === tab.id
                ? 'bg-company-surface text-foreground shadow-company-card'
                : 'text-company-fg-muted hover:text-foreground',
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-[11px] text-company-fg-subtle">{summary.counts[tab.countKey]}</span>
          </Link>
        ))}
      </div>
      <div className="flex-1" />
      <button
        type="button"
        className="rounded-lg border border-transparent bg-transparent px-3 py-2 text-[12.5px] font-semibold text-foreground hover:bg-company-nav-hover"
        onClick={() => toast.info('계정과목 일괄 변경 UI는 다음 슬라이스에서 다룹니다.')}
      >
        선택 항목 계정과목 일괄 변경
      </button>
      <button
        type="button"
        className="rounded-lg border border-[#18181b] bg-[#18181b] px-3 py-2 text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || selectedCount === 0}
        onClick={onApproveSelected}
      >
        선택 {selectedCount}건 승인
      </button>
    </div>
  )
}

interface ClassificationQueueTableProps {
  readonly rows: BookkeepingReviewQueueRow[]
  readonly selectedRowId: string | null
  readonly selectedIds: ReadonlySet<string>
  readonly isPending: boolean
  readonly onToggleSelection: (row: BookkeepingReviewQueueRow) => void
  readonly onSelectRow: (row: BookkeepingReviewQueueRow) => void
  readonly onApproveOne: (row: BookkeepingReviewQueueRow) => void
  readonly onApproveWithAccount: (row: BookkeepingReviewQueueRow, finalAccount: string) => void
}

function ClassificationQueueTable({
  rows,
  selectedRowId,
  selectedIds,
  isPending,
  onToggleSelection,
  onSelectRow,
  onApproveOne,
  onApproveWithAccount,
}: ClassificationQueueTableProps) {
  return (
    <div className={panelClass}>
      {rows.length > 0 ? (
        <div className="max-h-[350px] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-company-border bg-[#fafafa]">
                <QueueHead className="w-[34px]" />
                <QueueHead>거래일</QueueHead>
                <QueueHead>거래내용 / 상대처</QueueHead>
                <QueueHead className="text-right">금액</QueueHead>
                <QueueHead>추천 계정과목</QueueHead>
                <QueueHead>신뢰도</QueueHead>
                <QueueHead>처리</QueueHead>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-company-border last:border-b-0 hover:bg-[#fafafa]',
                    selectedRowId === row.id && 'bg-[#eff6ff] hover:bg-[#e7f0ff]',
                  )}
                  onClick={() => onSelectRow(row)}
                >
                  <QueueCell>
                    <button
                      type="button"
                      aria-label={`${row.description} 선택`}
                      className={cn(
                        'inline-block size-[15px] rounded border-[1.5px] border-company-border-strong align-middle',
                        selectedIds.has(row.id) && 'border-[#2563eb] bg-[#2563eb] text-[10px] leading-[13px] text-white',
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleSelection(row)
                      }}
                    >
                      {selectedIds.has(row.id) ? '✓' : ''}
                    </button>
                  </QueueCell>
                  <QueueCell className="font-mono text-company-fg-muted tabular-nums">{formatTransactionDate(row.transactionDate)}</QueueCell>
                  <QueueCell>
                    <p className="font-semibold text-foreground">{row.description}</p>
                    <p className="text-[11.5px] text-company-fg-subtle">{formatCounterparty(row.counterparty)}</p>
                  </QueueCell>
                  <QueueCell className="text-right font-semibold tabular-nums">{formatWon(row.amountKrw)}</QueueCell>
                  <QueueCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-semibold">{formatAccount(row.finalAccount ?? row.recommendedAccount)}</span>
                      <span className="rounded-[5px] border border-[#bfdbfe] bg-[#eff6ff] px-1.5 py-px text-[10px] font-bold text-[#2563eb]">AI</span>
                    </span>
                  </QueueCell>
                  <QueueCell>
                    <ConfidenceIndicator row={row} />
                  </QueueCell>
                  <QueueCell>
                    <RowActions
                      row={row}
                      isPending={isPending}
                      onApproveOne={onApproveOne}
                      onApproveWithAccount={onApproveWithAccount}
                    />
                  </QueueCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-h-[260px] place-items-center p-8 text-center">
          <div>
            <p className="text-[22px] text-company-fg-subtle/50">✓</p>
            <p className="mt-1.5 text-[12.5px] font-semibold text-foreground">검토할 거래가 없습니다</p>
            <p className="mt-2.5 text-xs font-semibold text-[#2563eb]">분류 확정 완료</p>
          </div>
        </div>
      )}
    </div>
  )
}

interface QueueHeadProps {
  readonly children?: ReactNode
  readonly className?: string
}

function QueueHead({ children, className }: QueueHeadProps) {
  return (
    <th className={cn('px-4 py-[11px] text-left text-[11.5px] font-semibold tracking-[0.03em] text-company-fg-subtle uppercase', className)}>
      {children}
    </th>
  )
}

interface QueueCellProps {
  readonly children: ReactNode
  readonly className?: string
}

function QueueCell({ children, className }: QueueCellProps) {
  return (
    <td className={cn('px-4 py-3 text-[13px] align-middle', className)}>
      {children}
    </td>
  )
}

interface ConfidenceIndicatorProps {
  readonly row: BookkeepingReviewQueueRow
}

function ConfidenceIndicator({ row }: ConfidenceIndicatorProps) {
  const percent = confidencePercent[row.confidence]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums">
      <span className="h-1.5 w-11 overflow-hidden rounded-full bg-[#ececee]">
        <span className={cn('block h-full rounded-full', confidenceBarClass[row.confidence])} style={{ width: `${percent}%` }} />
      </span>
      {percent}%
    </span>
  )
}

interface RowActionsProps {
  readonly row: BookkeepingReviewQueueRow
  readonly isPending: boolean
  readonly onApproveOne: (row: BookkeepingReviewQueueRow) => void
  readonly onApproveWithAccount: (row: BookkeepingReviewQueueRow, finalAccount: string) => void
}

function RowActions({ row, isPending, onApproveOne, onApproveWithAccount }: RowActionsProps) {
  const [editing, setEditing] = useState(false)
  const [account, setAccount] = useState(defaultAccountValue(row))
  const needsAccount = !canApproveRow(row)

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
        <select
          aria-label="계정과목 선택"
          className="max-w-[138px] rounded-[7px] border border-company-border-strong bg-company-surface px-2 py-1 text-[11.5px] font-semibold text-foreground"
          value={account}
          onChange={(event) => setAccount(event.target.value)}
          disabled={isPending}
        >
          {BOOKKEEPING_ACCOUNT_CATEGORIES
            .filter((category) => category.key !== 'unclassified')
            .map((category) => (
              <option key={category.key} value={category.key}>{category.label}</option>
            ))}
        </select>
        <button
          type="button"
          className="rounded-[7px] border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-1 text-[11.5px] font-semibold text-[#16a34a] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={() => onApproveWithAccount(row, account)}
        >
          저장
        </button>
        <button
          type="button"
          className="rounded-[7px] border border-company-border-strong bg-company-surface px-2.5 py-1 text-[11.5px] font-semibold text-foreground"
          onClick={() => setEditing(false)}
          disabled={isPending}
        >
          취소
        </button>
      </span>
    )
  }

  return (
    <span className="inline-flex gap-1.5">
      <button
        type="button"
        className={cn(
          'rounded-[7px] border px-2.5 py-1 text-[11.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-60',
          needsAccount
            ? 'border-company-border-strong bg-company-surface text-foreground'
            : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
        )}
        disabled={isPending || row.status === 'confirmed'}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation()
          if (needsAccount) {
            setEditing(true)
            return
          }
          onApproveOne(row)
        }}
      >
        {needsAccount ? '계정 지정' : '승인'}
      </button>
      {!needsAccount && (
        <button
          type="button"
          className="rounded-[7px] border border-company-border-strong bg-company-surface px-2.5 py-1 text-[11.5px] font-semibold text-foreground"
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            setEditing(true)
          }}
        >
          수정
        </button>
      )}
    </span>
  )
}

interface SelectedTransactionDetailProps {
  readonly selected: BookkeepingReviewSummary['selected']
  readonly isPending: boolean
  readonly onApproveOne: (row: BookkeepingReviewQueueRow) => void
  readonly onApproveWithAccount: (row: BookkeepingReviewQueueRow, finalAccount: string) => void
}

function SelectedTransactionDetail({
  selected,
  isPending,
  onApproveOne,
  onApproveWithAccount,
}: SelectedTransactionDetailProps) {
  if (!selected) return null

  return (
    <SelectedTransactionDetailContent
      key={selected.row.id}
      selected={selected}
      isPending={isPending}
      onApproveOne={onApproveOne}
      onApproveWithAccount={onApproveWithAccount}
    />
  )
}

interface SelectedTransactionDetailContentProps {
  readonly selected: NonNullable<BookkeepingReviewSummary['selected']>
  readonly isPending: boolean
  readonly onApproveOne: (row: BookkeepingReviewQueueRow) => void
  readonly onApproveWithAccount: (row: BookkeepingReviewQueueRow, finalAccount: string) => void
}

function SelectedTransactionDetailContent({
  selected,
  isPending,
  onApproveOne,
  onApproveWithAccount,
}: SelectedTransactionDetailContentProps) {
  const [detailAccount, setDetailAccount] = useState(defaultAccountValue(selected.row))
  const needsAccount = !canApproveRow(selected.row)

  return (
    <>
      <SectionHeader
        title="선택 거래 상세"
        description={`${formatTransactionDate(selected.row.transactionDate)} · ${selected.row.description} · ${formatWon(selected.row.amountKrw)}원`}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-company-border bg-company-surface p-[18px] shadow-company-card">
          <h3 className="text-[13px] font-semibold text-foreground">분개 미리보기</h3>
          <p className="mt-1 mb-3.5 text-xs text-company-fg-subtle">
            {selected.journalEntry ? '확정 시 아래 분개를 참고합니다.' : '분개는 후속 전표 생성 단계에서 만들어집니다.'}
          </p>
          {selected.journalEntry ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <JournalHead>구분</JournalHead>
                  <JournalHead>계정과목</JournalHead>
                  <JournalHead className="text-right">금액</JournalHead>
                </tr>
              </thead>
              <tbody>
                {selected.journalEntry.lines.map((line, index) => (
                  <tr key={`${line.side}-${line.account}-${index}`} className="border-b border-company-border">
                    <JournalCell><span className="text-[11px] font-bold text-company-fg-subtle">{line.side}</span></JournalCell>
                    <JournalCell>{line.account}</JournalCell>
                    <JournalCell className="text-right font-semibold tabular-nums">{formatWon(line.amountKrw)}</JournalCell>
                  </tr>
                ))}
                <tr>
                  <JournalCell />
                  <JournalCell className="font-bold">
                    {selected.journalEntry.balanced ? '차변 합계 = 대변 합계' : '차변/대변 합계 확인 필요'}
                  </JournalCell>
                  <JournalCell className="text-right font-bold tabular-nums">
                    {formatWon(selected.journalEntry.debitTotal)}
                  </JournalCell>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="rounded-lg border border-dashed border-company-border-strong bg-[#fafafa] p-5 text-[12.5px] text-company-fg-muted">
              분류 확정 후 전표 생성 단계에서 차변·대변 분개를 확인할 수 있습니다.
            </div>
          )}
        </div>
        <div className="rounded-xl border border-company-border bg-company-surface p-[18px] shadow-company-card">
          <h3 className="text-[13px] font-semibold text-foreground">기간 귀속 · 승인</h3>
          <p className="mt-1 mb-3.5 text-xs text-company-fg-subtle">귀속 기간과 증빙을 확인하세요.</p>
          <div className="flex flex-col gap-3">
            <AttrRow label="귀속 기간" value={selected.attribution.periodLabel ?? '미지정'} />
            <AttrRow label="증빙 유형" value={selected.attribution.evidenceType ?? '거래 데이터'} />
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-[12.5px] text-company-fg-muted">부가세 공제</span>
              <PreviewChip tone={selected.attribution.vatDeductible === false ? 'warn' : 'ok'}>
                {selected.attribution.vatDeductible === false ? '검토 필요' : '공제 대상'}
              </PreviewChip>
            </div>
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-[12.5px] text-company-fg-muted">현재 상태</span>
              <PreviewChip tone={selected.row.status === 'confirmed' ? 'ok' : 'warn'}>
                {selected.row.status === 'confirmed' ? '확정' : '검토 대기'}
              </PreviewChip>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2.5 border-t border-company-border pt-3.5">
            <span className="flex-1 rounded-[10px] border border-company-border bg-[#fafafa] px-3 py-2 text-xs text-company-fg-subtle">
              승인하면 거래 분류가 확정됩니다.
            </span>
            {needsAccount ? (
              <select
                aria-label="상세 계정과목 선택"
                className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-2 text-[12.5px] font-semibold text-foreground"
                value={detailAccount}
                onChange={(event) => setDetailAccount(event.target.value)}
                disabled={isPending || selected.row.status === 'confirmed'}
              >
                {BOOKKEEPING_ACCOUNT_CATEGORIES
                  .filter((category) => category.key !== 'unclassified')
                  .map((category) => (
                    <option key={category.key} value={category.key}>{category.label}</option>
                  ))}
              </select>
            ) : (
              <button
                type="button"
                className="rounded-lg border border-company-border-strong bg-company-surface px-3 py-2 text-[12.5px] font-semibold text-foreground"
                onClick={() => onApproveWithAccount(selected.row, detailAccount)}
              >
                수정
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-[#18181b] bg-[#18181b] px-3 py-2 text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending || selected.row.status === 'confirmed'}
              onClick={() => {
                if (needsAccount) {
                  onApproveWithAccount(selected.row, detailAccount)
                  return
                }
                onApproveOne(selected.row)
              }}
            >
              이 거래 승인
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

interface JournalHeadProps {
  readonly children: ReactNode
  readonly className?: string
}

function JournalHead({ children, className }: JournalHeadProps) {
  return (
    <th className={cn('border-b border-company-border px-2.5 py-1.5 text-left text-[11px] font-semibold tracking-[0.03em] text-company-fg-subtle uppercase', className)}>
      {children}
    </th>
  )
}

interface JournalCellProps {
  readonly children?: ReactNode
  readonly className?: string
}

function JournalCell({ children, className }: JournalCellProps) {
  return (
    <td className={cn('border-b border-company-border px-2.5 py-2.5 text-[13px] last:border-b-0', className)}>
      {children}
    </td>
  )
}

interface AttrRowProps {
  readonly label: string
  readonly value: string
}

function AttrRow({ label, value }: AttrRowProps) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <span className="text-[12.5px] text-company-fg-muted">{label}</span>
      <span className="text-[13px] font-semibold text-foreground">{value}</span>
    </div>
  )
}

interface SectionHeaderProps {
  readonly title: string
  readonly description: string
}

function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-2.5">
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-xs text-company-fg-subtle">{description}</p>
    </div>
  )
}

function StateCoverageSection() {
  return (
    <section className="grid gap-3" aria-labelledby="bookkeeping-review-states">
      <SectionHeader title="화면 상태 예시" description="로딩 / 빈 상태 / 오류" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex min-h-[132px] flex-col rounded-xl border border-dashed border-company-border-strong bg-company-surface p-[18px]">
          <p className="mb-3 text-[11px] font-bold tracking-[0.04em] text-company-fg-subtle uppercase">Loading</p>
          <div className="h-3 w-[40%] rounded-md bg-linear-to-r from-[#eee] via-[#f5f5f5] to-[#eee]" />
          <div className="mt-2.5 h-3 w-[80%] rounded-md bg-linear-to-r from-[#eee] via-[#f5f5f5] to-[#eee]" />
          <div className="mt-2.5 h-3 w-[60%] rounded-md bg-linear-to-r from-[#eee] via-[#f5f5f5] to-[#eee]" />
        </div>
        <div className="flex min-h-[132px] flex-col rounded-xl border border-dashed border-company-border-strong bg-company-surface p-[18px]">
          <p className="mb-3 text-[11px] font-bold tracking-[0.04em] text-company-fg-subtle uppercase">Empty</p>
          <div className="grid flex-1 place-items-center text-center text-company-fg-subtle">
            <div>
              <p className="text-[22px] opacity-50">✓</p>
              <p className="mt-1.5 text-[12.5px]">검토 대기 거래가 없습니다</p>
              <p className="mt-2.5 text-xs font-semibold text-[#2563eb]">분류 확정 완료</p>
            </div>
          </div>
        </div>
        <div className="flex min-h-[132px] flex-col rounded-xl border border-dashed border-company-border-strong bg-company-surface p-[18px]">
          <p className="mb-3 text-[11px] font-bold tracking-[0.04em] text-company-fg-subtle uppercase">Error</p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[13px] font-semibold text-[#dc2626]">분류 큐를 불러오지 못했습니다</p>
            <p className="mt-1 text-xs text-company-fg-muted">일시적 오류입니다. 잠시 후 다시 시도해 주세요.</p>
            <Link href="/dashboard/bookkeeping" className="mt-2.5 w-fit rounded-lg border border-company-border-strong px-2.5 py-1 text-xs font-semibold">
              다시 시도
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function PreviewNote() {
  return (
    <p className="rounded-[10px] border border-company-border bg-[#fafafa] px-3.5 py-3 text-xs text-company-fg-subtle">
      <span className="font-semibold text-company-fg-muted">Preview 안내</span>
      {' — '}
      이 화면은 기장검토 분류 큐입니다. AI 추천 계정과목, 신뢰도, 선택 거래 상세, 로딩·빈·오류 상태를 승인된 Preview 구조에 맞춰 제공합니다.
      AI 추천은 초안이며 최종 확정 책임은 사용자에게 있습니다.
    </p>
  )
}

interface PreviewChipProps {
  readonly tone: BookkeepingReviewTone
  readonly children: ReactNode
}

function PreviewChip({ tone, children }: PreviewChipProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11.5px] font-semibold', chipClass[tone])}>
      {children}
    </span>
  )
}

interface BookkeepingReviewBusinessEntityEmptyStateProps {
  readonly tenantName: string
}

export function BookkeepingReviewBusinessEntityEmptyState({ tenantName }: BookkeepingReviewBusinessEntityEmptyStateProps) {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 bg-company-bg p-6">
      <div className={cn(panelClass, 'grid gap-3 p-6')}>
        <div className="flex size-10 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb]">
          <Building2 className="size-5" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">아직 등록된 사업장이 없습니다</h2>
        <p className="text-sm text-company-fg-muted">
          {tenantName}에서 기장검토를 시작하려면 사업장 정보를 먼저 등록해야 합니다.
        </p>
        <Link href="/dashboard/clients" className={cn(buttonVariants(), 'w-fit')}>
          사업장 등록으로 이동
        </Link>
      </div>
    </div>
  )
}

function canApproveRow(row: BookkeepingReviewQueueRow) {
  return row.status !== 'confirmed' &&
    !row.requiresManualAccount &&
    Boolean(row.finalAccount ?? row.recommendedAccount) &&
    (row.finalAccount ?? row.recommendedAccount) !== 'unclassified'
}

async function confirmRow(row: BookkeepingReviewQueueRow, accountOverride?: string) {
  const finalAccount = accountOverride ?? row.finalAccount ?? row.recommendedAccount
  const response = await fetch(`/api/sessions/${row.uploadSessionId}/account-classification/rows/${row.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finalAccount, status: 'confirmed' }),
  })

  if (response.ok) return { ok: true as const }
  const payload = await response.json().catch(() => null)
  return {
    ok: false as const,
    message: typeof payload?.error === 'string' ? payload.error : '거래 승인에 실패했습니다.',
  }
}

async function confirmRowsBySession(rows: BookkeepingReviewQueueRow[]) {
  const grouped = new Map<string, string[]>()
  for (const row of rows) {
    const current = grouped.get(row.uploadSessionId) ?? []
    current.push(row.id)
    grouped.set(row.uploadSessionId, current)
  }

  let confirmedCount = 0
  const failedSessions: string[] = []
  for (const [sessionId, rowIds] of grouped) {
    const response = await fetch(`/api/sessions/${sessionId}/account-classification/bulk-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIds, mode: 'explicit' }),
    })
    if (!response.ok) {
      failedSessions.push(sessionId)
      continue
    }
    const payload = await response.json().catch(() => null)
    confirmedCount += typeof payload?.count === 'number' ? payload.count : rowIds.length
  }

  return { confirmedCount, failedSessions }
}

function buildBookkeepingHref(params: {
  periodKey: string
  tab?: BookkeepingReviewTab
  rowId?: string | null
}) {
  const search = new URLSearchParams()
  search.set('period', params.periodKey)
  if (params.tab && params.tab !== 'pending') search.set('tab', params.tab)
  if (params.rowId) search.set('rowId', params.rowId)
  const query = search.toString()
  return query ? `/dashboard/bookkeeping?${query}` : '/dashboard/bookkeeping'
}

function formatPeriodPillLabel(periodKey: string) {
  const year = periodKey.slice(0, 4)
  if (periodKey.endsWith('H2')) return `${year}년 부가세 2기 (7~12월)`
  if (periodKey.endsWith('H1')) return `${year}년 부가세 1기 (1~6월)`
  return periodKey
}

function formatPeriodEyebrow(periodKey: string) {
  const year = periodKey.slice(0, 4)
  if (periodKey.endsWith('H2')) return `${year}년 2기`
  if (periodKey.endsWith('H1')) return `${year}년 1기`
  return periodKey
}

function formatTransactionDate(value: string | null) {
  if (!value) return '-'
  const [, month, day] = value.split('-')
  return month && day ? `${month}-${day}` : value
}

function formatCounterparty(value: string | null) {
  return value?.trim() || '상대처 미상'
}

function formatWon(value: number | null) {
  if (typeof value !== 'number') return '-'
  return new Intl.NumberFormat('ko-KR').format(value)
}

function formatAccount(value: string | null | undefined) {
  return labelForBookkeepingAccountCategory(value) || '미분류'
}

function defaultAccountValue(row: BookkeepingReviewQueueRow) {
  const value = row.finalAccount ?? row.recommendedAccount
  if (value && value !== 'unclassified') return value
  return 'supplies'
}
