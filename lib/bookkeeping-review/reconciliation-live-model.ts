import type {
  BookkeepingReviewQueueRow,
  ReconciliationMatchCandidate as LiveMatchCandidate,
} from './summary'
import { isEvidenceSource } from './summary'
import { matchCandidateReasonLabel } from './reconciliation-row-actions'
import type {
  ReconciliationEvidenceActionState,
  ReconciliationLedgerRow,
  ReconciliationMatchCandidate,
  ReconciliationPeriodMode,
  ReconciliationRowConclusion,
  ReconciliationRowPrimaryAction,
} from './reconciliation-display-model'

const disabledActionNote = 'Slice 2b 전까지 저장·확정이 비활성화됩니다.'

export function mapLiveEvidenceActionState(row: BookkeepingReviewQueueRow): ReconciliationEvidenceActionState {
  if (row.status === 'excluded') {
    return 'excluded'
  }

  if (row.reconciliation.candidates.length > 0) {
    return 'candidate'
  }

  // card/receipt/tax_invoice rows are themselves evidence documents (see
  // isEvidenceSource in summary.ts) — a missing bank-side match means the
  // payment/settlement isn't confirmed yet, not that evidence is missing.
  if (!isEvidenceSource(row.sourceType)) {
    return 'evidence_required'
  }

  return 'linked'
}

export function mapLiveMatchCandidate(candidate: LiveMatchCandidate): ReconciliationMatchCandidate {
  return {
    id: candidate.id,
    source: candidate.sourceType,
    rowId: candidate.rowId,
    date: candidate.date,
    counterparty: candidate.counterparty,
    amountKrw: candidate.amountKrw,
    taxAmountKrw: null,
    confidence: candidate.confidence,
    reason: candidate.reason,
  }
}

export function resolveLivePrimaryAction(
  row: BookkeepingReviewQueueRow,
  evidenceActionState: ReconciliationEvidenceActionState,
): ReconciliationRowPrimaryAction {
  if (evidenceActionState === 'excluded') {
    return 'review_only'
  }
  if (evidenceActionState === 'evidence_required' || evidenceActionState === 'candidate') {
    return 'connect_evidence'
  }
  if (row.status !== 'confirmed') {
    return 'confirm_account'
  }
  return 'review_only'
}

export function buildLiveRowConclusion(
  row: BookkeepingReviewQueueRow,
  evidenceActionState: ReconciliationEvidenceActionState,
): ReconciliationRowConclusion {
  const topCandidate = row.reconciliation.candidates[0] ?? null

  const headline = (() => {
    if (evidenceActionState === 'excluded') return '제외된 거래입니다'
    if (evidenceActionState === 'candidate' && topCandidate) return `AI가 증빙을 찾았습니다 (${matchCandidateReasonLabel(topCandidate.reason)}) — 확인해주세요`
    if (evidenceActionState === 'candidate') return '증빙을 확인해주세요'
    if (evidenceActionState === 'evidence_required') return '증빙을 연결해야 합니다'
    if (row.status !== 'confirmed') return '계정항목을 확정해야 합니다'
    return '검토가 완료된 거래입니다'
  })()

  const basisLabel = (() => {
    if (topCandidate) return matchCandidateReasonLabel(topCandidate.reason)
    if (row.recommendedAccount) return `AI 추천 계정: ${row.recommendedAccount}`
    return '자동 판단 근거 없음'
  })()

  return {
    headline,
    basisLabel,
    primaryAction: resolveLivePrimaryAction(row, evidenceActionState),
    actionEnabled: false,
    disabledReason: disabledActionNote,
  }
}

export function buildLiveReconciliationLedgerRow(
  row: BookkeepingReviewQueueRow,
  period: { mode: ReconciliationPeriodMode; label: string },
): ReconciliationLedgerRow {
  const evidenceActionState = mapLiveEvidenceActionState(row)
  const candidates = row.reconciliation.candidates.map(mapLiveMatchCandidate)

  return {
    id: row.id,
    periodMode: period.mode,
    periodLabel: period.label,
    source: row.sourceType,
    transactionDate: row.transactionDate,
    counterparty: row.counterparty,
    description: row.description,
    direction: row.direction,
    amountKrw: row.amountKrw,
    taxAmountKrw: null,
    recommendedAccount: row.recommendedAccount,
    finalAccount: row.finalAccount,
    explanationMemo: null,
    exclusionReason: null,
    matchState: row.reconciliation.matchState,
    evidenceActionState,
    candidates,
    patternSuggestion: null,
    rowConclusion: buildLiveRowConclusion(row, evidenceActionState),
    blockers: row.reconciliation.blockers,
    actions: {
      canConfirmAccount: false,
      canExplain: false,
      canExclude: false,
      canConfirmMatch: false,
    },
  }
}
