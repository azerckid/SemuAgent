'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import {
  buildReconciliationDisplaySourceCounts,
  countCashReceiptDisplayRows,
  countReconciliationDisplayRows,
  filterReconciliationDisplayRows,
  reconciliationDisplayFilterHref,
  type ReconciliationDisplayFilter,
} from '@/lib/bookkeeping-review/reconciliation-display-filters'
import type {
  ReconciliationBatchSuggestionGroup,
  ReconciliationLedgerDisplayModel,
  ReconciliationLedgerRow,
  ReconciliationNextAction,
  ReconciliationPeriodMode,
  ReconciliationSource,
  ReconciliationTaxBlockerSummary,
} from '@/lib/bookkeeping-review/reconciliation-display-model'
import type { EvidenceFinderSource } from '@/lib/bookkeeping-review/reconciliation-work-panel'
import { cn } from '@/lib/utils'
import {
  ReconciliationAccountSelector,
  ReconciliationEvidenceCell,
  ReconciliationEvidencePickerModal,
  ReconciliationExplanationModal,
  ReconciliationLinkedEvidenceModal,
} from './reconciliation-ledger-fixture-interactions'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'
const disabledActionNote = 'Slice 2b 전까지 저장·확정이 비활성화됩니다.'
const disabledPeriodNote = 'Slice 2a-5에서 기간 전환 및 실데이터 조회가 연결됩니다.'

type Tone = 'ok' | 'warn' | 'danger' | 'muted'

const sourceLabels: Record<ReconciliationSource, { label: string; short: string; className: string }> = {
  bank: { label: '통장', short: '통', className: 'bg-[#0f766e]' },
  card: { label: '카드', short: '카', className: 'bg-[#1d4ed8]' },
  tax_invoice: { label: '세금계산서', short: '세', className: 'bg-[#7c3aed]' },
  receipt: { label: '현금영수증', short: '현', className: 'bg-[#ca8a04]' },
  cash_receipt: { label: '현금영수증', short: '현', className: 'bg-[#ca8a04]' },
  other: { label: '기타', short: '기', className: 'bg-company-fg-muted' },
}

const chipClass: Record<Tone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
}

type EvidencePickerState = {
  rowId: string
  source: EvidenceFinderSource
}

export interface ReconciliationLedgerDisplayFixtureViewProps {
  readonly activeFilter: ReconciliationDisplayFilter
  readonly companyName: string
  readonly displayModel: ReconciliationLedgerDisplayModel
  readonly initialRowId?: string | null
}

export function ReconciliationLedgerDisplayFixtureView({
  activeFilter,
  companyName,
  displayModel,
  initialRowId = null,
}: ReconciliationLedgerDisplayFixtureViewProps) {
  const rows = displayModel.rows
  const filteredRows = filterReconciliationDisplayRows(rows, activeFilter)
  const initialRow = useMemo(
    () => (initialRowId ? rows.find((row) => row.id === initialRowId) ?? null : null),
    [initialRowId, rows],
  )
  const [evidencePicker, setEvidencePicker] = useState<EvidencePickerState | null>(null)
  const [explanationRowId, setExplanationRowId] = useState<string | null>(() => {
    if (initialRow?.evidenceActionState === 'explanation_required') {
      return initialRow.id
    }
    return null
  })
  const [linkedEvidenceRowId, setLinkedEvidenceRowId] = useState<string | null>(null)

  const evidencePickerRow = useMemo(
    () => (evidencePicker ? rows.find((row) => row.id === evidencePicker.rowId) ?? null : null),
    [evidencePicker, rows],
  )
  const explanationRow = useMemo(
    () => (explanationRowId ? rows.find((row) => row.id === explanationRowId) ?? null : null),
    [explanationRowId, rows],
  )
  const linkedEvidenceRow = useMemo(
    () => (linkedEvidenceRowId ? rows.find((row) => row.id === linkedEvidenceRowId) ?? null : null),
    [linkedEvidenceRowId, rows],
  )

  const sourceCounts = buildReconciliationDisplaySourceCounts(rows)
  const cashReceiptCount = countCashReceiptDisplayRows(rows)
  const periodLabel = rows[0]?.periodLabel ?? '기간 미정'
  const periodMode = rows[0]?.periodMode ?? 'quarter'
  const checklist = displayModel.closingChecklist
  const readinessPercent = checklist.isReadyForPath1
    ? 100
    : Math.max(
        0,
        100
          - checklist.evidenceRequiredCount
          - checklist.explanationRequiredCount
          - Math.min(checklist.accountUnconfirmedCount, 30),
      )

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <FixtureTopbar companyName={companyName} />
      <div className="flex w-full max-w-[1320px] flex-col gap-5 px-7 pt-6 pb-12">
        <PeriodScopeControl activeMode={periodMode} periodLabel={periodLabel} />

        <section className={cn(panelClass, 'grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_360px]')}>
          <div>
            <p className="text-xs font-semibold text-company-fg-muted">Path 1 데이터 준비 관문 · Fixture</p>
            <h2 className="mt-2 text-[23px] font-bold text-foreground">
              통장·카드·세금계산서·현금영수증을 한 원장으로 대조하고 확정합니다
            </h2>
            <p className="mt-2 max-w-[720px] text-[13px] text-company-fg-muted">
              Preview 12 display model로 렌더하는 Slice 2a-3 workbench입니다. 증빙·계정은 테이블 셀에서 바로 처리합니다.
            </p>
            <div className="mt-4 h-2 max-w-[520px] overflow-hidden rounded-full bg-[#e4e4e7]">
              <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${readinessPercent}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="원장 준비율" value={`${readinessPercent}%`} />
            <MetricCard label="증빙 필요" value={`${checklist.evidenceRequiredCount}건`} />
            <MetricCard label="소명 필요" value={`${checklist.explanationRequiredCount}건`} />
            <MetricCard label="계정 미확정" value={`${checklist.accountUnconfirmedCount}건`} />
          </div>
        </section>

        <div className="rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] px-3.5 py-3 text-[12.5px] text-[#1e40af]">
          Fixture workbench: 증빙 상태 셀에서 증빙 찾기(3종) 또는 소명 입력, 계정 셀에서 계정을 선택합니다. 저장·연결은 Slice 2b까지 비활성입니다.
        </div>

        <NextActionQueue actions={displayModel.nextActions} />

        {displayModel.batchSuggestionGroups.length > 0 ? (
          <BatchSuggestionBar groups={displayModel.batchSuggestionGroups} />
        ) : null}

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <SourceSummaryCard label="통장 내역" count={sourceCounts.bank} sub="입출금 대조" />
          <SourceSummaryCard label="카드 승인" count={sourceCounts.card} sub="계정·거래처 확인" />
          <SourceSummaryCard label="세금계산서" count={sourceCounts.tax_invoice} sub="매출·매입 증빙" />
          <SourceSummaryCard label="현금영수증" count={cashReceiptCount} sub="공제·제외 검토" />
          <SourceSummaryCard
            label="제외 검토"
            count={countReconciliationDisplayRows(rows, (row) => row.evidenceActionState === 'excluded' || row.blockers.some((b) => b.code === 'exclude_reason_required'))}
            sub="업무무관·중복"
          />
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap gap-0.5 rounded-[9px] bg-[#f1f1f2] p-[3px]">
            <DisplayTabChip active={activeFilter === 'all'} count={rows.length} filter="all" label="전체" />
            <DisplayTabChip active={activeFilter === 'bank'} count={sourceCounts.bank} filter="bank" label="통장" />
            <DisplayTabChip active={activeFilter === 'card'} count={sourceCounts.card} filter="card" label="카드" />
            <DisplayTabChip active={activeFilter === 'tax_invoice'} count={sourceCounts.tax_invoice} filter="tax_invoice" label="세금계산서" />
            <DisplayTabChip
              active={activeFilter === 'cash_receipt'}
              count={cashReceiptCount}
              filter="cash_receipt"
              label="현금영수증"
            />
            <DisplayTabChip
              active={activeFilter === 'evidence_required'}
              count={checklist.evidenceRequiredCount}
              filter="evidence_required"
              label="증빙 필요"
            />
            <DisplayTabChip
              active={activeFilter === 'explanation_required'}
              count={checklist.explanationRequiredCount}
              filter="explanation_required"
              label="소명 필요"
            />
            <DisplayTabChip
              active={activeFilter === 'exclusion_review'}
              count={checklist.exclusionReasonRequiredCount}
              filter="exclusion_review"
              label="제외 검토"
            />
          </div>
          <input
            aria-label="자료대조원장 검색"
            className="min-w-[240px] cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-2.5 py-2 text-[12.5px] text-company-fg-subtle md:ml-auto"
            disabled
            placeholder="거래처, 금액, 적요, 증빙번호 검색"
          />
          <button
            className="cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-3 py-2 text-xs font-semibold text-company-fg-subtle"
            disabled
            title={disabledActionNote}
            type="button"
          >
            표시 설정
          </button>
          <button
            className="cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-3 py-2 text-xs font-semibold text-company-fg-subtle"
            disabled
            title={disabledActionNote}
            type="button"
          >
            선택 건 확정
          </button>
        </div>

        <section className={panelClass}>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead className="sticky top-0 z-[1] bg-[#fafafa] text-[11.5px] font-semibold text-company-fg-subtle uppercase">
                <tr className="border-b border-company-border">
                  <th className="px-3 py-3">거래일</th>
                  <th className="px-3 py-3">출처</th>
                  <th className="px-3 py-3">거래처/가맹점</th>
                  <th className="px-3 py-3">적요/품목</th>
                  <th className="px-3 py-3 text-right">금액</th>
                  <th className="px-3 py-3">증빙 상태</th>
                  <th className="px-3 py-3">계정항목</th>
                  <th className="px-3 py-3">한 줄 결론</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <FixtureRow
                      key={row.id}
                      onOpenEvidencePicker={(source) => setEvidencePicker({ rowId: row.id, source })}
                      onOpenExplanation={() => setExplanationRowId(row.id)}
                      onViewLinkedEvidence={() => setLinkedEvidenceRowId(row.id)}
                      row={row}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-company-fg-muted">
                      선택한 조건에 해당하는 거래가 없습니다. 다음 할 일 큐 또는 전체 탭을 확인하세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <ReconciliationEvidencePickerModal
          allRows={rows}
          onOpenChange={(open) => {
            if (!open) {
              setEvidencePicker(null)
            }
          }}
          open={evidencePicker !== null && evidencePickerRow !== null}
          row={evidencePickerRow}
          source={evidencePicker?.source ?? null}
        />

        <ReconciliationExplanationModal
          key={explanationRowId ?? 'closed'}
          onOpenChange={(open) => {
            if (!open) {
              setExplanationRowId(null)
            }
          }}
          open={explanationRow !== null}
          row={explanationRow}
        />

        <ReconciliationLinkedEvidenceModal
          onOpenChange={(open) => {
            if (!open) {
              setLinkedEvidenceRowId(null)
            }
          }}
          open={linkedEvidenceRow !== null}
          row={linkedEvidenceRow}
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <ClosingChecklistPanel checklist={checklist} />
          <TaxBlockerPanel summaries={displayModel.taxBlockerSummaries} />
        </section>
      </div>
    </div>
  )
}

function FixtureTopbar({ companyName }: { readonly companyName: string }) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-company-border bg-company-surface px-7 py-3.5">
      <div>
        <p className="text-[12.5px] font-medium text-company-fg-subtle">
          <Link href="/dashboard" className="hover:text-company-fg-muted hover:underline">회사 홈</Link>
          <span aria-hidden="true"> › </span>
          <Link href="/dashboard/bookkeeping" className="hover:text-company-fg-muted hover:underline">기장검토</Link>
          <span aria-hidden="true"> › </span>
          <span>자료대조원장</span>
        </p>
        <h1 className="text-base font-semibold text-foreground">자료대조원장 · Fixture</h1>
      </div>
      <span className="ml-auto text-[13px] font-medium text-company-fg-muted">{companyName}</span>
    </div>
  )
}

const periodModeOptions: Array<{ mode: ReconciliationPeriodMode; label: string }> = [
  { mode: 'month', label: '월' },
  { mode: 'quarter', label: '분기' },
  { mode: 'half_year', label: '반기' },
  { mode: 'year', label: '연' },
  { mode: 'custom', label: '사용자 지정' },
]

function PeriodScopeControl({
  activeMode,
  periodLabel,
}: {
  readonly activeMode: ReconciliationPeriodMode
  readonly periodLabel: string
}) {
  return (
    <section className={cn(panelClass, 'flex flex-wrap items-center gap-3 px-4 py-3')}>
      <div className="min-w-[180px]">
        <p className="text-[11px] font-semibold text-company-fg-subtle">기간 단위</p>
        <p className="mt-0.5 text-[13px] font-semibold text-foreground">{periodLabel}</p>
      </div>
      <div className="inline-flex flex-wrap gap-1 rounded-[9px] bg-[#f1f1f2] p-[3px]">
        {periodModeOptions.map((option) => (
          <button
            key={option.mode}
            aria-pressed={activeMode === option.mode}
            className={cn(
              'cursor-not-allowed rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold',
              activeMode === option.mode
                ? 'bg-company-surface text-foreground shadow-company-card'
                : 'text-company-fg-muted',
            )}
            disabled
            title={disabledPeriodNote}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        <input
          aria-label="기간 시작일"
          className="w-[132px] cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-2.5 py-2 text-[12.5px] text-company-fg-subtle"
          disabled
          placeholder="시작일"
          title={disabledPeriodNote}
        />
        <span className="text-[12px] text-company-fg-muted">~</span>
        <input
          aria-label="기간 종료일"
          className="w-[132px] cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-2.5 py-2 text-[12.5px] text-company-fg-subtle"
          disabled
          placeholder="종료일"
          title={disabledPeriodNote}
        />
        <button
          className="cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-3 py-2 text-xs font-semibold text-company-fg-subtle"
          disabled
          title={disabledPeriodNote}
          type="button"
        >
          기간 적용
        </button>
      </div>
    </section>
  )
}

function NextActionQueue({ actions }: { readonly actions: ReconciliationNextAction[] }) {
  return (
    <section className={cn(panelClass, 'p-4')}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13.5px] font-semibold text-foreground">다음 할 일</h3>
        <span className="text-[12px] text-company-fg-muted">세목 파일 생성을 막는 항목부터 처리합니다</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {actions.map((action, index) => (
          <Link
            key={action.id}
            className="rounded-[10px] border border-company-border bg-[#fcfcfd] px-3 py-3 transition-colors hover:border-[#93c5fd] hover:bg-[#eff6ff]"
            href={action.targetRoute.startsWith('/') ? action.targetRoute : reconciliationDisplayFilterHref('all')}
          >
            <p className="text-[11px] font-semibold text-company-fg-subtle">
              {index + 1}순위 · {priorityLabel(action.priority)}
            </p>
            <p className="mt-1 text-[14px] font-bold text-foreground">{action.label}</p>
            <p className="mt-1 text-[12px] text-company-fg-muted">{action.reason}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function BatchSuggestionBar({ groups }: { readonly groups: ReconciliationBatchSuggestionGroup[] }) {
  return (
    <section className={cn(panelClass, 'flex flex-wrap items-center justify-between gap-3 p-4')}>
      <div>
        <h3 className="text-[13.5px] font-semibold text-foreground">반복 패턴 일괄 제안</h3>
        <p className="mt-1 text-[12px] text-company-fg-muted">
          {groups[0]?.basisLabel ?? '동일 근거·동일 추천 그룹'} · {groups[0]?.rowIds.length ?? 0}건
        </p>
      </div>
      <button
        className="cursor-not-allowed rounded-lg border border-company-border bg-company-nav-hover px-3 py-2 text-xs font-semibold text-company-fg-subtle"
        disabled
        title={disabledActionNote}
        type="button"
      >
        일괄 확인 (준비 중)
      </button>
    </section>
  )
}

function FixtureRow({
  onOpenEvidencePicker,
  onOpenExplanation,
  onViewLinkedEvidence,
  row,
}: {
  readonly onOpenEvidencePicker: (source: EvidenceFinderSource) => void
  readonly onOpenExplanation: () => void
  readonly onViewLinkedEvidence: () => void
  readonly row: ReconciliationLedgerRow
}) {
  const source = sourceLabels[row.source]
  const tone = row.blockers.some((blocker) => blocker.code === 'missing_evidence' || blocker.code === 'ambiguous_match')
    ? 'danger'
    : row.blockers.length > 0
      ? 'warn'
      : 'ok'

  return (
    <tr
      className={cn(
        'border-b border-company-border last:border-b-0 hover:bg-[#fafafa]',
        tone === 'danger' ? 'bg-[#fff7f7]' : tone === 'warn' ? 'bg-[#fffaf0]' : '',
      )}
    >
      <td className="px-3 py-3 font-mono text-company-fg-muted">{formatDate(row.transactionDate)}</td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center gap-2 font-semibold text-foreground">
          <span className={cn('grid size-[22px] place-items-center rounded-md text-[11px] font-bold text-white', source.className)}>{source.short}</span>
          {source.label}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="font-semibold text-foreground">{row.counterparty ?? '거래처 미정'}</div>
        <div className="mt-0.5 text-[11.5px] text-company-fg-subtle">{directionLabel(row.direction)}</div>
      </td>
      <td className="max-w-[220px] px-3 py-3">
        <div className="truncate font-semibold text-foreground">{row.description}</div>
        {row.patternSuggestion ? (
          <div className="mt-0.5 truncate text-[11.5px] text-company-fg-subtle">{row.patternSuggestion.basisLabel}</div>
        ) : null}
      </td>
      <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">{formatKrw(row.amountKrw)}</td>
      <td className="px-3 py-3">
        <ReconciliationEvidenceCell
          onOpenEvidencePicker={onOpenEvidencePicker}
          onOpenExplanation={onOpenExplanation}
          onViewLinkedEvidence={onViewLinkedEvidence}
          row={row}
        />
      </td>
      <td className="px-3 py-3">
        <ReconciliationAccountSelector row={row} />
      </td>
      <td className="max-w-[200px] px-3 py-3 text-[12px] text-company-fg-muted">{row.workPanelConclusion.headline}</td>
    </tr>
  )
}

function ClosingChecklistPanel({
  checklist,
}: {
  readonly checklist: ReconciliationLedgerDisplayModel['closingChecklist']
}) {
  return (
    <section className={cn(panelClass, 'p-4')}>
      <h3 className="text-[13.5px] font-semibold text-foreground">마감 체크리스트</h3>
      <div className="mt-3 grid gap-2">
        <ChecklistLine label="증빙 필요" chip={<StatusChip tone={checklist.evidenceRequiredCount > 0 ? 'warn' : 'ok'}>{checklist.evidenceRequiredCount}건</StatusChip>} />
        <ChecklistLine label="소명 필요" chip={<StatusChip tone={checklist.explanationRequiredCount > 0 ? 'warn' : 'ok'}>{checklist.explanationRequiredCount}건</StatusChip>} />
        <ChecklistLine label="계정 미확정" chip={<StatusChip tone={checklist.accountUnconfirmedCount > 0 ? 'warn' : 'ok'}>{checklist.accountUnconfirmedCount}건</StatusChip>} />
        <ChecklistLine label="제외 사유" chip={<StatusChip tone={checklist.exclusionReasonRequiredCount > 0 ? 'warn' : 'ok'}>{checklist.exclusionReasonRequiredCount}건</StatusChip>} />
        <ChecklistLine label="세목 blocker" chip={<StatusChip tone={checklist.taxBlockerCount > 0 ? 'danger' : 'ok'}>{checklist.taxBlockerCount}건</StatusChip>} />
        <ChecklistLine label="Path 1 생성 가능" chip={<StatusChip tone={checklist.isReadyForPath1 ? 'ok' : 'danger'}>{checklist.isReadyForPath1 ? '가능' : '불가'}</StatusChip>} />
      </div>
    </section>
  )
}

function TaxBlockerPanel({ summaries }: { readonly summaries: ReconciliationTaxBlockerSummary[] }) {
  return (
    <section className={cn(panelClass, 'p-4')}>
      <h3 className="text-[13.5px] font-semibold text-foreground">세목별 차단 이유</h3>
      <div className="mt-3 grid gap-2">
        {summaries.map((summary) => {
          const reasonText = summary.topReasons.length > 0
            ? summary.topReasons.map((reason) => `${reason.label} ${reason.count}건`).join(' · ')
            : summary.canGeneratePath1File
              ? '생성 가능'
              : 'blocker 없음'

          return (
            <ChecklistLine
              key={summary.taxTrack}
              label={summary.label}
              chip={
                <StatusChip tone={summary.canGeneratePath1File ? 'ok' : summary.blockerCount > 0 ? 'danger' : 'warn'}>
                  {reasonText}
                </StatusChip>
              }
            />
          )
        })}
      </div>
    </section>
  )
}

function MetricCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-[10px] border border-company-border bg-[#fcfcfd] px-3 py-2.5">
      <p className="text-[11px] text-company-fg-subtle">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-foreground">{value}</p>
    </div>
  )
}

function SourceSummaryCard({ label, count, sub }: { readonly label: string; readonly count: number; readonly sub: string }) {
  return (
    <div className={cn(panelClass, 'p-3.5')}>
      <p className="text-[11.5px] font-semibold text-company-fg-subtle">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{count}건</p>
      <p className="mt-0.5 text-xs text-company-fg-muted">{sub}</p>
    </div>
  )
}

function DisplayTabChip({
  active = false,
  count,
  filter,
  label,
}: {
  readonly active?: boolean
  readonly count: number
  readonly filter: ReconciliationDisplayFilter
  readonly label: string
}) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-company-surface hover:text-foreground',
        active ? 'bg-company-surface text-foreground shadow-company-card' : 'text-company-fg-muted',
      )}
      href={reconciliationDisplayFilterHref(filter)}
    >
      {label} <span className="ml-1 text-[11px] text-company-fg-subtle">{count}</span>
    </Link>
  )
}

function StatusChip({ tone, children }: { readonly tone: Tone; readonly children: ReactNode }) {
  return <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold', chipClass[tone])}>{children}</span>
}

function ChecklistLine({ label, chip }: { readonly label: string; readonly chip: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-company-border bg-[#fcfcfd] px-3 py-2">
      <span className="text-[12.5px] text-company-fg-muted">{label}</span>
      {chip}
    </div>
  )
}

function priorityLabel(priority: ReconciliationNextAction['priority']) {
  if (priority === 'filing_blocker') return '세목 차단'
  if (priority === 'high_amount') return '반복 패턴'
  if (priority === 'due_date') return '마감 임박'
  return '수동 검토'
}

function directionLabel(direction: ReconciliationLedgerRow['direction']) {
  if (direction === 'income') return '수입 거래'
  if (direction === 'expense') return '지출 거래'
  return '방향 확인'
}

function formatDate(value: string | null) {
  return value?.slice(5, 10) ?? '-'
}

function formatKrw(value: number | null) {
  return value === null ? '-' : `${value.toLocaleString('ko-KR')}원`
}
