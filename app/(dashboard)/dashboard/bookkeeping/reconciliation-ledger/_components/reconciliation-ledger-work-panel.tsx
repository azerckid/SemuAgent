'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import type {
  ReconciliationLedgerRow,
  ReconciliationMatchCandidate,
} from '@/lib/bookkeeping-review/reconciliation-display-model'
import {
  computeRemainingDifferenceKrw,
  confidenceLabel,
  evidenceFinderSourceOptions,
  formatKrwAmount,
  formatRemainingDifferenceLabel,
  listEvidenceFinderBrowseRows,
  matchCandidateReasonLabel,
  patternSuggestionReasonLabel,
  type EvidenceFinderSource,
  workPanelPrimaryActionLabel,
} from '@/lib/bookkeeping-review/reconciliation-work-panel'
import { cn } from '@/lib/utils'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'
const disabledActionNote = 'Slice 2b 전까지 저장·확정이 비활성화됩니다.'
const disabledFinderNote = 'Slice 2a-4에서 증빙 찾기 검색·선택이 연결됩니다.'

type Tone = 'ok' | 'warn' | 'danger' | 'muted'

const chipClass: Record<Tone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
}

const sourceLabels: Record<ReconciliationLedgerRow['source'], string> = {
  bank: '통장',
  card: '카드',
  tax_invoice: '세금계산서',
  receipt: '현금영수증',
  cash_receipt: '현금영수증',
  other: '기타',
}

export interface ReconciliationLedgerWorkPanelProps {
  readonly allRows: ReconciliationLedgerRow[]
  readonly row: ReconciliationLedgerRow | null
}

export function ReconciliationLedgerWorkPanel({ allRows, row }: ReconciliationLedgerWorkPanelProps) {
  const [finderOpenRowId, setFinderOpenRowId] = useState<string | null>(null)
  const [finderSource, setFinderSource] = useState<EvidenceFinderSource>('tax_invoice')
  const finderOpen = row ? finderOpenRowId === row.id : false

  const remainingDifferenceKrw = useMemo(
    () => (row ? computeRemainingDifferenceKrw(row.amountKrw, row.candidates) : null),
    [row],
  )

  const browseRows = useMemo(
    () => (row ? listEvidenceFinderBrowseRows(allRows, finderSource, row.id) : []),
    [allRows, finderSource, row],
  )

  if (!row) {
    return (
      <aside className={cn(panelClass, 'flex min-h-[320px] flex-col justify-center p-5 xl:sticky xl:top-[72px] xl:max-h-[calc(100vh-96px)]')}>
        <p className="text-[13px] font-semibold text-foreground">작업 패널</p>
        <p className="mt-2 text-[12.5px] text-company-fg-muted">
          원장에서 행을 선택하면 한 줄 결론, 증빙 후보, 패턴 근거를 여기서 확인합니다.
        </p>
      </aside>
    )
  }

  const conclusionTone: Tone = row.blockers.some(
    (blocker) => blocker.code === 'missing_evidence' || blocker.code === 'ambiguous_match',
  )
    ? 'danger'
    : row.blockers.length > 0
      ? 'warn'
      : 'ok'

  const differenceTone: Tone =
    remainingDifferenceKrw === null
      ? 'muted'
      : remainingDifferenceKrw === 0
        ? 'ok'
        : 'warn'

  const showFinderShell =
    finderOpen || row.workPanelConclusion.primaryAction === 'connect_evidence' || row.candidates.length === 0

  return (
    <aside className={cn(panelClass, 'flex flex-col xl:sticky xl:top-[72px] xl:max-h-[calc(100vh-96px)]')}>
      <div className="border-b border-company-border px-4 py-3">
        <p className="text-[11px] font-semibold text-company-fg-subtle">선택 행 작업 패널</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">
          {row.counterparty ?? '거래처 미정'} · {formatKrwAmount(row.amountKrw)}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
        <section className="rounded-[10px] border border-company-border bg-[#fcfcfd] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-company-fg-subtle">한 줄 결론</p>
              <p className="mt-1 text-[14px] font-bold text-foreground">{row.workPanelConclusion.headline}</p>
              <p className="mt-1 text-[12px] text-company-fg-muted">{row.workPanelConclusion.basisLabel}</p>
            </div>
            <StatusChip tone={conclusionTone}>{workPanelPrimaryActionLabel(row.workPanelConclusion.primaryAction)}</StatusChip>
          </div>
          <button
            className="mt-3 w-full cursor-not-allowed rounded-lg border border-company-border-strong bg-company-surface px-3 py-2 text-[12.5px] font-semibold text-company-fg-subtle"
            disabled
            title={row.workPanelConclusion.disabledReason ?? disabledActionNote}
            type="button"
          >
            {workPanelPrimaryActionLabel(row.workPanelConclusion.primaryAction)}
          </button>
          {row.workPanelConclusion.primaryAction === 'open_source_collection' ? (
            <Link
              className="mt-2 inline-flex text-[12px] font-semibold text-[#2563eb] hover:underline"
              href="/dashboard/direct-upload?period=2026-q1&source=tax_invoice"
            >
              자료수집 화면으로 이동
            </Link>
          ) : null}
        </section>

        <section>
          <SectionTitle>거래 요약</SectionTitle>
          <div className="mt-2 grid gap-2">
            <SummaryLine label="출처" value={sourceLabels[row.source]} />
            <SummaryLine label="거래일" value={row.transactionDate ?? '-'} mono />
            <SummaryLine label="거래처" value={row.counterparty ?? '거래처 미정'} />
            <SummaryLine label="적요" value={row.description} />
            <SummaryLine label="금액" value={formatKrwAmount(row.amountKrw)} mono />
            <SummaryLine
              label="계정항목"
              value={row.finalAccount ?? row.recommendedAccount ?? '계정 미정'}
            />
            <SummaryLine
              label="잔여 차액"
              value={formatRemainingDifferenceLabel(remainingDifferenceKrw)}
              chip={<StatusChip tone={differenceTone}>{formatRemainingDifferenceLabel(remainingDifferenceKrw)}</StatusChip>}
            />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>증빙 후보</SectionTitle>
            {row.candidates.length > 0 ? (
              <span className="text-[11px] text-company-fg-subtle">{row.candidates.length}건</span>
            ) : null}
          </div>
          {row.candidates.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {row.candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  disabledNote={disabledActionNote}
                />
              ))}
            </div>
          ) : (
            <div className="mt-2 rounded-[10px] border border-dashed border-company-border bg-[#fcfcfd] px-3 py-3">
              <p className="text-[12.5px] text-company-fg-muted">연결 가능한 증빙 후보가 없습니다.</p>
              <button
                className="mt-2 rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#1d4ed8]"
                onClick={() => row && setFinderOpenRowId(row.id)}
                type="button"
              >
                증빙 찾기
              </button>
            </div>
          )}
        </section>

        {row.patternSuggestion ? (
          <section>
            <SectionTitle>이전 기간 패턴</SectionTitle>
            <div className="mt-2 rounded-[10px] border border-company-border bg-[#fcfcfd] p-3">
              <p className="text-[13px] font-semibold text-foreground">{row.patternSuggestion.basisLabel}</p>
              <p className="mt-1 text-[12px] text-company-fg-muted">
                {patternSuggestionReasonLabel(row.patternSuggestion.reason)} · 확신 {confidenceLabel(row.patternSuggestion.confidence)}
              </p>
              <div className="mt-2 grid gap-1.5 text-[12px] text-company-fg-muted">
                {row.patternSuggestion.suggestedAccount ? (
                  <p>추천 계정: {row.patternSuggestion.suggestedAccount}</p>
                ) : null}
                {row.patternSuggestion.suggestedEvidenceSource ? (
                  <p>추천 증빙: {sourceLabels[row.patternSuggestion.suggestedEvidenceSource]}</p>
                ) : null}
                {row.patternSuggestion.suggestedExclusionReason ? (
                  <p>제외 후보: {row.patternSuggestion.suggestedExclusionReason}</p>
                ) : null}
                <p>
                  과거 확인 {row.patternSuggestion.matchedCount}건
                  {row.patternSuggestion.lastSeenPeriod ? ` · 최근 ${row.patternSuggestion.lastSeenPeriod}` : ''}
                </p>
              </div>
              <button
                className="mt-3 w-full cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-3 py-2 text-[12px] font-semibold text-company-fg-subtle"
                disabled
                title={disabledActionNote}
                type="button"
              >
                패턴 제안 적용 (준비 중)
              </button>
            </div>
          </section>
        ) : null}

        {showFinderShell ? (
          <section>
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>증빙 찾기</SectionTitle>
              <span className="text-[11px] text-company-fg-subtle">browse shell</span>
            </div>
            <div className="mt-2 inline-flex flex-wrap gap-1 rounded-[9px] bg-[#f1f1f2] p-[3px]">
              {evidenceFinderSourceOptions.map((option) => (
                <button
                  key={option.source}
                  aria-pressed={finderSource === option.source}
                  className={cn(
                    'rounded-[7px] px-2.5 py-1.5 text-[12px] font-semibold',
                    finderSource === option.source
                      ? 'bg-company-surface text-foreground shadow-company-card'
                      : 'text-company-fg-muted hover:bg-company-surface/70',
                  )}
                  onClick={() => setFinderSource(option.source)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                aria-label="증빙 검색"
                className="min-w-[140px] flex-1 cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-2.5 py-2 text-[12px] text-company-fg-subtle"
                disabled
                placeholder="거래처, 금액, 품목"
                title={disabledFinderNote}
              />
              <input
                aria-label="증빙 일자"
                className="w-[110px] cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-2.5 py-2 text-[12px] text-company-fg-subtle"
                disabled
                placeholder="일자"
                title={disabledFinderNote}
              />
            </div>
            <div className="mt-2 max-h-[180px] overflow-auto rounded-[10px] border border-company-border">
              <table className="w-full border-collapse text-left text-[11.5px]">
                <thead className="sticky top-0 bg-[#fafafa] text-[11px] font-semibold text-company-fg-subtle">
                  <tr className="border-b border-company-border">
                    <th className="px-2 py-2">일자</th>
                    <th className="px-2 py-2">거래처</th>
                    <th className="px-2 py-2 text-right">금액</th>
                    <th className="px-2 py-2">선택</th>
                  </tr>
                </thead>
                <tbody>
                  {browseRows.length > 0 ? (
                    browseRows.map((browseRow) => (
                      <tr key={browseRow.id} className="border-b border-company-border last:border-b-0">
                        <td className="px-2 py-2 font-mono text-company-fg-muted">
                          {browseRow.transactionDate?.slice(5, 10) ?? '-'}
                        </td>
                        <td className="max-w-[100px] truncate px-2 py-2">{browseRow.counterparty ?? '-'}</td>
                        <td className="px-2 py-2 text-right font-mono">{formatKrwAmount(browseRow.amountKrw)}</td>
                        <td className="px-2 py-2">
                          <button
                            className="cursor-not-allowed rounded border border-company-border px-1.5 py-0.5 text-[10.5px] font-semibold text-company-fg-subtle"
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
                      <td className="px-2 py-4 text-center text-company-fg-muted" colSpan={4}>
                        해당 출처의 browse fixture가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-company-fg-muted">
              <span>선택 합계 0원</span>
              <span>{formatRemainingDifferenceLabel(remainingDifferenceKrw)}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className="flex-1 cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-3 py-2 text-[12px] font-semibold text-company-fg-subtle"
                disabled
                title={disabledActionNote}
                type="button"
              >
                연결 저장
              </button>
              <button
                className="rounded-lg border border-company-border px-3 py-2 text-[12px] font-semibold text-company-fg-muted"
                onClick={() => setFinderOpenRowId(null)}
                type="button"
              >
                닫기
              </button>
            </div>
          </section>
        ) : (
          <button
            className="w-full rounded-lg border border-company-border bg-[#fcfcfd] px-3 py-2 text-[12px] font-semibold text-company-fg-muted hover:bg-company-nav-hover"
            onClick={() => row && setFinderOpenRowId(row.id)}
            type="button"
          >
            증빙 찾기 열기
          </button>
        )}

        {row.blockers.length > 0 ? (
          <section>
            <SectionTitle>차단 사유</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.blockers.map((blocker) => (
                <StatusChip key={blocker.code} tone="warn">
                  {blocker.label}
                </StatusChip>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  )
}

function SectionTitle({ children }: { readonly children: string }) {
  return <h3 className="text-[12.5px] font-semibold text-foreground">{children}</h3>
}

function SummaryLine({
  chip,
  label,
  mono = false,
  value,
}: {
  readonly chip?: ReactNode
  readonly label: string
  readonly mono?: boolean
  readonly value: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-company-border bg-[#fcfcfd] px-3 py-2">
      <span className="text-[12px] text-company-fg-muted">{label}</span>
      {chip ?? (
        <span className={cn('max-w-[180px] text-right text-[12px] font-medium text-foreground', mono ? 'font-mono' : '')}>
          {value}
        </span>
      )}
    </div>
  )
}

function CandidateCard({
  candidate,
  disabledNote,
}: {
  readonly candidate: ReconciliationMatchCandidate
  readonly disabledNote: string
}) {
  const tone: Tone =
    candidate.confidence === 'high' ? 'ok' : candidate.confidence === 'medium' ? 'warn' : 'danger'

  return (
    <div className="rounded-[10px] border border-company-border bg-[#fcfcfd] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12.5px] font-semibold text-foreground">
            {sourceLabels[candidate.source]} · {formatKrwAmount(candidate.amountKrw)}
          </p>
          <p className="mt-0.5 text-[11.5px] text-company-fg-muted">
            {candidate.counterparty ?? '거래처 미정'} · {candidate.date ?? '일자 미정'}
          </p>
          <p className="mt-1 text-[11.5px] text-company-fg-subtle">
            {matchCandidateReasonLabel(candidate.reason)} · 확신 {confidenceLabel(candidate.confidence)}
          </p>
        </div>
        <StatusChip tone={tone}>{confidenceLabel(candidate.confidence)}</StatusChip>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          className="flex-1 cursor-not-allowed rounded-md border border-company-border-strong bg-company-surface px-2.5 py-1.5 text-[11.5px] font-semibold text-company-fg-subtle"
          disabled
          title={disabledNote}
          type="button"
        >
          이 증빙 연결
        </button>
        <button
          className="cursor-not-allowed rounded-md border border-company-border bg-company-nav-hover px-2.5 py-1.5 text-[11.5px] font-semibold text-company-fg-subtle"
          disabled
          title={disabledNote}
          type="button"
        >
          아님
        </button>
      </div>
    </div>
  )
}

function StatusChip({ tone, children }: { readonly tone: Tone; readonly children: ReactNode }) {
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', chipClass[tone])}>
      {children}
    </span>
  )
}
