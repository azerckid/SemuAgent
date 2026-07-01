import {
  isBookkeepingPeriodInRange,
  type BookkeepingPeriodRange,
} from './period-range'
import type { MaterialAttributionDecision, TransactionCandidate } from './schemas'

export type GeneratedAttributionRow = {
  uploadFileId: string | null
  sourceKind: 'file_summary' | 'transaction_row'
  sourceLabel: string
  evidenceDate: string | null
  attributedPeriod: string | null
  periodRelation: 'requested' | 'prior' | 'future' | 'unknown'
  amountKrw: number | null
  counterparty: string | null
  description: string | null
  duplicateStatus: 'none' | 'possible_duplicate'
  duplicateBasis: string | null
  recommendation: MaterialAttributionDecision
}

export type FileSummaryCandidate = {
  uploadFileId: string
  sourceFilename: string
  evidenceDate?: string | null
  attributedPeriod?: string | null
  amountKrw?: number | null
  counterparty?: string | null
  description?: string | null
}

function normalizeAccountingPeriod(value: string | null | undefined) {
  const match = value?.match(/(20\d{2})[-.\s년]*(\d{1,2})/)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return `${match[1]}-${match[2].padStart(2, '0')}`
}

function resolveEvidenceDate(value: string | undefined, requestedPeriod: string) {
  if (!value) return null
  if (/^20\d{2}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.match(/^20\d{2}-(\d{2})-(\d{2})$/) ?? []
    const parsedMonth = Number(month)
    const parsedDay = Number(day)
    return parsedMonth >= 1 && parsedMonth <= 12 && parsedDay >= 1 && parsedDay <= 31 ? value : null
  }
  if (/^\d{2}-\d{2}$/.test(value)) {
    const year = normalizeAccountingPeriod(requestedPeriod)?.slice(0, 4)
    const [, month, day] = value.match(/^(\d{2})-(\d{2})$/) ?? []
    const parsedMonth = Number(month)
    const parsedDay = Number(day)
    return year && parsedMonth >= 1 && parsedMonth <= 12 && parsedDay >= 1 && parsedDay <= 31 ? `${year}-${value}` : null
  }
  return null
}

function inferPeriodFromFilename(filename: string) {
  const match = filename.match(/(20\d{2})[-_.\s년]*(\d{1,2})/)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return `${match[1]}-${match[2].padStart(2, '0')}`
}

export function hasResolvedPeriod(row: Pick<GeneratedAttributionRow, 'attributedPeriod' | 'periodRelation'>) {
  return Boolean(row.attributedPeriod && normalizeAccountingPeriod(row.attributedPeriod) && row.periodRelation !== 'unknown')
}

function periodRelation(params: {
  attributedPeriod: string | null
  targetRange: BookkeepingPeriodRange
}): GeneratedAttributionRow['periodRelation'] {
  const attributedPeriod = normalizeAccountingPeriod(params.attributedPeriod)
  if (!attributedPeriod) return 'unknown'
  if (isBookkeepingPeriodInRange(attributedPeriod, params.targetRange)) return 'requested'
  return attributedPeriod < params.targetRange.start ? 'prior' : 'future'
}

function recommendationFor(params: {
  relation: GeneratedAttributionRow['periodRelation']
  duplicateStatus: GeneratedAttributionRow['duplicateStatus']
}) {
  if (params.duplicateStatus === 'possible_duplicate') return 'exclude_duplicate' as const
  if (params.relation === 'requested') return 'include' as const
  if (params.relation === 'prior' || params.relation === 'future') return 'reference_only' as const
  return 'hold' as const
}

export function enforceTargetRangeBoundary(params: {
  row: GeneratedAttributionRow
  targetRange: BookkeepingPeriodRange
}): GeneratedAttributionRow {
  const relation = periodRelation({
    attributedPeriod: params.row.attributedPeriod,
    targetRange: params.targetRange,
  })

  return {
    ...params.row,
    periodRelation: relation,
    recommendation: recommendationFor({
      relation,
      duplicateStatus: params.row.duplicateStatus,
    }),
  }
}

export function buildGeneratedRows(params: {
  requestedPeriod: string
  targetRange: BookkeepingPeriodRange
  candidates: TransactionCandidate[]
}): GeneratedAttributionRow[] {
  const seen = new Map<string, number>()

  return params.candidates.slice(0, 500).flatMap((candidate) => {
    const evidenceDate = resolveEvidenceDate(candidate.transactionDate, params.requestedPeriod)
    const attributedPeriod = evidenceDate?.slice(0, 7) ?? inferPeriodFromFilename(candidate.sourceFilename)
    const relation = periodRelation({ attributedPeriod, targetRange: params.targetRange })
    if (!hasResolvedPeriod({ attributedPeriod, periodRelation: relation })) return []

    const counterparty = candidate.merchantName ?? null
    const rawRowKey = candidate.rawRow.join(' · ')
    const duplicateKey = [
      evidenceDate,
      candidate.amountKrw ?? 'none',
      counterparty ?? 'none',
      rawRowKey,
    ].join('|')
    const canMarkDuplicate = Boolean(evidenceDate && candidate.amountKrw !== undefined && counterparty && rawRowKey)
    const duplicateCount = canMarkDuplicate ? (seen.get(duplicateKey) ?? 0) : 0
    if (canMarkDuplicate) seen.set(duplicateKey, duplicateCount + 1)
    const duplicateStatus = duplicateCount > 0 ? 'possible_duplicate' : 'none'

    return [{
      uploadFileId: candidate.sourceFileId,
      sourceKind: 'transaction_row' as const,
      sourceLabel: candidate.sourceFilename,
      evidenceDate,
      attributedPeriod,
      periodRelation: relation,
      amountKrw: candidate.amountKrw ?? null,
      counterparty,
      description: candidate.description ?? null,
      duplicateStatus,
      duplicateBasis: duplicateStatus === 'possible_duplicate' ? '동일 거래일자, 금액, 거래처, 원문 행이 반복되었습니다.' : null,
      recommendation: recommendationFor({ relation, duplicateStatus }),
    }]
  })
}

export function buildFileSummaryRows(params: {
  targetRange: BookkeepingPeriodRange
  candidates: FileSummaryCandidate[]
}): GeneratedAttributionRow[] {
  return params.candidates.flatMap((candidate) => {
    const attributedPeriod = normalizeAccountingPeriod(candidate.attributedPeriod)
      ?? candidate.evidenceDate?.slice(0, 7)
      ?? inferPeriodFromFilename(candidate.sourceFilename)
    const relation = periodRelation({ attributedPeriod, targetRange: params.targetRange })
    if (!hasResolvedPeriod({ attributedPeriod, periodRelation: relation })) return []

    return [{
      uploadFileId: candidate.uploadFileId,
      sourceKind: 'file_summary' as const,
      sourceLabel: candidate.sourceFilename,
      evidenceDate: candidate.evidenceDate ?? null,
      attributedPeriod,
      periodRelation: relation,
      amountKrw: candidate.amountKrw ?? null,
      counterparty: candidate.counterparty ?? null,
      description: candidate.description ?? null,
      duplicateStatus: 'none' as const,
      duplicateBasis: null,
      recommendation: recommendationFor({ relation, duplicateStatus: 'none' }),
    }]
  })
}
