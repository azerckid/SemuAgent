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

const exclusionReasonLabels = {
  personal_private: '개인/사적 사용',
  business_unrelated: '업무무관',
  duplicate_evidence: '중복 증빙',
  wrong_period: '기간 오류',
  reference_only: '참고 자료',
  non_deductible_vat: '불공제',
  internal_transfer: '내부이체',
  refund_or_cancellation: '환불/취소',
  unsupported_needs_review: '수동 검토 필요',
} satisfies Record<NonNullable<ReconciliationPatternSuggestion>['suggestedExclusionReason'] & string, string>

export function evidenceSourceLabel(source: ReconciliationSource): string {
  return evidenceSourceLabels[source]
}

export function exclusionReasonLabel(reason: NonNullable<ReconciliationPatternSuggestion>['suggestedExclusionReason']): string {
  return reason ? exclusionReasonLabels[reason] : '제외 사유'
}

export type LinkedEvidenceDisplay = {
  rowId: string | null
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

export function evidenceFinderSourceForLinkedEvidence(
  source: ReconciliationSource,
): EvidenceFinderSource | null {
  if (source === 'tax_invoice') return 'tax_invoice'
  if (source === 'receipt' || source === 'cash_receipt') return 'cash_receipt'
  if (source === 'card') return 'card'
  return null
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

export function filterEvidenceFinderBrowseRows(
  rows: ReconciliationLedgerRow[],
  filters: { query: string; date: string },
): ReconciliationLedgerRow[] {
  const query = filters.query.trim().toLowerCase().replace(/,/g, '')
  const date = filters.date.trim()

  return rows.filter((row) => {
    if (date && !(row.transactionDate ?? '').includes(date)) {
      return false
    }
    if (!query) {
      return true
    }
    const haystack = [
      row.counterparty ?? '',
      row.description,
      row.amountKrw !== null ? String(row.amountKrw) : '',
    ].join(' ').toLowerCase()
    return haystack.includes(query)
  })
}

export function resolveEvidenceFinderRowMatch(
  candidates: ReconciliationMatchCandidate[],
  browseRowId: string,
): ReconciliationMatchCandidate | null {
  return candidates.find((candidate) => candidate.rowId === browseRowId) ?? null
}

export function isSavedEvidenceReference(candidate: ReconciliationMatchCandidate | null): boolean {
  return candidate?.reason === 'manual_reference'
}

export function isAmountDifferenceEvidenceReference(candidate: ReconciliationMatchCandidate | null): boolean {
  return candidate?.reason === 'partial_amount' || candidate?.reason === 'many_to_one'
}

export function isFoundEvidenceReference(candidate: ReconciliationMatchCandidate | null): boolean {
  return candidate !== null && !isSavedEvidenceReference(candidate) && !isAmountDifferenceEvidenceReference(candidate)
}

export function hasEvidenceFinderAiMatch(
  candidates: ReconciliationMatchCandidate[],
  browseRows: ReconciliationLedgerRow[],
): boolean {
  return browseRows.some((browseRow) => {
    const candidate = resolveEvidenceFinderRowMatch(candidates, browseRow.id)
    return isFoundEvidenceReference(candidate)
  })
}

export function hasEvidenceFinderAmountDifference(
  candidates: ReconciliationMatchCandidate[],
  browseRows: ReconciliationLedgerRow[],
): boolean {
  return browseRows.some((browseRow) => {
    const candidate = resolveEvidenceFinderRowMatch(candidates, browseRow.id)
    return isAmountDifferenceEvidenceReference(candidate)
  })
}

export function hasDifferentAbsoluteAmount(
  rowAmountKrw: number | null,
  evidenceAmountKrw: number | null,
): boolean {
  return rowAmountKrw !== null
    && evidenceAmountKrw !== null
    && Math.abs(rowAmountKrw) !== Math.abs(evidenceAmountKrw)
}

export function resolveLinkedEvidenceDisplay(row: ReconciliationLedgerRow): LinkedEvidenceDisplay[] {
  if (row.evidenceActionState !== 'linked' && row.evidenceActionState !== 'candidate') {
    return []
  }

  if (row.candidates.length > 0) {
    return row.candidates.map((candidate) => ({
      rowId: candidate.rowId,
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
      rowId: null,
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
  if (reason === 'partial_amount') return '거래처·일자는 비슷하지만 금액이 다름'
  if (reason === 'many_to_one') return '여러 건 합산 가능성 · 금액 확인 필요'
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

// v1은 정식 exclusionReason 컬럼 없이 staffMemo에 제외 사유를 저장한다
// (2b-1 결정). "제외 사유: ..." 접두사로 형식을 통일해 나중에 구조화된
// 필드로 마이그레이션할 때 문자열에서 사유만 안전하게 분리할 수 있게 한다.
const EXCLUSION_REASON_PREFIX = '제외 사유: '
const EVIDENCE_EXCEPTION_PREFIX = '증빙 예외: '

export function formatExclusionReasonMemo(reason: string): string {
  return `${EXCLUSION_REASON_PREFIX}${reason.trim()}`
}

export function formatEvidenceExceptionMemo(reason: string): string {
  return `${EVIDENCE_EXCEPTION_PREFIX}${reason.trim()}`
}

export function isEvidenceExceptionMemo(memo: string | null | undefined): boolean {
  return memo?.trim().startsWith(EVIDENCE_EXCEPTION_PREFIX) ?? false
}

export function formatKrwAmount(value: number | null): string {
  return value === null ? '-' : `${value.toLocaleString('ko-KR')}원`
}

export function hasAiEvidenceSuggestion(row: ReconciliationLedgerRow): boolean {
  return row.candidates.length > 0 && row.evidenceActionState === 'candidate'
}

export function shouldShowEvidenceFinder(row: ReconciliationLedgerRow): boolean {
  if (row.rowConclusion.primaryAction === 'write_explanation') {
    return false
  }

  return row.evidenceActionState !== 'explanation_required'
    && row.evidenceActionState !== 'explained_no_evidence'
    && row.evidenceActionState !== 'evidence_exception'
    && row.evidenceActionState !== 'excluded'
}

export function evidenceFinderActionLabel(row: ReconciliationLedgerRow): '증빙 확인' | '증빙 찾기' {
  if (row.evidenceActionState === 'candidate' || row.evidenceActionState === 'linked') {
    return '증빙 확인'
  }

  return '증빙 찾기'
}

export function evidenceRowHighlightTone(row: ReconciliationLedgerRow): 'danger' | 'default' {
  if (row.evidenceActionState === 'evidence_required' || row.evidenceActionState === 'explanation_required') {
    return 'danger'
  }

  return 'default'
}

export function evidenceActionChipLabel(
  state: ReconciliationLedgerRow['evidenceActionState'],
): { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' } | null {
  if (state === 'candidate') {
    return { label: '증빙있음', tone: 'ok' }
  }

  if (state === 'linked') {
    return { label: '증빙있음', tone: 'ok' }
  }
  if (state === 'evidence_required') {
    return { label: '증빙 필요', tone: 'danger' }
  }
  if (state === 'explanation_required') {
    return { label: '소명 필요', tone: 'danger' }
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
