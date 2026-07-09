import type {
  BookkeepingReviewQueueRow,
  ReconciliationMatchCandidate as LiveMatchCandidate,
} from './summary'
import { isEvidenceSource } from './summary'
import { isEvidenceExceptionMemo, matchCandidateReasonLabel } from './reconciliation-row-actions'
import { looksPersonallyUseSuspicious } from './reconciliation-personal-use-detection'
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

  if (isEvidenceExceptionMemo(row.staffMemo)) {
    return 'evidence_exception'
  }

  // A user-confirmed evidence link (JC-010 2b-2) always wins over the
  // AI candidate list — buildReconciliationInfo collapses candidates down
  // to a single manual_reference entry once linkedEvidenceRowId is set,
  // so checking the raw field here (rather than candidates.length) keeps
  // this branch from falling through to the 'candidate' case below.
  if (row.linkedEvidenceRowId) {
    return 'linked'
  }

  // Personal-use suspicion must be checked before the candidate/evidence
  // match logic: confirming that a bank record matches this payment answers
  // "did this payment happen", not "was this a legitimate business expense".
  // explanation_required and candidate/evidence_required are meant to be
  // mutually exclusive (Brief 41 §5.1), so a personal-use-suspicious row
  // routes to explanation even when a matching bank candidate exists.
  if (
    isEvidenceSource(row.sourceType)
    && looksPersonallyUseSuspicious({ counterparty: row.counterparty, description: row.description })
  ) {
    return row.staffMemo?.trim() ? 'explained_no_evidence' : 'explanation_required'
  }

  const hasExactEvidenceCandidate = row.reconciliation.candidates.some(
    (candidate) => candidate.reason !== 'partial_amount' && candidate.reason !== 'many_to_one',
  )
  if (hasExactEvidenceCandidate) {
    return 'candidate'
  }

  // card/receipt/tax_invoice rows are themselves evidence documents (see
  // isEvidenceSource in summary.ts) — a missing bank-side match means the
  // payment/settlement isn't confirmed yet, not that evidence is missing.
  // Live bank/other rows cannot yet be routed into the explanation path in
  // general — there is no broad private/business-unrelated detection for
  // them — so they stay evidence_required.
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
  if (evidenceActionState === 'explanation_required') {
    return 'write_explanation'
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
    if (evidenceActionState === 'evidence_exception' && row.status !== 'confirmed') return '증빙 예외 처리 완료 · 계정항목을 확정해야 합니다'
    if (evidenceActionState === 'evidence_exception') return '증빙 예외 처리된 거래입니다'
    if (evidenceActionState === 'candidate' && topCandidate) return `AI가 증빙을 찾았습니다 (${matchCandidateReasonLabel(topCandidate.reason)}) — 확인해주세요`
    if (evidenceActionState === 'candidate') return '증빙을 확인해주세요'
    if (evidenceActionState === 'evidence_required') return '증빙을 연결해야 합니다'
    if (evidenceActionState === 'explanation_required') return '업무 관련성 소명이 필요합니다'
    if (evidenceActionState === 'explained_no_evidence' && row.status !== 'confirmed') return '소명 완료 · 계정항목을 확정해야 합니다'
    if (row.status !== 'confirmed') return '계정항목을 확정해야 합니다'
    return '검토가 완료된 거래입니다'
  })()

  const basisLabel = (() => {
    if (evidenceActionState === 'evidence_exception') return row.staffMemo ?? '증빙 예외 사유 기록됨'
    if (topCandidate) return matchCandidateReasonLabel(topCandidate.reason)
    if (evidenceActionState === 'explanation_required' || evidenceActionState === 'explained_no_evidence') {
      return '업무무관 의심 패턴 (영화관·미용실·PC방 등)'
    }
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
    uploadSessionId: row.uploadSessionId,
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
    explanationMemo: row.staffMemo,
    exclusionReason: null,
    matchState: row.reconciliation.matchState,
    evidenceActionState,
    candidates,
    patternSuggestion: null,
    rowConclusion: buildLiveRowConclusion(row, evidenceActionState),
    blockers: row.reconciliation.blockers,
    actions: {
      canConfirmAccount: evidenceActionState !== 'excluded',
      canExplain: evidenceActionState === 'explanation_required' || evidenceActionState === 'explained_no_evidence',
      canExclude: evidenceActionState !== 'excluded',
      canConfirmMatch: false,
    },
  }
}
