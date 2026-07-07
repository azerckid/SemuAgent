'use client'

import Link from 'next/link'
import { ChevronDown, Search, Sparkles } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
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
import { filterReconciliationFixtureAccountGroups } from '@/lib/bookkeeping-review/reconciliation-fixture-account-options'
import type { ReconciliationLedgerRow } from '@/lib/bookkeeping-review/reconciliation-display-model'
import {
  computeRemainingDifferenceKrw,
  evidenceActionChipLabel,
  evidenceFinderSourceOptions,
  formatKrwAmount,
  formatRemainingDifferenceLabel,
  listEvidenceFinderBrowseRows,
  resolveLinkedEvidenceDisplay,
  shouldShowEvidenceFinder,
  type EvidenceFinderSource,
} from '@/lib/bookkeeping-review/reconciliation-work-panel'
import { cn } from '@/lib/utils'

const disabledActionNote = 'Slice 2b 전까지 저장·확정이 비활성화됩니다.'

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
          className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-2 py-1 text-[11.5px] font-semibold text-[#b45309] hover:bg-[#fef3c7]"
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

      {row.workPanelConclusion.primaryAction === 'open_source_collection' ? (
        <Link
          className="text-[11.5px] font-semibold text-[#2563eb] hover:underline"
          href="/dashboard/direct-upload?period=2026-q1&source=tax_invoice"
        >
          자료수집
        </Link>
      ) : null}

      {showEvidenceFinder ? (
        <EvidenceFinderDropdown onOpenEvidencePicker={onOpenEvidencePicker} />
      ) : null}
    </div>
  )
}

function EvidenceFinderDropdown({
  onOpenEvidencePicker,
}: {
  readonly onOpenEvidencePicker: (source: EvidenceFinderSource) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-auto w-fit items-center gap-1 rounded-md border border-company-border bg-company-surface px-2 py-1 text-[11.5px] font-semibold text-foreground hover:bg-company-nav-hover"
        onClick={(event) => event.stopPropagation()}
      >
        증빙 찾기
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
  readonly row: ReconciliationLedgerRow
}

export function ReconciliationAccountSelector({ row }: ReconciliationAccountSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const displayAccount = row.finalAccount ?? row.recommendedAccount ?? '계정 미정'
  const hasRecommendation = Boolean(row.recommendedAccount) && !row.finalAccount
  const groups = useMemo(() => filterReconciliationFixtureAccountGroups(query), [query])

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
                    key={`${group.label}-${account}`}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-company-nav-hover',
                      account === displayAccount ? 'bg-[#eff6ff] font-semibold text-[#1d4ed8]' : 'text-foreground',
                    )}
                    disabled
                    title={disabledActionNote}
                    type="button"
                  >
                    {account}
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
  const browseRows = useMemo(
    () => (row && source ? listEvidenceFinderBrowseRows(allRows, source, row.id) : []),
    [allRows, row, source],
  )
  const remainingDifferenceKrw = useMemo(
    () => (row ? computeRemainingDifferenceKrw(row.amountKrw, row.candidates) : null),
    [row],
  )
  const sourceLabel = evidenceFinderSourceOptions.find((option) => option.source === source)?.label ?? '증빙'

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
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
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label="증빙 검색"
                  className="min-w-[180px] flex-1 cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-2.5 py-2 text-[12px] text-company-fg-subtle"
                  disabled
                  placeholder="거래처, 금액, 품목"
                  title="Slice 2a-4에서 검색이 연결됩니다."
                />
                <input
                  aria-label="증빙 일자"
                  className="w-[120px] cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-2.5 py-2 text-[12px] text-company-fg-subtle"
                  disabled
                  placeholder="일자"
                  title="Slice 2a-4에서 필터가 연결됩니다."
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
                    {browseRows.length > 0 ? (
                      browseRows.map((browseRow) => (
                        <tr key={browseRow.id} className="border-b border-company-border last:border-b-0">
                          <td className="px-3 py-2 font-mono text-company-fg-muted">
                            {browseRow.transactionDate?.slice(5, 10) ?? '-'}
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-2">{browseRow.counterparty ?? '-'}</td>
                          <td className="max-w-[160px] truncate px-3 py-2">{browseRow.description}</td>
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
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-8 text-center text-company-fg-muted" colSpan={5}>
                          해당 출처의 browse fixture가 없습니다.
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
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly row: ReconciliationLedgerRow | null
}

export function ReconciliationExplanationModal({
  onOpenChange,
  open,
  row,
}: ReconciliationExplanationModalProps) {
  const [draft, setDraft] = useState(row?.explanationMemo ?? '')

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
                <p className="mt-1">{row.workPanelConclusion.basisLabel}</p>
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
                className="cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-3 py-2 text-[12px] font-semibold text-company-fg-subtle"
                disabled
                title={disabledActionNote}
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

function StatusChip({ tone, children }: { readonly tone: Tone; readonly children: ReactNode }) {
  return (
    <span className={cn('inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold', chipClass[tone])}>
      {children}
    </span>
  )
}
