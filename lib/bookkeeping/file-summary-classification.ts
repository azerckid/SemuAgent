import {
  isBookkeepingPeriodInRange,
  periodFromAttributionValue,
  type BookkeepingPeriodRange,
} from './period-range'
import { transactionCandidateSchema, type TransactionCandidate } from './schemas'

export type MaterialAttributionClassificationRow = {
  uploadFileId: string | null
  sourceKind: 'file_summary' | 'transaction_row'
  sourceLabel: string
  evidenceDate: string | null
  attributedPeriod: string | null
  amountKrw: number | null
  counterparty: string | null
  description: string | null
  recommendation: 'include' | 'hold' | 'exclude_duplicate' | 'reference_only'
  staffDecision: 'include' | 'hold' | 'exclude_duplicate' | 'reference_only' | null
}

function fileSummaryEffectiveDecision(row: MaterialAttributionClassificationRow) {
  return row.staffDecision ?? row.recommendation
}

function fileSummaryTransactionDate(row: MaterialAttributionClassificationRow) {
  if (row.evidenceDate && /^20\d{2}-\d{2}-\d{2}$/.test(row.evidenceDate)) return row.evidenceDate
  return periodFromAttributionValue(row) ? `${periodFromAttributionValue(row)}-01` : undefined
}

function isImageOrDocumentEvidence(sourceLabel: string) {
  return /\.(jpe?g|jpeg|png|webp|heic|pdf)$/i.test(sourceLabel.trim())
}

function inferSourceTypeFromFileSummary(row: MaterialAttributionClassificationRow): TransactionCandidate['sourceType'] {
  const text = `${row.sourceLabel} ${row.description ?? ''}`.toLowerCase()
  if (/세금계산서|tax\s*invoice/.test(text)) return 'tax_invoice'
  if (/영수증|납부확인|고객보관|receipt|고지서|청구서/.test(text)) return 'receipt'
  if (isImageOrDocumentEvidence(row.sourceLabel) && /통신요금|통신비|관리비|납부|수납|청구|결제|승인/.test(text)) {
    return 'receipt'
  }
  if (/카드|card/.test(text)) return 'card'
  if (/통장|은행|bank/.test(text)) return 'bank'
  return 'other'
}

function inferDirectionFromFileSummary(row: MaterialAttributionClassificationRow): TransactionCandidate['direction'] {
  const text = `${row.sourceLabel} ${row.counterparty ?? ''} ${row.description ?? ''}`.toLowerCase()
  if (/출금|납부|매입|지급|청구|영수|수수료|관리비|통신비|통신요금|구매|카드승인|신용카드|expense/.test(text)) {
    return 'expense'
  }
  if (/매출\s*세금계산서|온라인\s*매출|pg\s*정산|매출\s*정산|sales/.test(text)) return 'income'
  return 'unknown'
}

function parseKrwAmountFromText(value: string) {
  const labeledPatterns = [
    /(영수금액|수납금액|납부금액|청구금액|합계금액|합계|총액|승인금액|결제\s*금액|결제금액|공급대가|금액)\s*[:：은는-]*\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(?:원)?/i,
    /(공급가액|공급액)\s*[:：은는-]*\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(?:원)?/i,
  ]
  for (const pattern of labeledPatterns) {
    const match = value.match(pattern)
    if (match?.[2]) {
      const amount = Number(match[2].replace(/,/g, ''))
      if (Number.isFinite(amount) && amount > 0) return amount
    }
  }

  const amounts = [...value.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/g)]
    .map((match) => Number(match[1].replace(/,/g, '')))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
  return amounts.length > 0 ? Math.max(...amounts) : undefined
}

function resolveFileSummaryAmount(row: MaterialAttributionClassificationRow) {
  if (row.amountKrw && row.amountKrw > 0) return row.amountKrw
  return parseKrwAmountFromText([
    row.sourceLabel,
    row.counterparty ?? '',
    row.description ?? '',
  ].join(' '))
}

export function buildFileSummaryClassificationCandidates(params: {
  attributionRows: MaterialAttributionClassificationRow[]
  targetRange: BookkeepingPeriodRange
}): TransactionCandidate[] {
  return params.attributionRows.flatMap((row) => {
    if (row.sourceKind !== 'file_summary') return []
    if (!row.uploadFileId) return []
    if (fileSummaryEffectiveDecision(row) !== 'include') return []
    if (!isBookkeepingPeriodInRange(periodFromAttributionValue(row), params.targetRange)) return []

    const candidate = {
      sourceFileId: row.uploadFileId,
      sourceFilename: row.sourceLabel,
      sourceType: inferSourceTypeFromFileSummary(row),
      transactionDate: fileSummaryTransactionDate(row),
      merchantName: row.counterparty ?? undefined,
      description: row.description ?? row.sourceLabel,
      amountKrw: resolveFileSummaryAmount(row),
      direction: inferDirectionFromFileSummary(row),
      sourceRowRef: `file-summary:${row.uploadFileId}`,
      rawRow: [
        row.sourceLabel,
        row.evidenceDate ?? '',
        row.attributedPeriod ?? '',
        row.counterparty ?? '',
        row.description ?? '',
        row.amountKrw == null ? '' : String(row.amountKrw),
      ].filter(Boolean),
    }

    const parsed = transactionCandidateSchema.safeParse(candidate)
    return parsed.success ? [parsed.data] : []
  })
}
