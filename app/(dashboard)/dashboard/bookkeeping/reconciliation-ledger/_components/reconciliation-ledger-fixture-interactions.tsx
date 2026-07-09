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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { labelForBookkeepingAccountCategory } from '@/lib/bookkeeping/account-categories'
import { filterReconciliationFixtureAccountGroups } from '@/lib/bookkeeping-review/reconciliation-fixture-account-options'
import type { ReconciliationBatchSuggestionGroup, ReconciliationLedgerRow } from '@/lib/bookkeeping-review/reconciliation-display-model'
import {
  computeRemainingDifferenceKrw,
  confidenceLabel,
  evidenceActionChipLabel,
  evidenceFinderActionLabel,
  evidenceFinderSourceForLinkedEvidence,
  evidenceFinderSourceOptions,
  evidenceSourceLabel,
  exclusionReasonLabel,
  filterEvidenceFinderBrowseRows,
  formatEvidenceExceptionMemo,
  formatExclusionReasonMemo,
  formatKrwAmount,
  patternSuggestionReasonLabel,
  formatRemainingDifferenceLabel,
  hasDifferentAbsoluteAmount,
  hasEvidenceFinderAmountDifference,
  hasEvidenceFinderAiMatch,
  isAmountDifferenceEvidenceReference,
  isFoundEvidenceReference,
  isSavedEvidenceReference,
  listEvidenceFinderBrowseRows,
  matchCandidateReasonLabel,
  resolveEvidenceFinderRowMatch,
  resolveLinkedEvidenceDisplay,
  shouldShowEvidenceFinder,
  type EvidenceFinderSource,
} from '@/lib/bookkeeping-review/reconciliation-row-actions'
import { formatPatternRejectionMemo } from '@/lib/bookkeeping-review/reconciliation-pattern-suggestions'
import {
  confirmReconciliationRowAccount,
  connectReconciliationRowEvidence,
  disconnectReconciliationRowEvidence,
  rejectReconciliationRowPatternSuggestion,
  revertReconciliationRowState,
  saveReconciliationRowExclusion,
  saveReconciliationRowEvidenceException,
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

type BatchUndoEntry = {
  readonly previous: ReconciliationRowPreviousState | null
  readonly rowId: string
  readonly uploadSessionId: string
}

function showBatchUndoableSuccessToast(params: {
  message: string
  entries: readonly BatchUndoEntry[]
  router: { refresh: () => void }
}) {
  const undoableEntries = params.entries.filter((entry) => entry.previous !== null)
  const undoSequence = latestUndoToastSequence + 1
  latestUndoToastSequence = undoSequence

  if (undoableEntries.length === 0) {
    toast.success(params.message)
    return
  }

  toast.success(params.message, {
    action: {
      label: '되돌리기',
      onClick: () => {
        if (undoSequence !== latestUndoToastSequence) {
          toast.error('가장 최근 작업만 되돌릴 수 있습니다.')
          return
        }

        void Promise.all(undoableEntries.map((entry) => {
          return revertReconciliationRowState({
            uploadSessionId: entry.uploadSessionId,
            rowId: entry.rowId,
            previous: entry.previous!,
          })
        })).then((results) => {
          const failed = results.find((result) => !result.ok)
          if (failed) {
            toast.error(failed.message)
            return
          }
          latestUndoToastSequence += 1
          toast.success('일괄 적용을 되돌렸습니다.')
          params.router.refresh()
        })
      },
    },
  })
}

type SafeAccountBatchGroup = {
  readonly accountKey: string
  readonly accountLabel: string
  readonly group: ReconciliationBatchSuggestionGroup
  readonly rows: readonly ReconciliationLedgerRow[]
}

function resolveSafeAccountBatchGroups(
  groups: readonly ReconciliationBatchSuggestionGroup[],
  rows: readonly ReconciliationLedgerRow[],
): SafeAccountBatchGroup[] {
  const rowsById = new Map(rows.map((row) => [row.id, row]))

  return groups.flatMap((group) => {
    if (group.suggestedAction !== 'apply_account') return []
    if (group.eligibility !== 'safe_to_offer') return []
    if (!group.requiresUserConfirmation) return []

    const groupRows = group.rowIds.map((rowId) => rowsById.get(rowId)).filter((row): row is ReconciliationLedgerRow => Boolean(row))
    if (groupRows.length !== group.rowIds.length || groupRows.length < 2) return []

    const accountKey = groupRows[0]?.patternSuggestion?.suggestedAccount ?? null
    if (!accountKey) return []
    if (!groupRows.every((row) => row.patternSuggestion?.suggestedAccount === accountKey)) return []
    if (!groupRows.every((row) => row.actions.canConfirmAccount && !row.finalAccount && row.evidenceActionState !== 'excluded')) return []

    const accountLabel = labelForBookkeepingAccountCategory(accountKey)
    if (!accountLabel) return []

    return [{ accountKey, accountLabel, group, rows: groupRows }]
  })
}

export interface ReconciliationBatchSuggestionBarProps {
  readonly groups: readonly ReconciliationBatchSuggestionGroup[]
  readonly isFixtureMode: boolean
  readonly rows: readonly ReconciliationLedgerRow[]
}

export function ReconciliationBatchSuggestionBar({ groups, isFixtureMode, rows }: ReconciliationBatchSuggestionBarProps) {
  const router = useRouter()
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const safeGroups = useMemo(() => resolveSafeAccountBatchGroups(groups, rows), [groups, rows])
  const selectedGroup = safeGroups.find((entry) => entry.group.id === selectedGroupId) ?? null

  if (safeGroups.length === 0) return null

  function applySelectedGroup() {
    if (!selectedGroup || isFixtureMode) return

    startTransition(async () => {
      const undoEntries: BatchUndoEntry[] = []
      for (const row of selectedGroup.rows) {
        const result = await confirmReconciliationRowAccount({
          uploadSessionId: row.uploadSessionId,
          rowId: row.id,
          accountKey: selectedGroup.accountKey,
        })
        if (!result.ok) {
          if (undoEntries.length > 0) {
            showBatchUndoableSuccessToast({
              message: `${undoEntries.length}건 적용 후 중단되었습니다.`,
              entries: undoEntries,
              router,
            })
            router.refresh()
          }
          toast.error(result.message)
          return
        }
        undoEntries.push({ uploadSessionId: row.uploadSessionId, rowId: row.id, previous: result.previous })
      }

      setSelectedGroupId(null)
      showBatchUndoableSuccessToast({
        message: `${selectedGroup.rows.length}건을 ${selectedGroup.accountLabel}로 확정했습니다.`,
        entries: undoEntries,
        router,
      })
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <p className="text-[12.5px] font-semibold text-[#92400e]">반복 패턴 일괄 제안</p>
          <p className="mt-0.5 text-[11.5px] text-[#b45309]">
            같은 거래처·같은 근거·같은 계정 추천만 묶습니다. 적용 전 대상 행을 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {safeGroups.map((entry) => (
            <button
              key={entry.group.id}
              className="rounded-lg border border-[#fde68a] bg-company-surface px-2.5 py-1.5 text-left text-[12px] font-semibold text-foreground hover:bg-[#fff7ed]"
              onClick={() => setSelectedGroupId(entry.group.id)}
              type="button"
            >
              <span className="block">{entry.accountLabel} · {entry.rows.length}건</span>
              <span className="block max-w-[260px] truncate text-[11px] font-medium text-company-fg-muted">{entry.group.basisLabel}</span>
            </button>
          ))}
        </div>
      </div>

      <Dialog onOpenChange={(open) => !open && setSelectedGroupId(null)} open={selectedGroup !== null}>
        <DialogContent className="max-w-[720px]">
          <DialogHeader>
            <DialogTitle>계정 패턴 일괄 적용</DialogTitle>
            <DialogDescription>
              {selectedGroup
                ? `${selectedGroup.rows.length}건을 ${selectedGroup.accountLabel}로 확정합니다. 자동 적용이 아니며 확인 후 저장됩니다.`
                : '반복 패턴 대상 행을 확인합니다.'}
            </DialogDescription>
          </DialogHeader>
          {selectedGroup ? (
            <div className="max-h-[360px] overflow-auto rounded-lg border border-company-border">
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead className="sticky top-0 bg-company-nav-hover text-[11px] text-company-fg-subtle">
                  <tr>
                    <th className="px-3 py-2 font-semibold">거래일</th>
                    <th className="px-3 py-2 font-semibold">거래처</th>
                    <th className="px-3 py-2 text-right font-semibold">금액</th>
                    <th className="px-3 py-2 font-semibold">적용 계정</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGroup.rows.map((row) => (
                    <tr key={row.id} className="border-t border-company-border">
                      <td className="px-3 py-2 font-mono text-company-fg-muted">{row.transactionDate ? row.transactionDate.slice(5, 10) : '-'}</td>
                      <td className="px-3 py-2 font-semibold text-foreground">{row.counterparty ?? '거래처 미정'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">{formatKrwAmount(row.amountKrw)}</td>
                      <td className="px-3 py-2 text-company-fg-muted">{selectedGroup.accountLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <DialogFooter>
            <button
              className="rounded-lg border border-company-border px-3 py-2 text-[12px] font-semibold text-company-fg-muted hover:bg-company-nav-hover"
              disabled={isPending}
              onClick={() => setSelectedGroupId(null)}
              type="button"
            >
              취소
            </button>
            <button
              className={cn(
                'rounded-lg border px-3 py-2 text-[12px] font-semibold',
                isFixtureMode || isPending
                  ? 'cursor-not-allowed border-company-border bg-company-nav-hover text-company-fg-subtle'
                  : 'border-[#d97706] bg-[#d97706] text-white hover:opacity-90',
              )}
              disabled={isFixtureMode || isPending || !selectedGroup}
              onClick={applySelectedGroup}
              title={isFixtureMode ? disabledActionNote : undefined}
              type="button"
            >
              {isPending ? '적용 중...' : selectedGroup ? `${selectedGroup.rows.length}건 계정 확정` : '계정 확정'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
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
  readonly onOpenEvidenceException: () => void
  readonly onOpenFoundEvidence: (source: EvidenceFinderSource, evidenceRowId: string) => void
  readonly onOpenExplanation: () => void
  readonly row: ReconciliationLedgerRow
}

export function ReconciliationEvidenceCell({
  onOpenEvidencePicker,
  onOpenEvidenceException,
  onOpenFoundEvidence,
  onOpenExplanation,
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
          onOpenEvidenceException={onOpenEvidenceException}
          onOpenEvidencePicker={onOpenEvidencePicker}
          onOpenFoundEvidence={onOpenFoundEvidence}
          row={row}
        />
      ) : null}
    </div>
  )
}

function EvidenceFinderDropdown({
  label,
  onOpenEvidencePicker,
  onOpenEvidenceException,
  onOpenFoundEvidence,
  row,
}: {
  readonly label: string
  readonly onOpenEvidenceException: () => void
  readonly onOpenEvidencePicker: (source: EvidenceFinderSource) => void
  readonly onOpenFoundEvidence: (source: EvidenceFinderSource, evidenceRowId: string) => void
  readonly row: ReconciliationLedgerRow
}) {
  const foundEvidence = resolveLinkedEvidenceDisplay(row).find((evidence) => {
    if (!evidence.rowId) return false
    return evidenceFinderSourceForLinkedEvidence(evidence.source) !== null
  })
  const foundEvidenceSource = foundEvidence
    ? evidenceFinderSourceForLinkedEvidence(foundEvidence.source)
    : null
  const suggestedEvidenceSource = row.patternSuggestion?.suggestedEvidenceSource ?? null
  const suggestedFinderSource = suggestedEvidenceSource
    ? evidenceFinderSourceForLinkedEvidence(suggestedEvidenceSource)
    : null
  const sourceOptions = suggestedFinderSource
    ? [...evidenceFinderSourceOptions].sort((a, b) => Number(b.source === suggestedFinderSource) - Number(a.source === suggestedFinderSource))
    : evidenceFinderSourceOptions
  const canMarkEvidenceException = row.source === 'bank'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-auto w-fit items-center gap-1 rounded-md border border-company-border bg-company-surface px-2 py-1 text-[11.5px] font-semibold text-foreground hover:bg-company-nav-hover"
        onClick={(event) => event.stopPropagation()}
      >
        {label}
        <ChevronDown className="size-3 text-company-fg-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[260px]">
        {foundEvidence && foundEvidenceSource ? (
          <>
            <DropdownMenuItem
              className="block px-2 py-2"
              onClick={() => onOpenFoundEvidence(foundEvidenceSource, foundEvidence.rowId!)}
            >
              <span className="block text-[11px] font-semibold text-[#16a34a]">찾은 증빙</span>
              <span className="mt-0.5 block truncate text-[12px] font-semibold text-foreground">
                {foundEvidence.sourceLabel}
                {' · '}
                {foundEvidence.counterparty ?? '거래처 미정'}
                {' · '}
                {formatKrwAmount(foundEvidence.amountKrw)}
                {foundEvidence.date ? ` · ${foundEvidence.date.slice(5, 10)}` : ''}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {!foundEvidence && suggestedEvidenceSource && suggestedFinderSource ? (
          <>
            <div className="px-2 py-2 text-[12px]">
              <span className="block text-[11px] font-semibold text-[#b45309]">반복 증빙 패턴</span>
              <span className="mt-0.5 block text-company-fg-muted">
                {evidenceSourceLabel(suggestedEvidenceSource)} · {row.patternSuggestion?.basisLabel}
              </span>
            </div>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {canMarkEvidenceException ? (
          <>
            <DropdownMenuItem onClick={onOpenEvidenceException}>
              증빙 예외 처리
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {sourceOptions.map((option) => (
          <DropdownMenuItem
            key={option.source}
            onClick={() => onOpenEvidencePicker(option.source)}
          >
            <span className="inline-flex w-full items-center justify-between gap-3">
              <span>{option.label}</span>
              {option.source === suggestedFinderSource ? (
                <span className="rounded-full border border-[#fde68a] bg-[#fffbeb] px-1.5 py-0.5 text-[10px] font-semibold text-[#b45309]">
                  반복 패턴
                </span>
              ) : null}
            </span>
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
  const patternAccountKey = row.patternSuggestion?.suggestedAccount ?? null
  const patternAccountLabel = labelForBookkeepingAccountCategory(patternAccountKey)
  const patternExclusionReason = row.patternSuggestion?.suggestedExclusionReason ?? null
  const patternExclusionLabel = exclusionReasonLabel(patternExclusionReason)
  const hasRecommendation = (Boolean(row.recommendedAccount) || Boolean(patternAccountKey)) && !row.finalAccount
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

  function rejectPatternSuggestion() {
    if (!row.patternSuggestion) return
    const rejectionMemo = formatPatternRejectionMemo(row.patternSuggestion.basisLabel)
    const existingMemo = row.explanationMemo?.trim()
    startTransition(async () => {
      const result = await rejectReconciliationRowPatternSuggestion({
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        memo: existingMemo ? `${existingMemo}\n${rejectionMemo}`.slice(0, 1000) : rejectionMemo,
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      showUndoableSuccessToast({
        message: '반복 패턴을 무시했습니다.',
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
        {row.patternSuggestion && patternAccountKey ? (
          <div className="border-b border-company-border bg-[#fffbeb] p-2">
            <div className="rounded-lg border border-[#fde68a] bg-company-surface p-2">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[#d97706]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[#b45309]">반복 패턴</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-foreground">{patternAccountLabel || patternAccountKey}</p>
                  <p className="mt-0.5 text-[11.5px] text-company-fg-muted">{row.patternSuggestion.basisLabel}</p>
                  <p className="mt-0.5 text-[11px] text-company-fg-subtle">
                    {patternSuggestionReasonLabel(row.patternSuggestion.reason)} · 신뢰도 {confidenceLabel(row.patternSuggestion.confidence)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  className={cn(
                    'flex-1 rounded-md border px-2 py-1.5 text-[11.5px] font-semibold',
                    confirmDisabled
                      ? 'cursor-not-allowed border-company-border text-company-fg-subtle'
                      : 'border-[#fde68a] bg-[#d97706] text-white hover:opacity-90',
                  )}
                  disabled={confirmDisabled}
                  onClick={() => confirmAccount(patternAccountKey)}
                  title={confirmDisabled ? confirmDisabledTitle : undefined}
                  type="button"
                >
                  패턴 적용
                </button>
                <button
                  className={cn(
                    'flex-1 rounded-md border px-2 py-1.5 text-[11.5px] font-semibold',
                    confirmDisabled
                      ? 'cursor-not-allowed border-company-border text-company-fg-subtle'
                      : 'border-company-border text-company-fg-muted hover:bg-company-nav-hover',
                  )}
                  disabled={confirmDisabled}
                  onClick={rejectPatternSuggestion}
                  title={confirmDisabled ? confirmDisabledTitle : undefined}
                  type="button"
                >
                  무시
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {row.patternSuggestion && patternExclusionReason && !isExcluded ? (
          <div className="border-b border-company-border bg-[#fff7f7] p-2">
            <div className="rounded-lg border border-[#fecaca] bg-company-surface p-2">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[#dc2626]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[#dc2626]">반복 제외 패턴</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-foreground">{patternExclusionLabel}</p>
                  <p className="mt-0.5 text-[11.5px] text-company-fg-muted">{row.patternSuggestion.basisLabel}</p>
                  <p className="mt-0.5 text-[11px] text-company-fg-subtle">
                    {patternSuggestionReasonLabel(row.patternSuggestion.reason)} · 신뢰도 {confidenceLabel(row.patternSuggestion.confidence)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  className={cn(
                    'flex-1 rounded-md border px-2 py-1.5 text-[11.5px] font-semibold',
                    confirmDisabled
                      ? 'cursor-not-allowed border-company-border text-company-fg-subtle'
                      : 'border-[#fecaca] bg-[#dc2626] text-white hover:opacity-90',
                  )}
                  disabled={confirmDisabled}
                  onClick={() => {
                    setOpen(false)
                    onOpenExclusion()
                  }}
                  title={confirmDisabled ? confirmDisabledTitle : undefined}
                  type="button"
                >
                  제외 사유 입력
                </button>
                <button
                  className={cn(
                    'flex-1 rounded-md border px-2 py-1.5 text-[11.5px] font-semibold',
                    confirmDisabled
                      ? 'cursor-not-allowed border-company-border text-company-fg-subtle'
                      : 'border-company-border text-company-fg-muted hover:bg-company-nav-hover',
                  )}
                  disabled={confirmDisabled}
                  onClick={rejectPatternSuggestion}
                  title={confirmDisabled ? confirmDisabledTitle : undefined}
                  type="button"
                >
                  무시
                </button>
              </div>
            </div>
          </div>
        ) : null}
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

export interface ReconciliationEvidencePickerModalProps {
  readonly allRows: ReconciliationLedgerRow[]
  readonly highlightedEvidenceRowId?: string | null
  readonly isFixtureMode: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly row: ReconciliationLedgerRow | null
  readonly source: EvidenceFinderSource | null
}

export function ReconciliationEvidencePickerModal({
  allRows,
  highlightedEvidenceRowId = null,
  isFixtureMode,
  onOpenChange,
  open,
  row,
  source,
}: ReconciliationEvidencePickerModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [connectingRowId, setConnectingRowId] = useState<string | null>(null)
  const [disconnectingRowId, setDisconnectingRowId] = useState<string | null>(null)
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
  const hasAmountDifferenceCandidates = useMemo(
    () => (row ? hasEvidenceFinderAmountDifference(row.candidates, browseRows) : false),
    [browseRows, row],
  )
  const highlightedCandidate = useMemo(
    () => (row && highlightedEvidenceRowId
      ? resolveEvidenceFinderRowMatch(row.candidates, highlightedEvidenceRowId)
      : null),
    [highlightedEvidenceRowId, row],
  )
  const highlightedIsSavedReference = isSavedEvidenceReference(highlightedCandidate)

  function connectEvidence(evidenceRowId: string) {
    if (!row) return
    setConnectingRowId(evidenceRowId)
    startTransition(async () => {
      const result = await connectReconciliationRowEvidence({
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        evidenceRowId,
      })
      setConnectingRowId(null)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      showUndoableSuccessToast({
        message: '증빙을 연결했습니다.',
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        previous: result.previous,
        router,
      })
      onOpenChange(false)
      router.refresh()
    })
  }

  function disconnectEvidence(evidenceRowId: string) {
    if (!row) return
    setDisconnectingRowId(evidenceRowId)
    startTransition(async () => {
      const result = await disconnectReconciliationRowEvidence({
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
      })
      setDisconnectingRowId(null)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      showUndoableSuccessToast({
        message: '증빙 연결을 해제했습니다.',
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
              {highlightedEvidenceRowId ? (
                <p className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-[12px] text-[#16a34a]">
                  {highlightedIsSavedReference
                    ? '현재 연결된 증빙 행을 아래 목록에서 강조했습니다.'
                    : '찾은 증빙 행을 아래 목록에서 강조했습니다.'}
                </p>
              ) : hasAmountDifferenceCandidates ? (
                <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12px] text-[#b45309]">
                  거래처·일자는 비슷하지만 금액이 다른 항목이 있습니다 — <span className="font-semibold">금액 차이</span> 배지가 붙은 행은 바로 연결할 수 없습니다.
                </p>
              ) : hasAiCandidates ? (
                <p className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-[12px] text-[#1d4ed8]">
                  AI가 아래 목록에서 증빙을 찾았습니다 — <span className="font-semibold">찾은 증빙</span> 배지가 붙은 행을 확인하세요.
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
                        const isHighlightedEvidence = highlightedEvidenceRowId === browseRow.id
                        const isConnectedEvidence = isHighlightedEvidence && isSavedEvidenceReference(matchedCandidate)
                        const isFoundEvidence = isFoundEvidenceReference(matchedCandidate)
                        const isAmountDifferenceEvidence = isAmountDifferenceEvidenceReference(matchedCandidate)
                          || hasDifferentAbsoluteAmount(row.amountKrw, browseRow.amountKrw)
                        const canConnectEvidence = !isAmountDifferenceEvidence

                        return (
                          <tr
                            key={browseRow.id}
                            className={cn(
                              'border-b border-company-border last:border-b-0',
                              isConnectedEvidence ? 'bg-[#f0fdf4] ring-1 ring-inset ring-[#86efac]' : '',
                              !isConnectedEvidence && (isHighlightedEvidence || isFoundEvidence) ? 'bg-[#eff6ff]' : '',
                              !isConnectedEvidence && !isFoundEvidence && isAmountDifferenceEvidence ? 'bg-[#fffbeb]' : '',
                            )}
                          >
                            <td className="px-3 py-2 font-mono text-company-fg-muted">
                              {browseRow.transactionDate?.slice(5, 10) ?? '-'}
                            </td>
                            <td className="max-w-[120px] truncate px-3 py-2">
                              <span className="inline-flex items-center gap-1.5">
                                {isConnectedEvidence ? (
                                  <span className="inline-flex shrink-0 items-center rounded-full border border-[#bbf7d0] bg-[#dcfce7] px-1.5 py-0.5 text-[10px] font-semibold text-[#16a34a]">
                                    연결됨
                                  </span>
                                ) : null}
                                {isFoundEvidence ? (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#bfdbfe] bg-[#dbeafe] px-1.5 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                                    <Sparkles className="size-2.5" />
                                    찾은 증빙
                                  </span>
                                ) : null}
                                {isAmountDifferenceEvidence ? (
                                  <span className="inline-flex shrink-0 items-center rounded-full border border-[#fde68a] bg-[#fef3c7] px-1.5 py-0.5 text-[10px] font-semibold text-[#b45309]">
                                    금액 차이
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
                              {isConnectedEvidence ? (
                                <button
                                  className={cn(
                                    'rounded border px-2 py-0.5 text-[11px] font-semibold',
                                    isFixtureMode || isPending
                                      ? 'cursor-not-allowed border-company-border text-company-fg-subtle'
                                      : 'border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]',
                                  )}
                                  disabled={isFixtureMode || isPending}
                                  onClick={() => disconnectEvidence(browseRow.id)}
                                  title={isFixtureMode ? disabledActionNote : undefined}
                                  type="button"
                                >
                                  {disconnectingRowId === browseRow.id ? '해제 중…' : '해제'}
                                </button>
                              ) : isAmountDifferenceEvidence ? (
                                <button
                                  className="cursor-not-allowed rounded border border-[#fde68a] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]"
                                  disabled
                                  title="금액이 달라 바로 증빙있음으로 연결할 수 없습니다."
                                  type="button"
                                >
                                  차액 확인
                                </button>
                              ) : (
                                <button
                                  className={cn(
                                    'rounded border px-2 py-0.5 text-[11px] font-semibold',
                                    isFixtureMode || isPending
                                      ? 'cursor-not-allowed border-company-border text-company-fg-subtle'
                                      : 'border-[#93c5fd] text-[#1d4ed8] hover:bg-[#eff6ff]',
                                  )}
                                  disabled={isFixtureMode || isPending || !canConnectEvidence}
                                  onClick={() => connectEvidence(browseRow.id)}
                                  title={isFixtureMode ? disabledActionNote : undefined}
                                  type="button"
                                >
                                  {connectingRowId === browseRow.id ? '연결 중…' : '선택'}
                                </button>
                              )}
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
              <p className="text-[12px] text-company-fg-muted">{formatRemainingDifferenceLabel(remainingDifferenceKrw)}</p>
            </div>
            <DialogFooter className="border-t border-company-border bg-[#fcfcfd] px-5 py-3">
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

const evidenceExceptionReasonOptions = [
  '내부이체',
  '대출',
  '세금 납부',
  '환불/취소',
  '이자/수수료',
  '보증금',
  '기타',
] as const

export interface ReconciliationEvidenceExceptionModalProps {
  readonly isFixtureMode: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly row: ReconciliationLedgerRow | null
}

export function ReconciliationEvidenceExceptionModal({
  isFixtureMode,
  onOpenChange,
  open,
  row,
}: ReconciliationEvidenceExceptionModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState<(typeof evidenceExceptionReasonOptions)[number]>('내부이체')
  const [draft, setDraft] = useState('')
  const saveDisabled = isFixtureMode || isPending || draft.trim().length === 0

  function saveEvidenceException() {
    if (!row) return
    startTransition(async () => {
      const result = await saveReconciliationRowEvidenceException({
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        memo: formatEvidenceExceptionMemo(`${reason} - ${draft.trim()}`),
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      showUndoableSuccessToast({
        message: '증빙 예외로 처리했습니다.',
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
          setReason('내부이체')
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
              <DialogTitle className="text-base font-semibold text-foreground">증빙 예외 처리</DialogTitle>
              <DialogDescription className="text-[13px] text-company-fg-muted">
                {row.counterparty ?? '거래처 미정'} · {formatKrwAmount(row.amountKrw)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-[10px] border border-company-border bg-[#fcfcfd] px-3 py-2 text-[12px] text-company-fg-muted">
                <p className="font-medium text-foreground">{row.description}</p>
                <p className="mt-1">내부이체·대출·세금 납부처럼 세금계산서/현금영수증/카드 매칭이 맞지 않는 거래만 예외로 처리합니다.</p>
              </div>
              <div>
                <span className="text-[12px] font-semibold text-foreground">예외 유형</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {evidenceExceptionReasonOptions.map((option) => (
                    <button
                      key={option}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11.5px] font-semibold',
                        reason === option
                          ? 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]'
                          : 'border-company-border bg-company-surface text-company-fg-muted hover:bg-company-nav-hover',
                      )}
                      onClick={() => setReason(option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-[12px] font-semibold text-foreground">예외 메모</span>
                <textarea
                  className="mt-1.5 min-h-[100px] w-full resize-y rounded-lg border border-company-border bg-company-surface px-3 py-2 text-[13px] outline-none focus:border-[#93c5fd]"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="예: 국민 9012 운영비 계좌에서 마이너스 한도 계좌로 이동"
                  value={draft}
                />
                <span className="mt-1 block text-[11.5px] text-company-fg-subtle">
                  저장 시 &quot;증빙 예외: {reason} - {draft.trim() || '...'}&quot; 형식으로 기록됩니다.
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
                    : 'border-[#fde68a] bg-[#d97706] text-white hover:opacity-90',
                )}
                disabled={saveDisabled}
                onClick={saveEvidenceException}
                title={isFixtureMode ? disabledActionNote : undefined}
                type="button"
              >
                증빙 예외 처리
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
  const suggestedExclusionReason = row?.patternSuggestion?.suggestedExclusionReason ?? null
  const suggestedExclusionDraft = exclusionReasonLabel(suggestedExclusionReason)
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
          setDraft(suggestedExclusionReason ? suggestedExclusionDraft : '')
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
              {suggestedExclusionReason ? (
                <div className="rounded-[10px] border border-[#fecaca] bg-[#fff7f7] px-3 py-2 text-[12px] text-[#dc2626]">
                  <p className="font-semibold">반복 제외 패턴 · {suggestedExclusionDraft}</p>
                  <p className="mt-1 text-[11.5px] text-[#991b1b]">{row.patternSuggestion?.basisLabel}</p>
                </div>
              ) : null}
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
