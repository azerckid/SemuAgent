import type { BookkeepingReviewSummary } from './summary'
import { buildLiveReconciliationLedgerRow } from './reconciliation-live-model'
import type {
  ReconciliationBatchSuggestionGroup,
  ReconciliationClosingChecklist,
  ReconciliationLedgerDisplayModel,
  ReconciliationLedgerRow,
  ReconciliationNextAction,
  ReconciliationPeriodMode,
  ReconciliationTaxBlockerSummary,
} from './reconciliation-display-model'

const NEXT_ACTION_ROUTE = '/dashboard/bookkeeping/reconciliation-ledger'

export function inferReconciliationPeriodMode(periodKey: string): ReconciliationPeriodMode {
  if (/^\d{4}-H[12]$/.test(periodKey)) return 'half_year'
  if (/^\d{4}-Q[1-4]$/.test(periodKey)) return 'quarter'
  if (/^\d{4}-\d{2}$/.test(periodKey)) return 'month'
  return 'custom'
}

// v1 has no structured exclusionReason column (2b-1 decision) — the reason
// text is saved into the same staffMemo column explanationMemo already
// reads (see buildLiveReconciliationLedgerRow). row.exclusionReason itself
// stays permanently null for live rows, so "has a reason been recorded"
// must be read from explanationMemo instead, or a saved reason would never
// clear the "제외 사유 필요" blocker.
function rowNeedsExclusionReason(row: ReconciliationLedgerRow): boolean {
  return row.evidenceActionState === 'excluded' && !row.explanationMemo?.trim()
}

export function buildLiveClosingChecklist(rows: ReconciliationLedgerRow[]): ReconciliationClosingChecklist {
  const evidenceRequiredCount = rows.filter((row) => row.evidenceActionState === 'evidence_required').length
  const explanationRequiredCount = rows.filter((row) => row.evidenceActionState === 'explanation_required').length
  const accountUnconfirmedCount = rows.filter(
    (row) => row.blockers.some((blocker) => blocker.code === 'account_unconfirmed'),
  ).length
  const exclusionReasonRequiredCount = rows.filter(rowNeedsExclusionReason).length
  const taxBlockerCount = evidenceRequiredCount + explanationRequiredCount + accountUnconfirmedCount + exclusionReasonRequiredCount

  return {
    evidenceRequiredCount,
    explanationRequiredCount,
    accountUnconfirmedCount,
    exclusionReasonRequiredCount,
    taxBlockerCount,
    isReadyForPath1: taxBlockerCount === 0,
  }
}

export function buildLiveTaxBlockerSummaries(
  checklist: ReconciliationClosingChecklist,
): ReconciliationTaxBlockerSummary[] {
  const topReasons: ReconciliationTaxBlockerSummary['topReasons'] = [
    checklist.evidenceRequiredCount > 0
      ? { code: 'missing_evidence' as const, label: '증빙 필요', count: checklist.evidenceRequiredCount }
      : null,
    checklist.accountUnconfirmedCount > 0
      ? { code: 'account_unconfirmed' as const, label: '계정항목 미확정', count: checklist.accountUnconfirmedCount }
      : null,
    checklist.explanationRequiredCount > 0
      ? { code: 'explanation_required' as const, label: '소명 필요', count: checklist.explanationRequiredCount }
      : null,
    checklist.exclusionReasonRequiredCount > 0
      ? { code: 'exclude_reason_required' as const, label: '제외 사유 필요', count: checklist.exclusionReasonRequiredCount }
      : null,
  ].filter((reason): reason is NonNullable<typeof reason> => reason !== null)

  // Only the VAT track is derivable from this screen's data today. The other
  // tax tracks (사업장현황신고/원천세/지방소득세/간이지급명세서) depend on
  // separate data sources (payroll, filing-preparation) this screen does not
  // read, so we do not fabricate a canGeneratePath1File claim for them here.
  return [
    {
      taxTrack: 'vat',
      label: '부가세 Path 1 양식',
      blockerCount: checklist.taxBlockerCount,
      topReasons,
      canGeneratePath1File: checklist.isReadyForPath1,
    },
  ]
}

function sortByAmountDesc(rows: ReconciliationLedgerRow[]) {
  return [...rows].sort((a, b) => (b.amountKrw ?? 0) - (a.amountKrw ?? 0))
}

export function buildLiveNextActions(rows: ReconciliationLedgerRow[]): ReconciliationNextAction[] {
  const actions: ReconciliationNextAction[] = []

  const evidenceRequiredRows = sortByAmountDesc(rows.filter((row) => row.evidenceActionState === 'evidence_required'))
  if (evidenceRequiredRows.length > 0) {
    actions.push({
      id: 'live-evidence-required',
      label: `증빙 필요 ${evidenceRequiredRows.length}건`,
      reason: '증빙 연결이 없으면 Path 1 파일 생성이 차단됩니다',
      priority: 'filing_blocker',
      targetRowId: evidenceRequiredRows[0]!.id,
      targetRoute: `${NEXT_ACTION_ROUTE}?source=evidence_required`,
    })
  }

  const accountUnconfirmedRows = sortByAmountDesc(
    rows.filter((row) => row.blockers.some((blocker) => blocker.code === 'account_unconfirmed')),
  )
  if (accountUnconfirmedRows.length > 0) {
    actions.push({
      id: 'live-account-unconfirmed',
      label: `계정항목 미확정 ${accountUnconfirmedRows.length}건`,
      reason: '계정항목이 확정돼야 신고 자료로 반영됩니다',
      priority: 'manual_review',
      targetRowId: accountUnconfirmedRows[0]!.id,
      targetRoute: NEXT_ACTION_ROUTE,
    })
  }

  const exclusionReasonRequiredRows = sortByAmountDesc(rows.filter(rowNeedsExclusionReason))
  if (exclusionReasonRequiredRows.length > 0) {
    actions.push({
      id: 'live-exclusion-reason-required',
      label: `제외 사유 필요 ${exclusionReasonRequiredRows.length}건`,
      reason: '제외 사유가 없으면 Path 1 파일 생성이 차단됩니다',
      priority: 'filing_blocker',
      targetRowId: exclusionReasonRequiredRows[0]!.id,
      targetRoute: `${NEXT_ACTION_ROUTE}?source=exclusion_review`,
    })
  }

  return actions
}

export function buildLiveBatchSuggestionGroups(): ReconciliationBatchSuggestionGroup[] {
  // Batch groups require rows that share the same patternSuggestion.reason
  // (Brief 41 §0.4). patternSuggestion is always null for live rows today —
  // §5.2 pattern learning is out of scope for Slice 2a-5 — so there is no
  // honest basis for a batch group yet.
  return []
}

export function buildLiveReconciliationLedgerDisplayModel(
  summary: BookkeepingReviewSummary,
): ReconciliationLedgerDisplayModel {
  const periodMode = inferReconciliationPeriodMode(summary.period.key)
  const rows = summary.rows.map((row) =>
    buildLiveReconciliationLedgerRow(row, { mode: periodMode, label: summary.period.label }),
  )
  const closingChecklist = buildLiveClosingChecklist(rows)

  return {
    rows,
    nextActions: buildLiveNextActions(rows),
    taxBlockerSummaries: buildLiveTaxBlockerSummaries(closingChecklist),
    closingChecklist,
    batchSuggestionGroups: buildLiveBatchSuggestionGroups(),
  }
}
