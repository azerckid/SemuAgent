import {
  BANK_SAMPLE_DEFINITIONS,
  CARD_SAMPLE_DEFINITIONS,
  ORPHAN_TAX_INVOICE_DEFINITIONS,
} from '@/lib/bookkeeping-review/reconciliation-bank-sample-data'
import type { ReconciliationLedgerRow } from './reconciliation-display-model'

const PERIOD_LABEL = '2026년 1기 (부가세)'
const PERIOD_MODE = 'quarter' as const

const JULY_FIXTURE_SUFFIX = '202607'
const FIXTURE_UPLOAD_SESSION_ID = 'fixture-session'

const disabledActions = {
  canConfirmAccount: false,
  canExplain: false,
  canExclude: false,
  canConfirmMatch: false,
} satisfies ReconciliationLedgerRow['actions']

type RowConclusionInput = Omit<ReconciliationLedgerRow['rowConclusion'], 'actionEnabled' | 'disabledReason'>

function rowConclusion(partial: RowConclusionInput): ReconciliationLedgerRow['rowConclusion'] {
  return {
    ...partial,
    actionEnabled: false,
    disabledReason: 'Slice 2a-0 fixture — 저장은 Slice 2b에서 활성화됩니다.',
  }
}

function estimateTaxAmountKrw(amountKrw: number) {
  return Math.round(amountKrw / 11)
}

type BankFixtureOverride = Partial<Pick<
  ReconciliationLedgerRow,
  'matchState' | 'evidenceActionState' | 'candidates' | 'blockers' | 'patternSuggestion' | 'rowConclusion'
>>

type CardFixtureOverride = BankFixtureOverride

const BANK_FIXTURE_OVERRIDES: Record<string, BankFixtureOverride> = {
  [`${JULY_FIXTURE_SUFFIX}_b25`]: {
    matchState: 'matched',
    evidenceActionState: 'linked',
    rowConclusion: rowConclusion({
      headline: '지급임차료 · 증빙 연결 완료',
      basisLabel: '세금계산서 매칭 확정',
      primaryAction: 'review_only',
    }),
    blockers: [],
  },
  [`${JULY_FIXTURE_SUFFIX}_b28`]: {
    matchState: 'ambiguous',
    evidenceActionState: 'candidate',
    candidates: [
      {
        id: 'candidate-card-settlement',
        source: 'card',
        rowId: 'preview-card-settlement-group',
        date: '2026-06-20',
        counterparty: '무신사페이먼츠',
        amountKrw: 3_767_360,
        taxAmountKrw: null,
        confidence: 'medium',
        reason: 'partial_amount',
      },
    ],
    patternSuggestion: null,
    rowConclusion: rowConclusion({
      headline: '카드 정산 합계와 62,140원 차이',
      basisLabel: '금액 불일치 · AI 대조 추천 1건',
      primaryAction: 'review_only',
    }),
    blockers: [{ code: 'ambiguous_match', label: '금액 대조 필요' }],
  },
  [`${JULY_FIXTURE_SUFFIX}_b29`]: {
    matchState: 'missing_evidence',
    evidenceActionState: 'explanation_required',
    candidates: [],
    rowConclusion: rowConclusion({
      headline: '지급수수료 · 사용내역 소명 필요',
      basisLabel: '세금계산서 없이 이체된 자문료',
      primaryAction: 'write_explanation',
    }),
    blockers: [
      { code: 'explanation_required', label: '사용내역 소명 필요' },
      { code: 'account_unconfirmed', label: '계정항목 미확정' },
    ],
  },
  [`${JULY_FIXTURE_SUFFIX}_b27`]: {
    matchState: 'missing_evidence',
    evidenceActionState: 'evidence_required',
    candidates: [],
    patternSuggestion: null,
    rowConclusion: rowConclusion({
      headline: '소모품비 · 증빙 연결 필요',
      basisLabel: '통장 출금만 존재 · 세금계산서/현금영수증 미연결',
      primaryAction: 'connect_evidence',
    }),
    blockers: [{ code: 'missing_evidence', label: '연결 증빙 필요' }],
  },
  [`${JULY_FIXTURE_SUFFIX}_b34`]: {
    matchState: 'matched',
    evidenceActionState: 'linked',
    candidates: [],
    patternSuggestion: null,
    rowConclusion: rowConclusion({
      headline: '이자수익 · 통장 내역으로 확정',
      basisLabel: '이자 입금 · 별도 세금계산서 없음',
      primaryAction: 'review_only',
    }),
    blockers: [],
  },
  [`${JULY_FIXTURE_SUFFIX}_b35`]: {
    matchState: 'missing_evidence',
    evidenceActionState: 'evidence_required',
    candidates: [],
    rowConclusion: rowConclusion({
      headline: '개인송금 · 증빙·소명 확인 필요',
      basisLabel: '거래처 불명확 · 업무 관련성 확인 필요',
      primaryAction: 'connect_evidence',
    }),
    blockers: [{ code: 'missing_evidence', label: '연결 증빙 필요' }],
  },
}

const CARD_FIXTURE_OVERRIDES: Record<string, CardFixtureOverride> = {
  [`${JULY_FIXTURE_SUFFIX}_c15`]: {
    matchState: 'missing_evidence',
    evidenceActionState: 'explanation_required',
    candidates: [],
    rowConclusion: rowConclusion({
      headline: '업무무관 의심 · 소명 필요',
      basisLabel: '영화관 결제 · 사적 사용 의심',
      primaryAction: 'write_explanation',
    }),
    blockers: [{ code: 'explanation_required', label: '사용내역 소명 필요' }],
  },
}

function buildMatchedTaxCandidate(
  sample: (typeof BANK_SAMPLE_DEFINITIONS)[number] | (typeof CARD_SAMPLE_DEFINITIONS)[number],
  taxRowIdPrefix: 'preview-tax' | 'preview-tax-card',
): NonNullable<ReconciliationLedgerRow['candidates']>[number] {
  return {
    id: `candidate-tax-${sample.suffix}`,
    source: 'tax_invoice',
    rowId: `${taxRowIdPrefix}-${sample.suffix}`,
    date: sample.transactionDate,
    counterparty: sample.taxCounterparty ?? sample.counterparty,
    amountKrw: sample.amountKrw,
    taxAmountKrw: estimateTaxAmountKrw(sample.amountKrw),
    confidence: 'high',
    reason: 'same_amount_same_day',
  }
}

function buildBankFixtureRow(sample: (typeof BANK_SAMPLE_DEFINITIONS)[number]): ReconciliationLedgerRow {
  const override = BANK_FIXTURE_OVERRIDES[sample.suffix]
  const skipPairedTax = sample.suffix === `${JULY_FIXTURE_SUFFIX}_b27`
  const matched = sample.matched && !skipPairedTax
  const taxCandidate = matched ? buildMatchedTaxCandidate(sample, 'preview-tax') : null
  const linkedCandidates = override && 'candidates' in override
    ? (override.candidates ?? [])
    : override?.evidenceActionState === 'linked' && taxCandidate
      ? [taxCandidate]
      : override?.candidates ?? (taxCandidate ? [taxCandidate] : [])

  return {
    id: `preview-bank-${sample.suffix}`,
    uploadSessionId: FIXTURE_UPLOAD_SESSION_ID,
    periodMode: PERIOD_MODE,
    periodLabel: PERIOD_LABEL,
    source: 'bank',
    transactionDate: sample.transactionDate,
    counterparty: sample.counterparty,
    description: sample.description,
    direction: sample.direction,
    amountKrw: sample.amountKrw,
    taxAmountKrw: sample.direction === 'income' ? 0 : estimateTaxAmountKrw(sample.amountKrw),
    recommendedAccount: sample.recommendedAccount,
    finalAccount: override?.evidenceActionState === 'linked' ? sample.recommendedAccount : null,
    explanationMemo: null,
    exclusionReason: null,
    matchState: override?.matchState ?? (matched ? 'candidate' : 'missing_evidence'),
    evidenceActionState: override?.evidenceActionState ?? (matched ? 'candidate' : 'evidence_required'),
    candidates: linkedCandidates,
    patternSuggestion: override?.patternSuggestion ?? (matched ? {
      suggestedAccount: sample.recommendedAccount,
      suggestedEvidenceSource: 'tax_invoice',
      suggestedExclusionReason: null,
      confidence: 'high',
      basisLabel: '같은 금액·일자 세금계산서를 찾았습니다',
      matchedCount: 1,
      lastSeenPeriod: '2026-05',
      reason: 'same_counterparty_prior_evidence',
    } : null),
    rowConclusion: override?.rowConclusion ?? rowConclusion({
      headline: matched
        ? `${sample.recommendedAccount} · 증빙있음`
        : `${sample.recommendedAccount} · 증빙 연결 필요`,
      basisLabel: matched
        ? '같은 금액·같은 일자 세금계산서 1건'
        : '통장 내역만 존재 · 증빙 미연결',
      primaryAction: matched ? 'connect_evidence' : 'connect_evidence',
    }),
    blockers: override?.blockers ?? (matched
      ? [{ code: 'account_unconfirmed', label: '계정항목 미확정' }]
      : [{ code: 'missing_evidence', label: '연결 증빙 필요' }]),
    actions: disabledActions,
  }
}

function buildCardFixtureRow(sample: (typeof CARD_SAMPLE_DEFINITIONS)[number]): ReconciliationLedgerRow {
  const override = CARD_FIXTURE_OVERRIDES[sample.suffix]
  const matched = sample.matched
  const taxCandidate = matched ? buildMatchedTaxCandidate(sample, 'preview-tax-card') : null

  return {
    id: `preview-card-${sample.suffix}`,
    uploadSessionId: FIXTURE_UPLOAD_SESSION_ID,
    periodMode: PERIOD_MODE,
    periodLabel: PERIOD_LABEL,
    source: 'card',
    transactionDate: sample.transactionDate,
    counterparty: sample.counterparty,
    description: sample.description,
    direction: sample.direction,
    amountKrw: sample.amountKrw,
    taxAmountKrw: estimateTaxAmountKrw(sample.amountKrw),
    recommendedAccount: sample.recommendedAccount,
    finalAccount: null,
    explanationMemo: null,
    exclusionReason: null,
    matchState: override?.matchState ?? (matched ? 'candidate' : 'missing_evidence'),
    evidenceActionState: override?.evidenceActionState ?? (
      sample.personalUse ? 'explanation_required' : matched ? 'candidate' : 'evidence_required'
    ),
    candidates: override?.candidates ?? (taxCandidate ? [taxCandidate] : []),
    patternSuggestion: override?.patternSuggestion ?? (sample.personalUse ? {
      suggestedAccount: null,
      suggestedEvidenceSource: null,
      suggestedExclusionReason: 'personal_private',
      confidence: 'medium',
      basisLabel: '업무무관 결제 의심',
      matchedCount: 2,
      lastSeenPeriod: '2026-04',
      reason: 'prior_exclusion_pattern',
    } : matched ? {
      suggestedAccount: sample.recommendedAccount,
      suggestedEvidenceSource: 'tax_invoice',
      suggestedExclusionReason: null,
      confidence: 'high',
      basisLabel: '같은 금액·일자 세금계산서를 찾았습니다',
      matchedCount: 1,
      lastSeenPeriod: '2026-05',
      reason: 'same_counterparty_prior_evidence',
    } : null),
    rowConclusion: override?.rowConclusion ?? rowConclusion({
      headline: sample.personalUse
        ? `${sample.recommendedAccount} · 업무무관 의심`
        : matched
          ? `${sample.recommendedAccount} · 증빙있음`
          : `${sample.recommendedAccount} · 증빙 연결 필요`,
      basisLabel: sample.personalUse
        ? '영화관·PC방·미용실 등 업무무관 패턴'
        : matched
          ? '같은 금액·같은 일자 세금계산서 1건'
          : '카드 내역만 존재 · 증빙 미연결',
      primaryAction: sample.personalUse ? 'write_explanation' : 'connect_evidence',
    }),
    blockers: override?.blockers ?? (
      sample.personalUse
        ? [{ code: 'explanation_required', label: '사용내역 소명 필요' }]
        : matched
          ? [{ code: 'account_unconfirmed', label: '계정항목 미확정' }]
          : [{ code: 'missing_evidence', label: '연결 증빙 필요' }]
    ),
    actions: disabledActions,
  }
}

function buildPairedTaxFixtureRow(
  sample: (typeof BANK_SAMPLE_DEFINITIONS)[number],
  bankRowId: string,
): ReconciliationLedgerRow | null {
  if (!sample.matched || sample.suffix === `${JULY_FIXTURE_SUFFIX}_b27`) {
    return null
  }

  return {
    id: `preview-tax-${sample.suffix}`,
    uploadSessionId: FIXTURE_UPLOAD_SESSION_ID,
    periodMode: PERIOD_MODE,
    periodLabel: PERIOD_LABEL,
    source: 'tax_invoice',
    transactionDate: sample.transactionDate,
    counterparty: sample.taxCounterparty ?? sample.counterparty,
    description: sample.taxItem ?? sample.description,
    direction: sample.direction,
    amountKrw: sample.amountKrw,
    taxAmountKrw: estimateTaxAmountKrw(sample.amountKrw),
    recommendedAccount: sample.recommendedAccount,
    finalAccount: null,
    explanationMemo: null,
    exclusionReason: null,
    matchState: 'candidate',
    evidenceActionState: 'candidate',
    candidates: [
      {
        id: `candidate-bank-${sample.suffix}`,
        source: 'bank',
        rowId: bankRowId,
        date: sample.transactionDate,
        counterparty: sample.counterparty,
        amountKrw: sample.amountKrw,
        taxAmountKrw: sample.direction === 'income' ? 0 : estimateTaxAmountKrw(sample.amountKrw),
        confidence: 'high',
        reason: 'same_amount_same_day',
      },
    ],
    patternSuggestion: null,
    rowConclusion: rowConclusion({
      headline: sample.direction === 'income' ? '매출 세금계산서 · 통장 입금 대조' : '매입 세금계산서 · 통장 출금 대조',
      basisLabel: 'AI가 같은 금액·일자 통장 내역을 찾았습니다',
      primaryAction: 'connect_evidence',
    }),
    blockers: [{ code: 'account_unconfirmed', label: '계정항목 미확정' }],
    actions: disabledActions,
  }
}

function buildPairedCardTaxFixtureRow(sample: (typeof CARD_SAMPLE_DEFINITIONS)[number]): ReconciliationLedgerRow | null {
  if (!sample.matched) return null

  return {
    id: `preview-tax-card-${sample.suffix}`,
    uploadSessionId: FIXTURE_UPLOAD_SESSION_ID,
    periodMode: PERIOD_MODE,
    periodLabel: PERIOD_LABEL,
    source: 'tax_invoice',
    transactionDate: sample.transactionDate,
    counterparty: sample.taxCounterparty ?? sample.counterparty,
    description: sample.taxItem ?? sample.description,
    direction: sample.direction,
    amountKrw: sample.amountKrw,
    taxAmountKrw: estimateTaxAmountKrw(sample.amountKrw),
    recommendedAccount: sample.recommendedAccount,
    finalAccount: null,
    explanationMemo: null,
    exclusionReason: null,
    matchState: 'candidate',
    evidenceActionState: 'candidate',
    candidates: [
      {
        id: `candidate-card-${sample.suffix}`,
        source: 'card',
        rowId: `preview-card-${sample.suffix}`,
        date: sample.transactionDate,
        counterparty: sample.counterparty,
        amountKrw: sample.amountKrw,
        taxAmountKrw: estimateTaxAmountKrw(sample.amountKrw),
        confidence: 'high',
        reason: 'same_amount_same_day',
      },
    ],
    patternSuggestion: null,
    rowConclusion: rowConclusion({
      headline: '매입 세금계산서 · 카드 승인 대조',
      basisLabel: 'AI가 같은 금액·일자 카드 내역을 찾았습니다',
      primaryAction: 'connect_evidence',
    }),
    blockers: [{ code: 'account_unconfirmed', label: '계정항목 미확정' }],
    actions: disabledActions,
  }
}

function buildOrphanTaxFixtureRow(orphan: (typeof ORPHAN_TAX_INVOICE_DEFINITIONS)[number]): ReconciliationLedgerRow {
  return {
    id: `preview-tax-${orphan.suffix}`,
    uploadSessionId: FIXTURE_UPLOAD_SESSION_ID,
    periodMode: PERIOD_MODE,
    periodLabel: PERIOD_LABEL,
    source: 'tax_invoice',
    transactionDate: orphan.transactionDate,
    counterparty: orphan.counterparty,
    description: orphan.description,
    direction: orphan.direction,
    amountKrw: orphan.amountKrw,
    taxAmountKrw: estimateTaxAmountKrw(orphan.amountKrw),
    recommendedAccount: orphan.recommendedAccount,
    finalAccount: null,
    explanationMemo: null,
    exclusionReason: null,
    matchState: 'missing_evidence',
    evidenceActionState: 'evidence_required',
    candidates: [],
    patternSuggestion: null,
    rowConclusion: rowConclusion({
      headline: orphan.direction === 'income' ? '매출 세금계산서 · 입금 미연결' : '매입 세금계산서 · 출금 미연결',
      basisLabel: '세금계산서만 존재 · 통장/카드 미연결',
      primaryAction: 'connect_evidence',
    }),
    blockers: [{ code: 'missing_evidence', label: '연결 증빙 필요' }],
    actions: disabledActions,
  }
}

export function buildReconciliationBankFixtureRows(): ReconciliationLedgerRow[] {
  const bankRows = BANK_SAMPLE_DEFINITIONS.map(buildBankFixtureRow)
  const cardRows = CARD_SAMPLE_DEFINITIONS.map(buildCardFixtureRow)
  const pairedBankTaxRows = BANK_SAMPLE_DEFINITIONS
    .map((sample) => buildPairedTaxFixtureRow(sample, `preview-bank-${sample.suffix}`))
    .filter((row): row is ReconciliationLedgerRow => row !== null)
  const pairedCardTaxRows = CARD_SAMPLE_DEFINITIONS
    .map(buildPairedCardTaxFixtureRow)
    .filter((row): row is ReconciliationLedgerRow => row !== null)
  const orphanTaxRows = ORPHAN_TAX_INVOICE_DEFINITIONS.map(buildOrphanTaxFixtureRow)

  return [...bankRows, ...cardRows, ...pairedBankTaxRows, ...pairedCardTaxRows, ...orphanTaxRows]
}

export const RECONCILIATION_BANK_FIXTURE_ROW_IDS = {
  bankToTaxInvoice: `preview-bank-${JULY_FIXTURE_SUFFIX}_b30`,
  bankLinked: `preview-bank-${JULY_FIXTURE_SUFFIX}_b25`,
  bankExplanation: `preview-bank-${JULY_FIXTURE_SUFFIX}_b29`,
  bankAmbiguous: `preview-bank-${JULY_FIXTURE_SUFFIX}_b28`,
  bankInterestLinked: `preview-bank-${JULY_FIXTURE_SUFFIX}_b34`,
  cardPersonal: `preview-card-${JULY_FIXTURE_SUFFIX}_c15`,
} as const
