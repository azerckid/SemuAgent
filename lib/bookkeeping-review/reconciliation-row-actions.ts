import type {
  ReconciliationLedgerRow,
  ReconciliationMatchCandidate,
  ReconciliationPatternSuggestion,
  ReconciliationSource,
  ReconciliationRowConclusion,
} from './reconciliation-display-model'
import { isCashReceiptDisplaySource } from './reconciliation-display-filters'

type ReconciliationConfidence = ReconciliationMatchCandidate['confidence']
type ReconciliationMatchCandidateReason = ReconciliationMatchCandidate['reason']
type ReconciliationPatternSuggestionReason = NonNullable<ReconciliationPatternSuggestion>['reason']
type ReconciliationRowPrimaryAction = ReconciliationRowConclusion['primaryAction']

export type EvidenceFinderSource = 'tax_invoice' | 'cash_receipt' | 'card'

export const evidenceFinderSourceOptions: Array<{ source: EvidenceFinderSource; label: string }> = [
  { source: 'tax_invoice', label: '세금계산서' },
  { source: 'cash_receipt', label: '현금영수증' },
  { source: 'card', label: '체크카드' },
]

const evidenceSourceLabels: Record<ReconciliationSource, string> = {
  bank: '통장',
  card: '카드',
  tax_invoice: '세금계산서',
  receipt: '현금영수증',
  cash_receipt: '현금영수증',
  other: '기타',
}

export type LinkedEvidenceDisplay = {
  source: ReconciliationSource
  sourceLabel: string
  date: string | null
  counterparty: string | null
  amountKrw: number | null
  description: string | null
  basisLabel: string | null
}

export function computeCandidateTotalKrw(candidates: ReconciliationMatchCandidate[]): number {
  return candidates.reduce((sum, candidate) => sum + (candidate.amountKrw ?? 0), 0)
}

export function computeRemainingDifferenceKrw(
  rowAmountKrw: number | null,
  candidates: ReconciliationMatchCandidate[],
): number | null {
  if (rowAmountKrw === null) {
    return null
  }

  if (candidates.length === 0) {
    return rowAmountKrw
  }

  return rowAmountKrw - computeCandidateTotalKrw(candidates)
}

export function matchesEvidenceFinderSource(
  rowSource: ReconciliationLedgerRow['source'],
  finderSource: EvidenceFinderSource,
): boolean {
  if (finderSource === 'cash_receipt') {
    return isCashReceiptDisplaySource(rowSource)
  }

  return rowSource === finderSource
}

export function listEvidenceFinderBrowseRows(
  allRows: ReconciliationLedgerRow[],
  finderSource: EvidenceFinderSource,
  selectedRowId: string,
): ReconciliationLedgerRow[] {
  return allRows.filter(
    (row) => row.id !== selectedRowId && matchesEvidenceFinderSource(row.source, finderSource),
  )
}

export function resolveLinkedEvidenceDisplay(row: ReconciliationLedgerRow): LinkedEvidenceDisplay[] {
  if (row.evidenceActionState !== 'linked') {
    return []
  }

  if (row.candidates.length > 0) {
    return row.candidates.map((candidate) => ({
      source: candidate.source,
      sourceLabel: evidenceSourceLabels[candidate.source],
      date: candidate.date,
      counterparty: candidate.counterparty,
      amountKrw: candidate.amountKrw,
      description: null,
      basisLabel: matchCandidateReasonLabel(candidate.reason),
    }))
  }

  return [
    {
      source: row.source,
      sourceLabel: evidenceSourceLabels[row.source],
      date: row.transactionDate,
      counterparty: row.counterparty,
      amountKrw: row.amountKrw,
      description: row.description,
      basisLabel: row.rowConclusion.basisLabel,
    },
  ]
}

export function matchCandidateReasonLabel(reason: ReconciliationMatchCandidateReason): string {
  if (reason === 'same_amount_same_day') return '같은 금액·같은 일자'
  if (reason === 'same_amount_near_day') return '같은 금액·인접 일자'
  if (reason === 'same_counterparty_amount') return '같은 거래처·금액'
  if (reason === 'partial_amount') return '부분 금액 일치'
  if (reason === 'many_to_one') return '다건 합산 추천'
  return '수동 참조'
}

export function patternSuggestionReasonLabel(reason: ReconciliationPatternSuggestionReason): string {
  if (reason === 'same_counterparty_prior_account') return '동일 거래처 과거 계정'
  if (reason === 'same_counterparty_prior_evidence') return '동일 거래처 과거 증빙'
  if (reason === 'same_memo_amount_pattern') return '동일 적요·금액 패턴'
  if (reason === 'prior_exclusion_pattern') return '과거 제외 패턴'
  return '반복 내부 이체'
}

export function confidenceLabel(confidence: ReconciliationConfidence): string {
  if (confidence === 'high') return '높음'
  if (confidence === 'medium') return '중간'
  return '낮음'
}

export function rowPrimaryActionLabel(action: ReconciliationRowPrimaryAction): string {
  if (action === 'connect_evidence') return '증빙 연결'
  if (action === 'confirm_account') return '계정 확정'
  if (action === 'write_explanation') return '소명 입력'
  if (action === 'exclude') return '제외 검토'
  if (action === 'mark_exception') return '예외 처리'
  if (action === 'open_source_collection') return '자료수집 이동'
  return '검토'
}

export function formatKrwAmount(value: number | null): string {
  return value === null ? '-' : `${value.toLocaleString('ko-KR')}원`
}

export function hasAiEvidenceSuggestion(row: ReconciliationLedgerRow): boolean {
  return row.candidates.length > 0 && row.evidenceActionState === 'candidate'
}

export function shouldShowEvidenceFinder(row: ReconciliationLedgerRow): boolean {
  if (row.rowConclusion.primaryAction === 'open_source_collection') {
    return false
  }

  if (row.evidenceActionState === 'linked') {
    return false
  }

  return (
    row.evidenceActionState === 'evidence_required'
    || hasAiEvidenceSuggestion(row)
    || row.rowConclusion.primaryAction === 'connect_evidence'
  )
}

export function evidenceActionChipLabel(
  state: ReconciliationLedgerRow['evidenceActionState'],
): { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' } | null {
  if (state === 'candidate') {
    return { label: 'AI 증빙 확인', tone: 'warn' }
  }

  if (state === 'linked') {
    return { label: '증빙있음', tone: 'ok' }
  }
  if (state === 'evidence_required') {
    return { label: '증빙 필요', tone: 'danger' }
  }
  if (state === 'explanation_required') {
    return { label: '소명 필요', tone: 'warn' }
  }
  if (state === 'explained_no_evidence') {
    return { label: '소명 완료', tone: 'ok' }
  }
  if (state === 'evidence_exception') {
    return { label: '증빙 예외', tone: 'warn' }
  }
  if (state === 'excluded') {
    return { label: '제외됨', tone: 'muted' }
  }

  return null
}

export function formatRemainingDifferenceLabel(differenceKrw: number | null): string {
  if (differenceKrw === null) {
    return '차액 미계산'
  }

  if (differenceKrw === 0) {
    return '차액 없음'
  }

  const prefix = differenceKrw > 0 ? '+' : ''
  return `잔여 차액 ${prefix}${differenceKrw.toLocaleString('ko-KR')}원`
}
