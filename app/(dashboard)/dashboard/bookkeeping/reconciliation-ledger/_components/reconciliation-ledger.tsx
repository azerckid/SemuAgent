import Link from 'next/link'
import type { ReactNode } from 'react'
import { z } from 'zod'
import type { BookkeepingReviewQueueRow, BookkeepingReviewSummary } from '@/lib/bookkeeping-review/summary'
import { cn } from '@/lib/utils'

const panelClass = 'overflow-hidden rounded-xl border border-company-border bg-company-surface shadow-company-card'

type SourceKind = BookkeepingReviewQueueRow['sourceType']
const reconciliationFilterValues = ['all', 'bank', 'card', 'receipt', 'tax_invoice', 'other', 'missing_evidence', 'exclusion_review'] as const
const reconciliationFilterSchema = z.enum(reconciliationFilterValues)
export type ReconciliationFilter = (typeof reconciliationFilterValues)[number]
type Tone = 'ok' | 'warn' | 'danger' | 'muted'

const sourceLabels: Record<SourceKind, { label: string; short: string; className: string }> = {
  bank: { label: '통장', short: '통', className: 'bg-[#0f766e]' },
  card: { label: '카드', short: '카', className: 'bg-[#1d4ed8]' },
  tax_invoice: { label: '세금계산서', short: '세', className: 'bg-[#7c3aed]' },
  receipt: { label: '현금영수증', short: '현', className: 'bg-[#ca8a04]' },
  other: { label: '기타', short: '기', className: 'bg-company-fg-muted' },
}

const chipClass: Record<Tone, string> = {
  ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]',
  warn: 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]',
  danger: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
  muted: 'border-company-border bg-company-nav-hover text-company-fg-muted',
}

export interface ReconciliationLedgerViewProps {
  readonly activeFilter: ReconciliationFilter
  readonly summary: BookkeepingReviewSummary
}

export function ReconciliationLedgerView({ activeFilter, summary }: ReconciliationLedgerViewProps) {
  const rows = summary.rows
  const filteredRows = filterReconciliationRows(rows, activeFilter)
  const sourceCounts = buildSourceCounts(rows)
  const confirmedCount = summary.counts.confirmed
  const blockerRows = rows.filter((row) => row.reconciliation.blockers.length > 0)
  const readyLedgerCount = rows.filter((row) => row.status === 'confirmed' && row.reconciliation.blockers.length === 0).length
  const pendingCount = blockerRows.length
  const evidenceMissingCount = rows.filter(hasMissingEvidenceBlocker).length
  const exclusionReviewCount = rows.filter(hasExclusionReviewBlocker).length
  const readinessPercent = summary.counts.total > 0
    ? Math.round((readyLedgerCount / summary.counts.total) * 100)
    : 0

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <ReconciliationTopbar summary={summary} />
      <div className="flex w-full max-w-[1320px] flex-col gap-5 px-7 pt-6 pb-12">
        <section className={cn(panelClass, 'grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_360px]')}>
          <div>
            <p className="text-xs font-semibold text-company-fg-muted">Path 1 데이터 준비 관문</p>
            <h2 className="mt-2 text-[23px] font-bold text-foreground">
              통장·카드·세금계산서·현금영수증을 한 원장으로 대조하고 확정합니다
            </h2>
            <p className="mt-2 max-w-[720px] text-[13px] text-company-fg-muted">
              자료수집이 끝난 뒤 제일 먼저 보는 화면입니다. 증빙 연결, 중복·사적 사용 제외, 계정항목 확정이 끝난 거래만 세목별 신고 양식·파일에 들어갈 수 있습니다.
            </p>
            <div className="mt-4 h-2 max-w-[520px] overflow-hidden rounded-full bg-[#e4e4e7]">
              <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${readinessPercent}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="원장 준비율" value={`${readinessPercent}%`} />
            <MetricCard label="확정 거래" value={`${confirmedCount}건`} />
            <MetricCard label="확인 필요" value={`${pendingCount}건`} />
            <MetricCard label="증빙 필요" value={`${evidenceMissingCount}건`} />
          </div>
        </section>

        <div className="rounded-[10px] border border-[#fed7aa] bg-[#fff7ed] px-3.5 py-3 text-[12.5px] text-[#9a3412]">
          자료대조원장은 신고 준비 화면이 아니라 기장검토 하위 관문입니다. 여기서 확정된 거래원장을 부가세·사업장현황신고·지방소득세 등 Path 1 양식 생성 화면이 읽습니다.
        </div>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <SourceSummaryCard label="통장 내역" count={sourceCounts.bank} sub="입출금 대조" />
          <SourceSummaryCard label="카드 승인" count={sourceCounts.card} sub="계정·거래처 확인" />
          <SourceSummaryCard label="세금계산서" count={sourceCounts.tax_invoice} sub="매출·매입 증빙" />
          <SourceSummaryCard label="현금영수증" count={sourceCounts.receipt} sub="공제·제외 검토" />
          <SourceSummaryCard label="제외 검토" count={exclusionReviewCount} sub="업무무관·중복 의심" />
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap gap-0.5 rounded-[9px] bg-[#f1f1f2] p-[3px]">
            <TabChip active={activeFilter === 'all'} count={summary.counts.total} filter="all" label="전체" periodKey={summary.period.key} />
            <TabChip active={activeFilter === 'bank'} count={sourceCounts.bank} filter="bank" label="통장" periodKey={summary.period.key} />
            <TabChip active={activeFilter === 'card'} count={sourceCounts.card} filter="card" label="카드" periodKey={summary.period.key} />
            <TabChip active={activeFilter === 'tax_invoice'} count={sourceCounts.tax_invoice} filter="tax_invoice" label="세금계산서" periodKey={summary.period.key} />
            <TabChip active={activeFilter === 'receipt'} count={sourceCounts.receipt} filter="receipt" label="현금영수증" periodKey={summary.period.key} />
            <TabChip active={activeFilter === 'missing_evidence'} count={evidenceMissingCount} filter="missing_evidence" label="증빙 필요" periodKey={summary.period.key} />
            <TabChip active={activeFilter === 'exclusion_review'} count={exclusionReviewCount} filter="exclusion_review" label="제외 검토" periodKey={summary.period.key} />
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
            type="button"
          >
            표시 설정
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
                  <th className="px-3 py-3">연결 증빙</th>
                  <th className="px-3 py-3">계정항목</th>
                  <th className="px-3 py-3">상태</th>
                  <th className="px-3 py-3">처리</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? filteredRows.slice(0, 80).map((row) => (
                  <ReconciliationRow key={row.id} row={row} periodKey={summary.period.key} />
                )) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-company-fg-muted">
                      선택한 조건에 해당하는 거래가 없습니다. 전체 탭에서 원장 상태를 다시 확인하세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ReadinessChecklist rows={rows} />
          <TaxFileGate summary={summary} />
        </section>
      </div>
    </div>
  )
}

function ReconciliationTopbar({ summary }: { readonly summary: BookkeepingReviewSummary }) {
  const companyName = summary.businessEntity?.name ?? summary.tenant.name

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
        <h1 className="text-base font-semibold text-foreground">자료대조원장</h1>
      </div>
      <span className="text-[13px] font-medium text-company-fg-muted">{companyName}</span>
      <div className="ml-auto rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground">
        {summary.period.label}
      </div>
    </div>
  )
}

function ReconciliationRow({ row, periodKey }: { readonly row: BookkeepingReviewQueueRow; readonly periodKey: string }) {
  const source = sourceLabels[row.sourceType]
  const status = reconciliationStatus(row)
  const evidence = evidenceStatus(row)
  const href = `/dashboard/bookkeeping?period=${encodeURIComponent(periodKey)}&tab=all&rowId=${encodeURIComponent(row.id)}`

  return (
    <tr className={cn('border-b border-company-border last:border-b-0 hover:bg-[#fafafa]', status.tone === 'danger' ? 'bg-[#fff7f7]' : status.tone === 'warn' ? 'bg-[#fffaf0]' : '')}>
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
      <td className="max-w-[260px] px-3 py-3">
        <div className="truncate font-semibold text-foreground">{row.description}</div>
        <div className="mt-0.5 text-[11.5px] text-company-fg-subtle">AI 신뢰도 {confidenceLabel(row.confidence)}</div>
      </td>
      <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">{formatKrw(row.amountKrw)}</td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1">
          <StatusChip tone={evidence.tone}>{evidence.label}</StatusChip>
          {row.reconciliation.candidates[0] ? (
            <span className="max-w-[180px] truncate text-[11px] text-company-fg-subtle">
              {candidateSummary(row.reconciliation.candidates[0])}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex min-w-[112px] items-center justify-between gap-2 rounded-md border border-company-border bg-[#fcfcfd] px-2 py-1 text-[12px]">
          {row.finalAccount ?? row.recommendedAccount ?? '계정 미정'} <span className="text-company-fg-subtle">▾</span>
        </span>
      </td>
      <td className="px-3 py-3"><StatusChip tone={status.tone}>{status.label}</StatusChip></td>
      <td className="px-3 py-3">
        <Link href={href} className="rounded-md border border-company-border-strong bg-company-surface px-2.5 py-1 text-[11.5px] font-semibold text-foreground">
          {status.actionLabel}
        </Link>
      </td>
    </tr>
  )
}

function ReadinessChecklist({ rows }: { readonly rows: BookkeepingReviewQueueRow[] }) {
  const pending = rows.filter((row) => row.status !== 'confirmed').length
  const low = rows.filter(hasExclusionReviewBlocker).length
  const missingEvidence = rows.filter(hasMissingEvidenceBlocker).length

  return (
    <section className={cn(panelClass, 'p-4')}>
      <h3 className="text-[13.5px] font-semibold text-foreground">확정 조건</h3>
      <div className="mt-3 grid gap-2">
        <ChecklistLine label="자료 수집" chip={<StatusChip tone={rows.length > 0 ? 'ok' : 'muted'}>{rows.length > 0 ? '거래 있음' : '대기'}</StatusChip>} />
        <ChecklistLine label="증빙 연결" chip={<StatusChip tone={missingEvidence > 0 ? 'warn' : 'ok'}>{missingEvidence > 0 ? `${missingEvidence}건 확인` : '확인 완료'}</StatusChip>} />
        <ChecklistLine label="계정항목" chip={<StatusChip tone={pending > 0 ? 'warn' : 'ok'}>{pending > 0 ? `${pending}건 미확정` : '확정'}</StatusChip>} />
        <ChecklistLine label="업무무관/사적 사용 제외" chip={<StatusChip tone={low > 0 ? 'warn' : 'ok'}>{low > 0 ? `${low}건 검토` : '특이사항 없음'}</StatusChip>} />
      </div>
    </section>
  )
}

function TaxFileGate({ summary }: { readonly summary: BookkeepingReviewSummary }) {
  const blocked = summary.rows.filter((row) => row.reconciliation.blockers.length > 0).length
  return (
    <section className={cn(panelClass, 'p-4')}>
      <h3 className="text-[13.5px] font-semibold text-foreground">세목별 양식 생성 가능 여부</h3>
      <div className="mt-3 grid gap-2">
        <ChecklistLine label="부가세 Path 1 양식" chip={<StatusChip tone={blocked > 0 ? 'danger' : 'ok'}>{blocked > 0 ? `blocker ${blocked}건` : '생성 가능'}</StatusChip>} />
        <ChecklistLine label="사업장현황신고" chip={<StatusChip tone={summary.counts.pending > 0 ? 'warn' : 'ok'}>{summary.counts.pending > 0 ? '수입금액 확인' : '준비 가능'}</StatusChip>} />
        <ChecklistLine label="간이지급명세서" chip={<StatusChip tone="muted">급여 검토 사용</StatusChip>} />
        <ChecklistLine label="지방소득세" chip={<StatusChip tone="muted">급여 확정값 사용</StatusChip>} />
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

function TabChip({ active = false, count, filter, label, periodKey }: { readonly active?: boolean; readonly count: number; readonly filter: ReconciliationFilter; readonly label: string; readonly periodKey: string }) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-company-surface hover:text-foreground',
        active ? 'bg-company-surface text-foreground shadow-company-card' : 'text-company-fg-muted',
      )}
      href={reconciliationFilterHref(periodKey, filter)}
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

function buildSourceCounts(rows: BookkeepingReviewQueueRow[]): Record<SourceKind, number> {
  return rows.reduce<Record<SourceKind, number>>((acc, row) => {
    acc[row.sourceType] += 1
    return acc
  }, { bank: 0, card: 0, receipt: 0, tax_invoice: 0, other: 0 })
}

function reconciliationStatus(row: BookkeepingReviewQueueRow): { label: string; tone: Tone; actionLabel: string } {
  if (row.requiresManualAccount) return { label: '계정 확인', tone: 'danger', actionLabel: '계정 지정' }
  if (row.status === 'unclassified') return { label: '분류 필요', tone: 'danger', actionLabel: '분류' }
  if (hasMissingEvidenceBlocker(row)) return { label: '증빙 확인', tone: 'danger', actionLabel: '확인' }
  if (row.reconciliation.matchState === 'ambiguous') return { label: '대조 필요', tone: 'warn', actionLabel: '확인' }
  if (row.reconciliation.matchState === 'candidate') return { label: 'AI 증빙 확인', tone: 'warn', actionLabel: '확인' }
  if (row.status === 'confirmed') return { label: '확정', tone: 'ok', actionLabel: '보기' }
  return { label: '확인 필요', tone: 'warn', actionLabel: '확인' }
}

function evidenceStatus(row: BookkeepingReviewQueueRow): { label: string; tone: Tone } {
  if (row.reconciliation.candidates.length > 0) return { label: 'AI 증빙 확인', tone: 'warn' }
  if (hasMissingEvidenceBlocker(row)) return { label: '증빙 필요', tone: 'danger' }
  if (row.status === 'confirmed') return { label: '확정 자료', tone: 'ok' }
  return { label: '원천 자료 확인', tone: 'warn' }
}

function confidenceLabel(confidence: BookkeepingReviewQueueRow['confidence']) {
  return confidence === 'high' ? '높음' : confidence === 'medium' ? '중간' : '낮음'
}

function directionLabel(direction: BookkeepingReviewQueueRow['direction']) {
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

export function normalizeReconciliationFilter(value: string | undefined): ReconciliationFilter {
  const parsed = reconciliationFilterSchema.safeParse(value)
  return parsed.success ? parsed.data : 'all'
}

export function filterReconciliationRows(rows: BookkeepingReviewQueueRow[], filter: ReconciliationFilter) {
  if (filter === 'all') return rows
  if (filter === 'missing_evidence') return rows.filter(hasMissingEvidenceBlocker)
  if (filter === 'exclusion_review') return rows.filter(hasExclusionReviewBlocker)
  return rows.filter((row) => row.sourceType === filter)
}

function hasMissingEvidenceBlocker(row: BookkeepingReviewQueueRow) {
  return row.reconciliation.blockers.some((blocker) => blocker.code === 'missing_evidence')
}

function hasExclusionReviewBlocker(row: BookkeepingReviewQueueRow) {
  return row.reconciliation.blockers.some((blocker) =>
    blocker.code === 'explanation_required'
    || blocker.code === 'exclude_reason_required'
    || blocker.code === 'tax_specific_review_required'
  )
}

function candidateSummary(candidate: BookkeepingReviewQueueRow['reconciliation']['candidates'][number]) {
  return `${sourceLabels[candidate.sourceType].label} · ${formatDate(candidate.date)} · ${formatKrw(candidate.amountKrw)}`
}

export function reconciliationFilterHref(periodKey: string, filter: ReconciliationFilter) {
  const params = new URLSearchParams({ period: periodKey })
  if (filter !== 'all') params.set('source', filter)
  return `/dashboard/bookkeeping/reconciliation-ledger?${params.toString()}`
}
