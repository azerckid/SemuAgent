import type { bookkeepingTransactionClassification } from '@/lib/db/schema'
import { buildParsedVatFactFields } from '@/lib/vat/facts'
import {
  BANK_SAMPLE_DEFINITIONS,
  CARD_SAMPLE_DEFINITIONS,
  ORPHAN_TAX_INVOICE_DEFINITIONS,
  RECONCILIATION_BANK_MATCHED_COUNT,
  RECONCILIATION_BANK_SAMPLE_COUNT,
  RECONCILIATION_CARD_MATCHED_COUNT,
  RECONCILIATION_CARD_SAMPLE_COUNT,
  RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT,
  RECONCILIATION_TAX_INVOICE_SAMPLE_COUNT,
} from '@/lib/bookkeeping-review/reconciliation-bank-sample-data'
import { firstRunSampleId } from './seed'

export {
  BANK_SAMPLE_DEFINITIONS,
  CARD_SAMPLE_DEFINITIONS,
  ORPHAN_TAX_INVOICE_DEFINITIONS,
  RECONCILIATION_BANK_MATCHED_COUNT,
  RECONCILIATION_BANK_SAMPLE_COUNT,
  RECONCILIATION_CARD_MATCHED_COUNT,
  RECONCILIATION_CARD_SAMPLE_COUNT,
  RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT,
  RECONCILIATION_TAX_INVOICE_SAMPLE_COUNT,
}

type SeedParams = {
  tenantId: string
  staffId: string
  timestamp: string
}

type BookkeepingInsert = typeof bookkeepingTransactionClassification.$inferInsert

export const VAT_TAX_TREATMENT_SAMPLE_COUNT = 5

const AI_MATCHED_EVIDENCE_JSON = JSON.stringify({
  fieldsUsed: ['amount', 'date', 'counterparty', 'merchant_pattern'],
  needsStaffDecision: false,
})

const AI_UNMATCHED_EVIDENCE_JSON = JSON.stringify({
  fieldsUsed: ['amount', 'date', 'counterparty'],
  needsStaffDecision: true,
})

function buildClassificationRow(
  params: SeedParams,
  sessionId: string,
  sourceBatchId: string,
  runId: string,
  input: {
    idSuffix: string
    sourceType: NonNullable<BookkeepingInsert['sourceType']>
    transactionDate: string
    merchantName: string
    description: string
    amountKrw: number
    direction: NonNullable<BookkeepingInsert['direction']>
    recommendedAccount: string
    status: BookkeepingInsert['status']
    recommendationConfidence: BookkeepingInsert['recommendationConfidence']
    evidenceJson: string | null
  },
): BookkeepingInsert {
  const vatFactFields = buildParsedVatFactFields({
    sourceType: input.sourceType,
    direction: input.direction,
    sourceReference: `sample:${input.idSuffix}`,
  })
  return {
    id: firstRunSampleId(params.tenantId, input.idSuffix),
    tenantId: params.tenantId,
    classificationRunId: runId,
    uploadSessionId: sessionId,
    sourceBatchId,
    uploadFileId: null,
    sourceType: input.sourceType,
    transactionDate: input.transactionDate,
    merchantName: input.merchantName,
    description: input.description,
    amountKrw: input.amountKrw,
    direction: input.direction,
    recommendedAccount: input.recommendedAccount,
    recommendationConfidence: input.recommendationConfidence,
    recommendationReason: 'Clobe 참고 통장·카드·세금계산서 샘플에서 AI가 금액·일자·거래처를 대조해 추천했습니다.',
    evidenceJson: input.evidenceJson,
    finalAccount: null,
    staffMemo: null,
    status: input.status,
    ...vatFactFields,
    confirmedByStaffId: null,
    confirmedAt: null,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  }
}

function resolveRowStatus(matched: boolean, personalUse = false): BookkeepingInsert['status'] {
  if (!matched || personalUse) return 'needs_decision'
  return 'suggested'
}

function buildVatTaxTreatmentSampleRows(
  params: SeedParams,
  sessionId: string,
  sourceBatchId: string,
  runId: string,
): BookkeepingInsert[] {
  const definitions = [
    {
      suffix: 'zero_rated',
      sourceType: 'tax_invoice' as const,
      transactionDate: '2026-06-20',
      merchantName: 'GLOBAL TECH INC',
      description: '국외 SaaS 개발 용역',
      amountKrw: 40_000_000,
      direction: 'income' as const,
      finalAccount: 'sales',
      vatDirection: 'sale' as const,
      vatTaxType: 'zero_rated' as const,
      supplyAmountKrw: 40_000_000,
      taxAmountKrw: 0,
    },
    {
      suffix: 'entertainment',
      sourceType: 'card' as const,
      transactionDate: '2026-06-18',
      merchantName: '○○한정식',
      description: '거래처 접대 식대',
      amountKrw: 1_320_000,
      direction: 'expense' as const,
      finalAccount: 'entertainment',
      vatDirection: 'purchase' as const,
      vatTaxType: 'taxable' as const,
      supplyAmountKrw: 1_200_000,
      taxAmountKrw: 120_000,
    },
    {
      suffix: 'proration',
      sourceType: 'tax_invoice' as const,
      transactionDate: '2026-06-17',
      merchantName: '○○물산',
      description: '면세사업분 공통매입',
      amountKrw: 2_200_000,
      direction: 'expense' as const,
      finalAccount: 'fees',
      vatDirection: 'purchase' as const,
      vatTaxType: 'taxable' as const,
      supplyAmountKrw: 2_000_000,
      taxAmountKrw: 200_000,
    },
    {
      suffix: 'deductible',
      sourceType: 'tax_invoice' as const,
      transactionDate: '2026-06-16',
      merchantName: 'AWS',
      description: '클라우드 서버 이용료',
      amountKrw: 3_436_400,
      direction: 'expense' as const,
      finalAccount: 'domain_hosting',
      vatDirection: 'purchase' as const,
      vatTaxType: 'taxable' as const,
      supplyAmountKrw: 3_124_000,
      taxAmountKrw: 312_400,
    },
    {
      suffix: 'exempt',
      sourceType: 'tax_invoice' as const,
      transactionDate: '2026-06-15',
      merchantName: '○○러닝',
      description: '온라인 교육 콘텐츠 제공',
      amountKrw: 15_000_000,
      direction: 'income' as const,
      finalAccount: 'sales',
      vatDirection: 'sale' as const,
      vatTaxType: 'exempt' as const,
      supplyAmountKrw: 15_000_000,
      taxAmountKrw: 0,
    },
  ]

  return definitions.map((definition) => ({
    ...buildClassificationRow(params, sessionId, sourceBatchId, runId, {
      idSuffix: `bk_vat_treatment_${definition.suffix}`,
      sourceType: definition.sourceType,
      transactionDate: definition.transactionDate,
      merchantName: definition.merchantName,
      description: definition.description,
      amountKrw: definition.amountKrw,
      direction: definition.direction,
      recommendedAccount: definition.finalAccount,
      status: 'confirmed',
      recommendationConfidence: 'high',
      evidenceJson: AI_MATCHED_EVIDENCE_JSON,
    }),
    finalAccount: definition.finalAccount,
    status: 'confirmed' as const,
    staffMemo: definition.suffix === 'entertainment' ? '거래처 접대 목적' : null,
    vatDirection: definition.vatDirection,
    vatTaxType: definition.vatTaxType,
    vatSupplyAmountKrw: definition.supplyAmountKrw,
    vatTaxAmountKrw: definition.taxAmountKrw,
    vatGrossAmountKrw: definition.supplyAmountKrw + definition.taxAmountKrw,
    vatFactSource: 'parser' as const,
    vatFactSourceRef: `sample:vat-treatment:${definition.suffix}`,
    vatFactStatus: 'derived' as const,
  }))
}

export function buildReconciliationBankSampleRows(
  params: SeedParams,
  sessionId: string,
  sourceBatchId: string,
  runId: string,
): BookkeepingInsert[] {
  const rows: BookkeepingInsert[] = []

  for (const sample of BANK_SAMPLE_DEFINITIONS) {
    rows.push(buildClassificationRow(params, sessionId, sourceBatchId, runId, {
      idSuffix: `bk_bank_${sample.suffix}`,
      sourceType: 'bank',
      transactionDate: sample.transactionDate,
      merchantName: sample.counterparty,
      description: `[${sample.accountLabel}] ${sample.description}`,
      amountKrw: sample.amountKrw,
      direction: sample.direction,
      recommendedAccount: sample.recommendedAccount,
      status: resolveRowStatus(sample.matched),
      recommendationConfidence: sample.matched ? 'high' : 'medium',
      evidenceJson: sample.matched ? AI_MATCHED_EVIDENCE_JSON : AI_UNMATCHED_EVIDENCE_JSON,
    }))

    if (sample.matched) {
      rows.push(buildClassificationRow(params, sessionId, sourceBatchId, runId, {
        idSuffix: `bk_tax_${sample.suffix}`,
        sourceType: 'tax_invoice',
        transactionDate: sample.transactionDate,
        merchantName: sample.taxCounterparty ?? sample.counterparty,
        description: sample.taxItem ?? sample.description,
        amountKrw: sample.amountKrw,
        direction: sample.direction,
        recommendedAccount: sample.recommendedAccount,
        status: 'suggested',
        recommendationConfidence: 'high',
        evidenceJson: AI_MATCHED_EVIDENCE_JSON,
      }))
    }
  }

  for (const sample of CARD_SAMPLE_DEFINITIONS) {
    rows.push(buildClassificationRow(params, sessionId, sourceBatchId, runId, {
      idSuffix: `bk_card_${sample.suffix}`,
      sourceType: 'card',
      transactionDate: sample.transactionDate,
      merchantName: sample.counterparty,
      description: `[${sample.cardLabel}] ${sample.description}`,
      amountKrw: sample.amountKrw,
      direction: sample.direction,
      recommendedAccount: sample.recommendedAccount,
      status: resolveRowStatus(sample.matched, sample.personalUse),
      recommendationConfidence: sample.matched ? 'high' : sample.personalUse ? 'low' : 'medium',
      evidenceJson: sample.matched ? AI_MATCHED_EVIDENCE_JSON : AI_UNMATCHED_EVIDENCE_JSON,
    }))

    if (sample.matched) {
      rows.push(buildClassificationRow(params, sessionId, sourceBatchId, runId, {
        idSuffix: `bk_tax_card_${sample.suffix}`,
        sourceType: 'tax_invoice',
        transactionDate: sample.transactionDate,
        merchantName: sample.taxCounterparty ?? sample.counterparty,
        description: sample.taxItem ?? sample.description,
        amountKrw: sample.amountKrw,
        direction: sample.direction,
        recommendedAccount: sample.recommendedAccount,
        status: 'suggested',
        recommendationConfidence: 'high',
        evidenceJson: AI_MATCHED_EVIDENCE_JSON,
      }))
    }
  }

  for (const orphan of ORPHAN_TAX_INVOICE_DEFINITIONS) {
    rows.push(buildClassificationRow(params, sessionId, sourceBatchId, runId, {
      idSuffix: `bk_tax_${orphan.suffix}`,
      sourceType: 'tax_invoice',
      transactionDate: orphan.transactionDate,
      merchantName: orphan.counterparty,
      description: orphan.description,
      amountKrw: orphan.amountKrw,
      direction: orphan.direction,
      recommendedAccount: orphan.recommendedAccount,
      status: 'suggested',
      recommendationConfidence: 'high',
      evidenceJson: AI_UNMATCHED_EVIDENCE_JSON,
    }))
  }

  rows.push(...buildVatTaxTreatmentSampleRows(params, sessionId, sourceBatchId, runId))

  return rows
}

export function summarizeReconciliationBankSample(rows: BookkeepingInsert[]) {
  const bankRows = rows.filter((row) => row.sourceType === 'bank')
  const cardRows = rows.filter((row) => row.sourceType === 'card')
  const taxRows = rows.filter((row) => row.sourceType === 'tax_invoice')
  const matchedBankCount = BANK_SAMPLE_DEFINITIONS.filter((sample) => sample.matched).length
  const unmatchedBankCount = BANK_SAMPLE_DEFINITIONS.filter((sample) => !sample.matched).length
  const matchedCardCount = CARD_SAMPLE_DEFINITIONS.filter((sample) => sample.matched).length
  const primaryCount = bankRows.length + cardRows.length
  const matchedPrimaryCount = matchedBankCount + matchedCardCount

  return {
    bankCount: bankRows.length,
    cardCount: cardRows.length,
    taxInvoiceCount: taxRows.length,
    matchedBankCount,
    unmatchedBankCount,
    matchedCardCount,
    primaryCount,
    matchRate: matchedPrimaryCount / primaryCount,
    aiHighConfidenceCount: rows.filter((row) => row.recommendationConfidence === 'high').length,
  }
}
