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
import {
  resolveTaxInvoiceAmountBreakdown,
  TAX_INVOICE_LEDGER_TAX_TYPE_LABEL,
  taxInvoiceTradeTypeLabel,
  usesTaxInvoiceLedgerLayout,
} from '@/lib/bookkeeping-review/reconciliation-tax-invoice-display'
import type {
  ReconciliationLedgerDisplayModel,
  ReconciliationLedgerRow,
  ReconciliationPeriodMode,
  ReconciliationSource,
  ReconciliationTaxBlockerSummary,
} from '@/lib/bookkeeping-review/reconciliation-display-model'
import { evidenceRowHighlightTone, type EvidenceFinderSource } from '@/lib/bookkeeping-review/reconciliation-row-actions'
import { cn } from '@/lib/utils'
import {
  ReconciliationAccountSelector,
  ReconciliationBatchSuggestionBar,
  ReconciliationEvidenceCell,
  ReconciliationEvidenceExceptionModal,
  ReconciliationEvidencePickerModal,
  ReconciliationExclusionModal,
  ReconciliationExplanationModal,
} from './reconciliation-ledger-fixture-interactions'
import {
  reconciliationLedgerColumnCount,
  reconciliationLedgerEmptyRow,
  ReconciliationLedgerTableShell,
  resolveReconciliationLedgerTableVariant,
  LedgerCellText,
} from './reconciliation-ledger-table-layout'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'
const disabledActionNote = 'Slice 2b 전까지 저장·확정이 비활성화됩니다.'
const disabledPeriodNote = 'Slice 2a-5에서 기간 전환 및 실데이터 조회가 연결됩니다.'

function withFixtureModeParam(href: string, isFixtureMode: boolean): string {
  if (!isFixtureMode) return href
  const [path, query] = href.split('?')
  const params = new URLSearchParams(query)
  params.set('display', 'fixture')
  return `${path}?${params.toString()}`
}

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
  highlightedEvidenceRowId?: string | null
  rowId: string
  source: EvidenceFinderSource
}

export interface ReconciliationLedgerDisplayFixtureViewProps {
  readonly activeFilter: ReconciliationDisplayFilter
  readonly companyName: string
  readonly displayModel: ReconciliationLedgerDisplayModel
  readonly initialRowId?: string | null
  readonly isFixtureMode?: boolean
}

export function ReconciliationLedgerDisplayFixtureView({
  activeFilter,
  companyName,
  displayModel,
  initialRowId = null,
  isFixtureMode = false,
}: ReconciliationLedgerDisplayFixtureViewProps) {
  const rows = displayModel.rows
  const filteredRows = filterReconciliationDisplayRows(rows, activeFilter)
  const initialRow = useMemo(
    () => (initialRowId ? rows.find((row) => row.id === initialRowId) ?? null : null),
    [initialRowId, rows],
  )
  const [evidencePicker, setEvidencePicker] = useState<EvidencePickerState | null>(null)
  const [evidenceExceptionRowId, setEvidenceExceptionRowId] = useState<string | null>(null)
  const [explanationRowId, setExplanationRowId] = useState<string | null>(() => {
    if (initialRow?.evidenceActionState === 'explanation_required') {
      return initialRow.id
    }
    return null
  })
  const [exclusionRowId, setExclusionRowId] = useState<string | null>(null)

  const evidencePickerRow = useMemo(
    () => (evidencePicker ? rows.find((row) => row.id === evidencePicker.rowId) ?? null : null),
    [evidencePicker, rows],
  )
  const evidenceExceptionRow = useMemo(
    () => (evidenceExceptionRowId ? rows.find((row) => row.id === evidenceExceptionRowId) ?? null : null),
    [evidenceExceptionRowId, rows],
  )
  const explanationRow = useMemo(
    () => (explanationRowId ? rows.find((row) => row.id === explanationRowId) ?? null : null),
    [explanationRowId, rows],
  )
  const exclusionRow = useMemo(
    () => (exclusionRowId ? rows.find((row) => row.id === exclusionRowId) ?? null : null),
    [exclusionRowId, rows],
  )

  const sourceCounts = buildReconciliationDisplaySourceCounts(rows)
  const cashReceiptCount = countCashReceiptDisplayRows(rows)
  const periodLabel = rows[0]?.periodLabel ?? '기간 미정'
  const periodMode = rows[0]?.periodMode ?? 'quarter'
  const checklist = displayModel.closingChecklist
  const taxInvoiceLayout = usesTaxInvoiceLedgerLayout(activeFilter)
  const cardLayout = activeFilter === 'card'
  const tableVariant = resolveReconciliationLedgerTableVariant({ cardLayout, taxInvoiceLayout, surface: 'fixture' })
  const tableColumnCount = reconciliationLedgerColumnCount(tableVariant)
  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <FixtureTopbar companyName={companyName} isFixtureMode={isFixtureMode} />
      <div className="flex w-full max-w-[1320px] flex-col gap-5 px-7 pt-6 pb-12">
        <PeriodScopeControl activeMode={periodMode} periodLabel={periodLabel} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap gap-0.5 rounded-[9px] bg-[#f1f1f2] p-[3px]">
            <DisplayTabChip active={activeFilter === 'all'} count={rows.length} filter="all" isFixtureMode={isFixtureMode} label="전체" />
            <DisplayTabChip active={activeFilter === 'bank'} count={sourceCounts.bank} filter="bank" isFixtureMode={isFixtureMode} label="통장" />
            <DisplayTabChip active={activeFilter === 'card'} count={sourceCounts.card} filter="card" isFixtureMode={isFixtureMode} label="카드" />
            <DisplayTabChip active={activeFilter === 'tax_invoice'} count={sourceCounts.tax_invoice} filter="tax_invoice" isFixtureMode={isFixtureMode} label="세금계산서" />
            <DisplayTabChip
              active={activeFilter === 'cash_receipt'}
              count={cashReceiptCount}
              filter="cash_receipt"
              isFixtureMode={isFixtureMode}
              label="현금영수증"
            />
            <DisplayTabChip
              active={activeFilter === 'evidence_required'}
              count={checklist.evidenceRequiredCount}
              filter="evidence_required"
              isFixtureMode={isFixtureMode}
              label="증빙 필요"
            />
            <DisplayTabChip
              active={activeFilter === 'explanation_required'}
              count={checklist.explanationRequiredCount}
              filter="explanation_required"
              isFixtureMode={isFixtureMode}
              label="소명 필요"
            />
            <DisplayTabChip
              active={activeFilter === 'exclusion_review'}
              count={countReconciliationDisplayRows(rows, (row) => row.evidenceActionState === 'excluded' || row.blockers.some((b) => b.code === 'exclude_reason_required'))}
              filter="exclusion_review"
              isFixtureMode={isFixtureMode}
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

        <ReconciliationBatchSuggestionBar
          groups={displayModel.batchSuggestionGroups}
          isFixtureMode={isFixtureMode}
          rows={rows}
        />

        <ReconciliationLedgerTableShell
          variant={tableVariant}
          header={(
            <tr className="border-b border-company-border">
              {taxInvoiceLayout ? (
                <>
                  <th className="px-3 py-3">거래일</th>
                  <th className="px-3 py-3">매입/매출</th>
                  <th className="px-3 py-3">거래처</th>
                  <th className="px-3 py-3">품목</th>
                  <th className="px-3 py-3 text-right">공급가액</th>
                  <th className="px-3 py-3 text-right">세액</th>
                  <th className="px-3 py-3 text-right">합계금액</th>
                  <th className="px-3 py-3">과세유형</th>
                  <th className="px-3 py-3">증빙 상태</th>
                  <th className="px-3 py-3">계정항목</th>
                </>
              ) : cardLayout ? (
                <>
                  <th className="px-3 py-3">거래일</th>
                  <th className="px-3 py-3">카드</th>
                  <th className="px-3 py-3">가맹점</th>
                  <th className="px-3 py-3 text-right">금액</th>
                  <th className="px-3 py-3 text-right">부가세</th>
                  <th className="px-3 py-3">결제상태</th>
                  <th className="px-3 py-3">계정항목</th>
                  <th className="px-3 py-3">처리</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-3">거래일</th>
                  <th className="px-3 py-3">출처</th>
                  <th className="px-3 py-3">거래처/가맹점</th>
                  <th className="px-3 py-3">적요/품목</th>
                  <th className="px-3 py-3 text-right">금액</th>
                  <th className="px-3 py-3">증빙 상태</th>
                  <th className="px-3 py-3">계정항목</th>
                  <th className="px-3 py-3">한 줄 결론</th>
                </>
              )}
            </tr>
          )}
        >
          {filteredRows.length > 0 ? (
            filteredRows.map((row) => (
              <FixtureRow
                key={row.id}
                cardLayout={cardLayout}
                isFixtureMode={isFixtureMode}
                onOpenEvidenceException={() => setEvidenceExceptionRowId(row.id)}
                onOpenEvidencePicker={(source) => setEvidencePicker({ highlightedEvidenceRowId: null, rowId: row.id, source })}
                onOpenFoundEvidence={(source, evidenceRowId) => {
                  setEvidencePicker({ highlightedEvidenceRowId: evidenceRowId, rowId: row.id, source })
                }}
                onOpenExclusion={() => setExclusionRowId(row.id)}
                onOpenExplanation={() => setExplanationRowId(row.id)}
                row={row}
                taxInvoiceLayout={taxInvoiceLayout}
              />
            ))
          ) : (
            reconciliationLedgerEmptyRow(
              tableColumnCount,
              '선택한 조건에 해당하는 거래가 없습니다. 전체 탭을 확인하세요.',
            )
          )}
        </ReconciliationLedgerTableShell>

        <ReconciliationEvidencePickerModal
          allRows={rows}
          highlightedEvidenceRowId={evidencePicker?.highlightedEvidenceRowId ?? null}
          isFixtureMode={isFixtureMode}
          onOpenChange={(open) => {
            if (!open) {
              setEvidencePicker(null)
            }
          }}
          open={evidencePicker !== null && evidencePickerRow !== null}
          row={evidencePickerRow}
          source={evidencePicker?.source ?? null}
        />

        <ReconciliationEvidenceExceptionModal
          key={`evidence-exception-${evidenceExceptionRowId ?? 'closed'}`}
          isFixtureMode={isFixtureMode}
          onOpenChange={(open) => {
            if (!open) {
              setEvidenceExceptionRowId(null)
            }
          }}
          open={evidenceExceptionRow !== null}
          row={evidenceExceptionRow}
        />

        <ReconciliationExplanationModal
          key={`explanation-${explanationRowId ?? 'closed'}`}
          isFixtureMode={isFixtureMode}
          onOpenChange={(open) => {
            if (!open) {
              setExplanationRowId(null)
            }
          }}
          open={explanationRow !== null}
          row={explanationRow}
        />

        <ReconciliationExclusionModal
          key={`exclusion-${exclusionRowId ?? 'closed'}`}
          isFixtureMode={isFixtureMode}
          onOpenChange={(open) => {
            if (!open) {
              setExclusionRowId(null)
            }
          }}
          open={exclusionRow !== null}
          row={exclusionRow}
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <ClosingChecklistPanel checklist={checklist} />
          <TaxBlockerPanel summaries={displayModel.taxBlockerSummaries} />
        </section>
      </div>
    </div>
  )
}

function FixtureTopbar({
  companyName,
  isFixtureMode,
}: {
  readonly companyName: string
  readonly isFixtureMode: boolean
}) {
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
        <h1 className="text-base font-semibold text-foreground">
          자료대조원장{isFixtureMode ? ' · Fixture' : ''}
        </h1>
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

function FixtureRow({
  cardLayout,
  isFixtureMode,
  onOpenEvidenceException,
  onOpenEvidencePicker,
  onOpenFoundEvidence,
  onOpenExclusion,
  onOpenExplanation,
  row,
  taxInvoiceLayout,
}: {
  readonly cardLayout: boolean
  readonly isFixtureMode: boolean
  readonly onOpenEvidenceException: () => void
  readonly onOpenEvidencePicker: (source: EvidenceFinderSource) => void
  readonly onOpenFoundEvidence: (source: EvidenceFinderSource, evidenceRowId: string) => void
  readonly onOpenExclusion: () => void
  readonly onOpenExplanation: () => void
  readonly row: ReconciliationLedgerRow
  readonly taxInvoiceLayout: boolean
}) {
  const source = sourceLabels[row.source]
  const tone = evidenceRowHighlightTone(row)
  const amounts = resolveTaxInvoiceAmountBreakdown({
    amountKrw: row.amountKrw,
    taxAmountKrw: row.taxAmountKrw,
    direction: row.direction,
  })

  if (cardLayout) {
    return (
      <tr
        className={cn(
          'border-b border-company-border last:border-b-0 hover:bg-[#fafafa]',
          tone === 'danger' ? 'bg-[#fff7f7]' : '',
        )}
      >
        <td className="px-3 py-3 font-mono text-company-fg-muted">{formatDate(row.transactionDate)}</td>
        <td className="px-3 py-3">
          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="grid size-[22px] place-items-center rounded-md bg-[#1d4ed8] text-[11px] font-bold text-white">카</span>
            카드 승인
          </span>
        </td>
        <td className="overflow-hidden px-3 py-3">
          <LedgerCellText className="font-semibold text-foreground" fallback="가맹점 미정" value={row.counterparty} />
          <div className="mt-0.5 text-[11.5px] text-company-fg-subtle">{directionLabel(row.direction)}</div>
        </td>
        <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">{formatKrw(row.amountKrw)}</td>
        <td className="px-3 py-3 text-right font-mono text-company-fg-muted">{formatKrw(row.taxAmountKrw)}</td>
        <td className="px-3 py-3">
          <StatusChip tone={row.evidenceActionState === 'excluded' ? 'muted' : 'ok'}>
            {row.evidenceActionState === 'excluded' ? '제외됨' : '승인'}
          </StatusChip>
        </td>
        <td className="px-3 py-3">
          <ReconciliationAccountSelector isFixtureMode={isFixtureMode} onOpenExclusion={onOpenExclusion} row={row} />
        </td>
        <td className="px-3 py-3">
          <CardRowActionCell onOpenExplanation={onOpenExplanation} row={row} />
        </td>
      </tr>
    )
  }

  if (taxInvoiceLayout) {
    return (
      <tr
        className={cn(
          'border-b border-company-border last:border-b-0 hover:bg-[#fafafa]',
          tone === 'danger' ? 'bg-[#fff7f7]' : '',
        )}
      >
        <td className="px-3 py-3 font-mono text-company-fg-muted">{formatDate(row.transactionDate)}</td>
        <td className="px-3 py-3">
          <TradeTypeChip direction={row.direction} />
        </td>
        <td className="overflow-hidden px-3 py-3">
          <LedgerCellText className="font-semibold text-foreground" fallback="거래처 미정" value={row.counterparty} />
        </td>
        <td className="overflow-hidden px-3 py-3 align-top">
          <LedgerCellText className="font-semibold text-foreground" value={row.description} />
        </td>
        <td className="px-3 py-3 text-right font-mono whitespace-nowrap text-foreground">{formatKrw(amounts.supplyAmountKrw)}</td>
        <td className="px-3 py-3 text-right font-mono whitespace-nowrap text-foreground">{formatKrw(amounts.taxAmountKrw)}</td>
        <td className="px-3 py-3 text-right font-mono whitespace-nowrap font-semibold text-foreground">{formatKrw(amounts.totalAmountKrw)}</td>
        <td className="px-3 py-3">
          <span className="inline-flex rounded-full border border-company-border bg-company-nav-hover px-2.5 py-0.5 text-[11.5px] font-semibold text-company-fg-muted">
            {TAX_INVOICE_LEDGER_TAX_TYPE_LABEL}
          </span>
        </td>
        <td className="px-3 py-3">
          <ReconciliationEvidenceCell
            onOpenEvidenceException={onOpenEvidenceException}
            onOpenEvidencePicker={onOpenEvidencePicker}
            onOpenFoundEvidence={onOpenFoundEvidence}
            onOpenExplanation={onOpenExplanation}
            row={row}
          />
        </td>
        <td className="px-3 py-3">
          <ReconciliationAccountSelector isFixtureMode={isFixtureMode} onOpenExclusion={onOpenExclusion} row={row} />
        </td>
      </tr>
    )
  }

  return (
    <tr
      className={cn(
        'border-b border-company-border last:border-b-0 hover:bg-[#fafafa]',
        tone === 'danger' ? 'bg-[#fff7f7]' : '',
      )}
    >
      <td className="px-3 py-3 font-mono text-company-fg-muted">{formatDate(row.transactionDate)}</td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center gap-2 font-semibold text-foreground">
          <span className={cn('grid size-[22px] place-items-center rounded-md text-[11px] font-bold text-white', source.className)}>{source.short}</span>
          {source.label}
        </span>
      </td>
      <td className="overflow-hidden px-3 py-3">
        <LedgerCellText className="font-semibold text-foreground" fallback="거래처 미정" value={row.counterparty} />
        <div className="mt-0.5 text-[11.5px] text-company-fg-subtle">{directionLabel(row.direction)}</div>
      </td>
      <td className="overflow-hidden px-3 py-3 align-top">
        <LedgerCellText className="font-semibold text-foreground" value={row.description} />
        {row.patternSuggestion ? (
          <div className="mt-0.5 truncate text-[11.5px] text-company-fg-subtle">{row.patternSuggestion.basisLabel}</div>
        ) : null}
      </td>
      <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">{formatKrw(row.amountKrw)}</td>
      <td className="px-3 py-3">
        <ReconciliationEvidenceCell
          onOpenEvidenceException={onOpenEvidenceException}
          onOpenEvidencePicker={onOpenEvidencePicker}
          onOpenFoundEvidence={onOpenFoundEvidence}
          onOpenExplanation={onOpenExplanation}
          row={row}
        />
      </td>
      <td className="px-3 py-3">
        <ReconciliationAccountSelector isFixtureMode={isFixtureMode} onOpenExclusion={onOpenExclusion} row={row} />
      </td>
      <td className="max-w-[200px] px-3 py-3 text-[12px] text-company-fg-muted">{row.rowConclusion.headline}</td>
    </tr>
  )
}

function CardRowActionCell({
  onOpenExplanation,
  row,
}: {
  readonly onOpenExplanation: () => void
  readonly row: ReconciliationLedgerRow
}) {
  if (row.evidenceActionState === 'explanation_required') {
    return (
      <button
        className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-2 py-1 text-[11.5px] font-semibold text-[#dc2626] hover:bg-[#fee2e2]"
        onClick={onOpenExplanation}
        type="button"
      >
        소명 입력
      </button>
    )
  }

  if (row.evidenceActionState === 'excluded') {
    return <StatusChip tone="muted">제외됨</StatusChip>
  }

  if (row.finalAccount) {
    return <StatusChip tone="ok">계정 확정</StatusChip>
  }

  return <StatusChip tone="warn">계정 확인</StatusChip>
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

function DisplayTabChip({
  active = false,
  count,
  filter,
  isFixtureMode,
  label,
}: {
  readonly active?: boolean
  readonly count: number
  readonly filter: ReconciliationDisplayFilter
  readonly isFixtureMode: boolean
  readonly label: string
}) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-company-surface hover:text-foreground',
        active ? 'bg-company-surface text-foreground shadow-company-card' : 'text-company-fg-muted',
      )}
      href={withFixtureModeParam(reconciliationDisplayFilterHref(filter), isFixtureMode)}
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

function TradeTypeChip({ direction }: { readonly direction: ReconciliationLedgerRow['direction'] }) {
  const label = taxInvoiceTradeTypeLabel(direction)
  const className = direction === 'income'
    ? 'border-[#ddd6fe] bg-[#f5f3ff] text-[#7c3aed]'
    : direction === 'expense'
      ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]'
      : 'border-company-border bg-company-nav-hover text-company-fg-muted'

  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold', className)}>
      {label}
    </span>
  )
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
