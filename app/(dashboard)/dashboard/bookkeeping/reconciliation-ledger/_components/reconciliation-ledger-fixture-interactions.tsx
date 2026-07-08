'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Search, Sparkles } from 'lucide-react'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { labelForBookkeepingAccountCategory } from '@/lib/bookkeeping/account-categories'
import { filterReconciliationFixtureAccountGroups } from '@/lib/bookkeeping-review/reconciliation-fixture-account-options'
import type { ReconciliationLedgerRow } from '@/lib/bookkeeping-review/reconciliation-display-model'
import {
  computeRemainingDifferenceKrw,
  evidenceActionChipLabel,
  evidenceFinderActionLabel,
  evidenceFinderSourceOptions,
  filterEvidenceFinderBrowseRows,
  formatExclusionReasonMemo,
  formatKrwAmount,
  formatRemainingDifferenceLabel,
  hasEvidenceFinderAiMatch,
  listEvidenceFinderBrowseRows,
  matchCandidateReasonLabel,
  resolveEvidenceFinderRowMatch,
  resolveLinkedEvidenceDisplay,
  shouldShowEvidenceFinder,
  type EvidenceFinderSource,
} from '@/lib/bookkeeping-review/reconciliation-row-actions'
import {
  confirmReconciliationRowAccount,
  revertReconciliationRowState,
  saveReconciliationRowExclusion,
  saveReconciliationRowExplanation,
  type ReconciliationRowPreviousState,
} from '@/lib/bookkeeping-review/reconciliation-row-mutations'
import { cn } from '@/lib/utils'

const disabledActionNote = 'Slice 2b 전까지 저장·확정이 비활성화됩니다.'
let latestUndoToastSequence = 0

// Shallow undo (Brief 41 §0.4): the toast's own action button is the undo
// affordance — no separate audit-log UI. Only the most recently shown
// undo toast is actionable, which naturally limits this to "the latest
// apply/confirm action in the current session."
function showUndoableSuccessToast(params: {
  message: string
  uploadSessionId: string
  rowId: string
  previous: ReconciliationRowPreviousState | null
  router: { refresh: () => void }
}) {
  const undoSequence = latestUndoToastSequence + 1
  latestUndoToastSequence = undoSequence

  if (!params.previous) {
    toast.success(params.message)
    return
  }

  const previous = params.previous
  toast.success(params.message, {
    action: {
      label: '되돌리기',
      onClick: () => {
        if (undoSequence !== latestUndoToastSequence) {
          toast.error('가장 최근 작업만 되돌릴 수 있습니다.')
          return
        }

        void revertReconciliationRowState({
          uploadSessionId: params.uploadSessionId,
          rowId: params.rowId,
          previous,
        }).then((result) => {
          if (!result.ok) {
            toast.error(result.message)
            return
          }
          latestUndoToastSequence += 1
          toast.success('되돌렸습니다.')
          params.router.refresh()
        })
      },
    },
  })
}

type Tone = 'ok' | 'warn' | 'danger' | 'muted'

const chipClass: Record<Tone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
}

export interface ReconciliationEvidenceCellProps {
  readonly onOpenEvidencePicker: (source: EvidenceFinderSource) => void
  readonly onOpenExplanation: () => void
  readonly onViewLinkedEvidence: () => void
  readonly row: ReconciliationLedgerRow
}

export function ReconciliationEvidenceCell({
  onOpenEvidencePicker,
  onOpenExplanation,
  onViewLinkedEvidence,
  row,
}: ReconciliationEvidenceCellProps) {
  const statusChip = evidenceActionChipLabel(row.evidenceActionState)
  const showEvidenceFinder = shouldShowEvidenceFinder(row)

  return (
    <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      {row.evidenceActionState === 'explanation_required' ? (
        <button
          className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-2 py-1 text-[11.5px] font-semibold text-[#dc2626] hover:bg-[#fee2e2]"
          onClick={onOpenExplanation}
          type="button"
        >
          소명 입력
        </button>
      ) : row.evidenceActionState === 'linked' && statusChip ? (
        <button
          className={cn(
            'inline-flex rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold hover:opacity-90',
            chipClass[statusChip.tone],
          )}
          onClick={onViewLinkedEvidence}
          type="button"
        >
          {statusChip.label}
        </button>
      ) : statusChip ? (
        <StatusChip tone={statusChip.tone}>{statusChip.label}</StatusChip>
      ) : null}

      {row.rowConclusion.primaryAction === 'open_source_collection' ? (
        <Link
          className="text-[11.5px] font-semibold text-[#2563eb] hover:underline"
          href="/dashboard/direct-upload?period=2026-q1&source=tax_invoice"
        >
          자료수집
        </Link>
      ) : null}

      {showEvidenceFinder ? (
        <EvidenceFinderDropdown
          label={evidenceFinderActionLabel(row)}
          onOpenEvidencePicker={onOpenEvidencePicker}
        />
      ) : null}
    </div>
  )
}

function EvidenceFinderDropdown({
  label,
  onOpenEvidencePicker,
}: {
  readonly label: string
  readonly onOpenEvidencePicker: (source: EvidenceFinderSource) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-auto w-fit items-center gap-1 rounded-md border border-company-border bg-company-surface px-2 py-1 text-[11.5px] font-semibold text-foreground hover:bg-company-nav-hover"
        onClick={(event) => event.stopPropagation()}
      >
        {label}
        <ChevronDown className="size-3 text-company-fg-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {evidenceFinderSourceOptions.map((option) => (
          <DropdownMenuItem
            key={option.source}
            onClick={() => onOpenEvidencePicker(option.source)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export interface ReconciliationAccountSelectorProps {
  readonly isFixtureMode: boolean
  readonly onOpenExclusion: () => void
  readonly row: ReconciliationLedgerRow
}

export function ReconciliationAccountSelector({ isFixtureMode, onOpenExclusion, row }: ReconciliationAccountSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const accountKey = row.finalAccount ?? row.recommendedAccount
  const displayAccount = labelForBookkeepingAccountCategory(accountKey) || '계정 미정'
  const hasRecommendation = Boolean(row.recommendedAccount) && !row.finalAccount
  const groups = useMemo(() => filterReconciliationFixtureAccountGroups(query), [query])
  const isExcluded = row.evidenceActionState === 'excluded'
  const confirmDisabled = isFixtureMode || isPending || isExcluded
  const confirmDisabledTitle = isExcluded
    ? '제외된 거래입니다. 계정 확정 전에 제외를 먼저 해제해주세요.'
    : disabledActionNote

  function confirmAccount(selectedKey: string) {
    startTransition(async () => {
      const result = await confirmReconciliationRowAccount({
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        accountKey: selectedKey,
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      showUndoableSuccessToast({
        message: '계정항목을 확정했습니다.',
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        previous: result.previous,
        router,
      })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        className="inline-flex min-w-[128px] items-center justify-between gap-2 rounded-md border border-company-border bg-[#fcfcfd] px-2 py-1 text-left text-[12px] hover:bg-company-nav-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="inline-flex items-center gap-1 truncate font-medium text-foreground">
          {hasRecommendation ? <Sparkles className="size-3 shrink-0 text-[#d97706]" /> : null}
          {displayAccount}
        </span>
        <ChevronDown className="size-3 shrink-0 text-company-fg-muted" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(320px,calc(100vw-2rem))] gap-0 p-0"
        side="bottom"
      >
        <div className="border-b border-company-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-company-fg-muted" />
            <input
              aria-label="계정 검색"
              className="w-full rounded-md border border-company-border bg-company-surface py-2 pr-2 pl-8 text-[12.5px] outline-none focus:border-[#93c5fd]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="계정 검색..."
              value={query}
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-auto p-2">
          {groups.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="px-2 py-1 text-[11px] font-semibold text-company-fg-subtle">{group.label}</p>
              <div className="grid gap-0.5">
                {group.accounts.map((account) => (
                  <button
                    key={`${group.label}-${account.key}`}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-company-nav-hover',
                      account.key === accountKey ? 'bg-[#eff6ff] font-semibold text-[#1d4ed8]' : 'text-foreground',
                      confirmDisabled ? 'cursor-not-allowed opacity-60' : '',
                    )}
                    disabled={confirmDisabled}
                    onClick={() => confirmAccount(account.key)}
                    title={confirmDisabled ? confirmDisabledTitle : undefined}
                    type="button"
                  >
                    {account.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-company-border p-2">
          <button
            className="flex-1 cursor-not-allowed rounded-md border border-company-border px-2 py-1.5 text-[11.5px] font-semibold text-company-fg-subtle"
            disabled
            title={disabledActionNote}
            type="button"
          >
            + 계정 추가
          </button>
          <button
            className="flex-1 cursor-not-allowed rounded-md border border-company-border px-2 py-1.5 text-[11.5px] font-semibold text-company-fg-subtle"
            disabled
            title={disabledActionNote}
            type="button"
          >
            거래내역 분할
          </button>
        </div>
        {isExcluded ? null : (
          <div className="border-t border-company-border p-2">
            <button
              className={cn(
                'w-full rounded-md border px-2 py-1.5 text-[11.5px] font-semibold',
                isFixtureMode
                  ? 'cursor-not-allowed border-company-border text-company-fg-subtle'
                  : 'border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]',
              )}
              disabled={isFixtureMode}
              onClick={() => {
                setOpen(false)
                onOpenExclusion()
              }}
              title={isFixtureMode ? disabledActionNote : undefined}
              type="button"
            >
              제외 처리
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export interface ReconciliationLinkedEvidenceModalProps {
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly row: ReconciliationLedgerRow | null
}

export function ReconciliationLinkedEvidenceModal({
  onOpenChange,
  open,
  row,
}: ReconciliationLinkedEvidenceModalProps) {
  const linkedEvidence = useMemo(
    () => (row ? resolveLinkedEvidenceDisplay(row) : []),
    [row],
  )

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex w-full max-w-lg flex-col gap-0 overflow-hidden border-company-border bg-company-surface p-0 sm:max-w-lg">
        {row ? (
          <>
            <DialogHeader className="border-b border-company-border px-5 py-4 pr-12">
              <DialogTitle className="text-base font-semibold text-foreground">연결된 증빙</DialogTitle>
              <DialogDescription className="text-[13px] text-company-fg-muted">
                {row.counterparty ?? '거래처 미정'} · {formatKrwAmount(row.amountKrw)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 py-4">
              {linkedEvidence.map((evidence) => (
                <div
                  key={`${evidence.source}-${evidence.date}-${evidence.amountKrw}`}
                  className="rounded-[10px] border border-company-border bg-[#fcfcfd] px-3 py-3"
                >
                  <p className="text-[12px] font-semibold text-foreground">
                    {evidence.sourceLabel} · {formatKrwAmount(evidence.amountKrw)}
                  </p>
                  <p className="mt-1 text-[12px] text-company-fg-muted">
                    {evidence.counterparty ?? '거래처 미정'}
                    {evidence.date ? ` · ${evidence.date.slice(5, 10)}` : ''}
                  </p>
                  {evidence.description ? (
                    <p className="mt-1 text-[12px] text-company-fg-subtle">{evidence.description}</p>
                  ) : null}
                  {evidence.basisLabel ? (
                    <p className="mt-1 text-[11px] text-company-fg-subtle">{evidence.basisLabel}</p>
                  ) : null}
                </div>
              ))}
            </div>
            <DialogFooter className="border-t border-company-border bg-[#fcfcfd] px-5 py-3 sm:justify-end">
              <button
                className="rounded-lg border border-company-border px-3 py-2 text-[12px] font-semibold text-company-fg-muted"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                닫기
              </button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export interface ReconciliationEvidencePickerModalProps {
  readonly allRows: ReconciliationLedgerRow[]
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly row: ReconciliationLedgerRow | null
  readonly source: EvidenceFinderSource | null
}

export function ReconciliationEvidencePickerModal({
  allRows,
  onOpenChange,
  open,
  row,
  source,
}: ReconciliationEvidencePickerModalProps) {
  const [query, setQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const browseRows = useMemo(
    () => (row && source ? listEvidenceFinderBrowseRows(allRows, source, row.id) : []),
    [allRows, row, source],
  )
  const filteredBrowseRows = useMemo(
    () => filterEvidenceFinderBrowseRows(browseRows, { query, date: dateFilter }),
    [browseRows, query, dateFilter],
  )
  const remainingDifferenceKrw = useMemo(
    () => (row ? computeRemainingDifferenceKrw(row.amountKrw, row.candidates) : null),
    [row],
  )
  const sourceLabel = evidenceFinderSourceOptions.find((option) => option.source === source)?.label ?? '증빙'
  const hasAiCandidates = useMemo(
    () => (row ? hasEvidenceFinderAiMatch(row.candidates, browseRows) : false),
    [browseRows, row],
  )

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setQuery('')
          setDateFilter('')
        }
        onOpenChange(nextOpen)
      }}
      open={open}
    >
      <DialogContent className="flex max-h-[min(88vh,760px)] w-full max-w-3xl flex-col gap-0 overflow-hidden border-company-border bg-company-surface p-0 sm:max-w-3xl">
        {row && source ? (
          <>
            <DialogHeader className="border-b border-company-border px-5 py-4 pr-12">
              <DialogTitle className="text-base font-semibold text-foreground">{sourceLabel} 선택</DialogTitle>
              <DialogDescription className="text-[13px] text-company-fg-muted">
                {row.counterparty ?? '거래처 미정'} · {formatKrwAmount(row.amountKrw)} · {row.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 overflow-auto px-5 py-4">
              {hasAiCandidates ? (
                <p className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-[12px] text-[#1d4ed8]">
                  AI가 아래 목록에서 후보를 찾았습니다 — <span className="font-semibold">AI 추천</span> 배지가 붙은 행을 확인하세요.
                </p>
              ) : (
                <p className="rounded-lg border border-company-border bg-company-nav-hover px-3 py-2 text-[12px] text-company-fg-muted">
                  AI가 찾은 후보가 없습니다 — 목록에서 직접 찾아주세요.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label="증빙 검색"
                  className="min-w-[180px] flex-1 rounded-lg border border-company-border bg-company-surface px-2.5 py-2 text-[12px] text-foreground outline-none focus:border-[#93c5fd]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="거래처, 금액, 품목"
                  value={query}
                />
                <input
                  aria-label="증빙 일자"
                  className="w-[120px] rounded-lg border border-company-border bg-company-surface px-2.5 py-2 text-[12px] text-foreground outline-none focus:border-[#93c5fd]"
                  onChange={(event) => setDateFilter(event.target.value)}
                  placeholder="일자 (YYYY-MM-DD)"
                  value={dateFilter}
                />
              </div>
              <div className="overflow-hidden rounded-[10px] border border-company-border">
                <table className="w-full border-collapse text-left text-[12px]">
                  <thead className="bg-[#fafafa] text-[11px] font-semibold text-company-fg-subtle">
                    <tr className="border-b border-company-border">
                      <th className="px-3 py-2">일자</th>
                      <th className="px-3 py-2">거래처</th>
                      <th className="px-3 py-2">적요</th>
                      <th className="px-3 py-2 text-right">금액</th>
                      <th className="px-3 py-2">선택</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBrowseRows.length > 0 ? (
                      filteredBrowseRows.map((browseRow) => {
                        const matchedCandidate = row
                          ? resolveEvidenceFinderRowMatch(row.candidates, browseRow.id)
                          : null

                        return (
                          <tr
                            key={browseRow.id}
                            className={cn(
                              'border-b border-company-border last:border-b-0',
                              matchedCandidate ? 'bg-[#eff6ff]' : '',
                            )}
                          >
                            <td className="px-3 py-2 font-mono text-company-fg-muted">
                              {browseRow.transactionDate?.slice(5, 10) ?? '-'}
                            </td>
                            <td className="max-w-[120px] truncate px-3 py-2">
                              <span className="inline-flex items-center gap-1.5">
                                {matchedCandidate ? (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#bfdbfe] bg-[#dbeafe] px-1.5 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                                    <Sparkles className="size-2.5" />
                                    AI 추천
                                  </span>
                                ) : null}
                                <span className="truncate">{browseRow.counterparty ?? '-'}</span>
                              </span>
                            </td>
                            <td className="max-w-[160px] truncate px-3 py-2">
                              {browseRow.description}
                              {matchedCandidate ? (
                                <span className="mt-0.5 block text-[10.5px] font-medium text-[#1d4ed8]">
                                  {matchCandidateReasonLabel(matchedCandidate.reason)}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{formatKrwAmount(browseRow.amountKrw)}</td>
                            <td className="px-3 py-2">
                              <button
                                className="cursor-not-allowed rounded border border-company-border px-2 py-0.5 text-[11px] font-semibold text-company-fg-subtle"
                                disabled
                                title={disabledActionNote}
                                type="button"
                              >
                                선택
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td className="px-3 py-8 text-center text-company-fg-muted" colSpan={5}>
                          {browseRows.length > 0 ? '검색 조건에 맞는 항목이 없습니다.' : '해당 출처의 browse fixture가 없습니다.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-[12px] text-company-fg-muted">
                <span>선택 합계 0원</span>
                <span>{formatRemainingDifferenceLabel(remainingDifferenceKrw)}</span>
              </div>
            </div>
            <DialogFooter className="border-t border-company-border bg-[#fcfcfd] px-5 py-3 sm:justify-between">
              <button
                className="rounded-lg border border-company-border px-3 py-2 text-[12px] font-semibold text-company-fg-muted"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                취소
              </button>
              <button
                className="cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-3 py-2 text-[12px] font-semibold text-company-fg-subtle"
                disabled
                title={disabledActionNote}
                type="button"
              >
                연결 저장
              </button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export interface ReconciliationExplanationModalProps {
  readonly isFixtureMode: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly row: ReconciliationLedgerRow | null
}

export function ReconciliationExplanationModal({
  isFixtureMode,
  onOpenChange,
  open,
  row,
}: ReconciliationExplanationModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState(row?.explanationMemo ?? '')
  const saveDisabled = isFixtureMode || isPending || draft.trim().length === 0

  function saveExplanation() {
    if (!row) return
    startTransition(async () => {
      const result = await saveReconciliationRowExplanation({
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        memo: draft.trim(),
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      showUndoableSuccessToast({
        message: '소명 내용을 저장했습니다.',
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        previous: result.previous,
        router,
      })
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (nextOpen && row) {
          setDraft(row.explanationMemo ?? '')
        }
        onOpenChange(nextOpen)
      }}
      open={open}
    >
      <DialogContent className="flex w-full max-w-lg flex-col gap-0 overflow-hidden border-company-border bg-company-surface p-0 sm:max-w-lg">
        {row ? (
          <>
            <DialogHeader className="border-b border-company-border px-5 py-4 pr-12">
              <DialogTitle className="text-base font-semibold text-foreground">소명 입력</DialogTitle>
              <DialogDescription className="text-[13px] text-company-fg-muted">
                {row.counterparty ?? '거래처 미정'} · {formatKrwAmount(row.amountKrw)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-[10px] border border-company-border bg-[#fcfcfd] px-3 py-2 text-[12px] text-company-fg-muted">
                <p className="font-medium text-foreground">{row.description}</p>
                <p className="mt-1">{row.rowConclusion.basisLabel}</p>
              </div>
              <label className="block">
                <span className="text-[12px] font-semibold text-foreground">업무 사용 목적 · 소명 내용</span>
                <textarea
                  className="mt-1.5 min-h-[120px] w-full resize-y rounded-lg border border-company-border bg-company-surface px-3 py-2 text-[13px] outline-none focus:border-[#93c5fd]"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="예: 해외 SaaS 협업 도구 구독료, 개발팀 업무용"
                  value={draft}
                />
              </label>
            </div>
            <DialogFooter className="border-t border-company-border bg-[#fcfcfd] px-5 py-3 sm:justify-between">
              <button
                className="rounded-lg border border-company-border px-3 py-2 text-[12px] font-semibold text-company-fg-muted"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                취소
              </button>
              <button
                className={cn(
                  'rounded-lg border border-company-border px-3 py-2 text-[12px] font-semibold',
                  saveDisabled
                    ? 'cursor-not-allowed bg-company-nav-hover text-company-fg-subtle'
                    : 'bg-foreground text-background hover:opacity-90',
                )}
                disabled={saveDisabled}
                onClick={saveExplanation}
                title={isFixtureMode ? disabledActionNote : undefined}
                type="button"
              >
                저장
              </button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export interface ReconciliationExclusionModalProps {
  readonly isFixtureMode: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly row: ReconciliationLedgerRow | null
}

export function ReconciliationExclusionModal({
  isFixtureMode,
  onOpenChange,
  open,
  row,
}: ReconciliationExclusionModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState('')
  const saveDisabled = isFixtureMode || isPending || draft.trim().length === 0

  function saveExclusion() {
    if (!row) return
    startTransition(async () => {
      const result = await saveReconciliationRowExclusion({
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        memo: formatExclusionReasonMemo(draft),
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      showUndoableSuccessToast({
        message: '거래를 제외 처리했습니다.',
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        previous: result.previous,
        router,
      })
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setDraft('')
        }
        onOpenChange(nextOpen)
      }}
      open={open}
    >
      <DialogContent className="flex w-full max-w-lg flex-col gap-0 overflow-hidden border-company-border bg-company-surface p-0 sm:max-w-lg">
        {row ? (
          <>
            <DialogHeader className="border-b border-company-border px-5 py-4 pr-12">
              <DialogTitle className="text-base font-semibold text-foreground">제외 처리</DialogTitle>
              <DialogDescription className="text-[13px] text-company-fg-muted">
                {row.counterparty ?? '거래처 미정'} · {formatKrwAmount(row.amountKrw)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-[10px] border border-company-border bg-[#fcfcfd] px-3 py-2 text-[12px] text-company-fg-muted">
                <p className="font-medium text-foreground">{row.description}</p>
                <p className="mt-1">이 거래를 장부 대조 대상에서 제외합니다. 사유는 감사·되돌리기를 위해 함께 저장됩니다.</p>
              </div>
              <label className="block">
                <span className="text-[12px] font-semibold text-foreground">제외 사유</span>
                <textarea
                  className="mt-1.5 min-h-[100px] w-full resize-y rounded-lg border border-company-border bg-company-surface px-3 py-2 text-[13px] outline-none focus:border-[#93c5fd]"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="예: 개인 사용 - 영화 관람"
                  value={draft}
                />
                <span className="mt-1 block text-[11.5px] text-company-fg-subtle">
                  저장 시 &quot;제외 사유: {draft.trim() || '...'}&quot; 형식으로 기록됩니다.
                </span>
              </label>
            </div>
            <DialogFooter className="border-t border-company-border bg-[#fcfcfd] px-5 py-3 sm:justify-between">
              <button
                className="rounded-lg border border-company-border px-3 py-2 text-[12px] font-semibold text-company-fg-muted"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                취소
              </button>
              <button
                className={cn(
                  'rounded-lg border px-3 py-2 text-[12px] font-semibold',
                  saveDisabled
                    ? 'cursor-not-allowed border-company-border bg-company-nav-hover text-company-fg-subtle'
                    : 'border-[#fecaca] bg-[#dc2626] text-white hover:opacity-90',
                )}
                disabled={saveDisabled}
                onClick={saveExclusion}
                title={isFixtureMode ? disabledActionNote : undefined}
                type="button"
              >
                제외 처리
              </button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function StatusChip({ tone, children }: { readonly tone: Tone; readonly children: ReactNode }) {
  return (
    <span className={cn('inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold', chipClass[tone])}>
      {children}
    </span>
  )
}
