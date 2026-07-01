import type { TransactionCandidate } from './schemas'
import {
  isBookkeepingPeriodInRange,
  periodFromAttributionValue,
  resolveBookkeepingPeriodRange,
  type BookkeepingPeriodRange,
} from './period-range'

export type AttributionGateFile = {
  id: string
}

export type AttributionGateRow = {
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

function normalizeAccountingPeriod(value: string) {
  const match = value.match(/(20\d{2})[-.\s년]*(\d{1,2})/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, '0')}`
}

function resolveEvidenceDate(value: string | undefined, requestedPeriod: string) {
  if (!value) return null
  if (/^20\d{2}-\d{2}-\d{2}$/.test(value)) return value
  if (/^\d{2}-\d{2}$/.test(value)) {
    const year = normalizeAccountingPeriod(requestedPeriod)?.slice(0, 4)
    return year ? `${year}-${value}` : null
  }
  return null
}

function inferPeriodFromFilename(filename: string) {
  const match = filename.match(/(20\d{2})[-_.\s년]*(\d{1,2})/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, '0')}`
}

function attributionSignature(params: {
  uploadFileId: string | null
  evidenceDate: string | null
  attributedPeriod: string | null
  amountKrw: number | null
  counterparty: string | null
  description: string | null
  sourceLabel: string
}) {
  return [
    params.uploadFileId ?? 'file:none',
    params.evidenceDate ?? params.attributedPeriod ?? 'period:unknown',
    params.amountKrw ?? 'amount:none',
    params.counterparty ?? params.description ?? params.sourceLabel,
  ].join('|')
}

function candidateSignature(candidate: TransactionCandidate, requestedPeriod: string) {
  const evidenceDate = resolveEvidenceDate(candidate.transactionDate, requestedPeriod)
  const attributedPeriod = evidenceDate?.slice(0, 7) ?? inferPeriodFromFilename(candidate.sourceFilename)
  return attributionSignature({
    uploadFileId: candidate.sourceFileId,
    evidenceDate,
    attributedPeriod,
    amountKrw: candidate.amountKrw ?? null,
    counterparty: candidate.merchantName ?? null,
    description: candidate.description ?? null,
    sourceLabel: candidate.sourceFilename,
  })
}

export function buildMaterialAttributionGate<TFile extends AttributionGateFile>(params: {
  files: TFile[]
  attributionRows: AttributionGateRow[]
  requestedPeriod: string
  targetRange?: BookkeepingPeriodRange | null
}) {
  if (params.attributionRows.length === 0) return null

  const targetRange = params.targetRange ?? resolveBookkeepingPeriodRange({
    accountingPeriod: params.requestedPeriod,
    periodType: 'monthly',
  })
  if (!targetRange) return null

  const activeFileIds = new Set(params.files.map((file) => file.id))
  const includedTransactionSignatureCounts = new Map<string, number>()
  const includedFileSummaryIds = new Set<string>()
  const fileIdsWithTransactionRows = new Set<string>()

  for (const row of params.attributionRows) {
    if (!row.uploadFileId || !activeFileIds.has(row.uploadFileId)) continue
    if (row.sourceKind === 'transaction_row') {
      fileIdsWithTransactionRows.add(row.uploadFileId)
    }
    if ((row.staffDecision ?? row.recommendation) !== 'include') continue
    if (!isBookkeepingPeriodInRange(periodFromAttributionValue(row), targetRange)) continue
    if (row.sourceKind === 'file_summary') {
      includedFileSummaryIds.add(row.uploadFileId)
      continue
    }

    const signature = attributionSignature({
      uploadFileId: row.uploadFileId,
      evidenceDate: row.evidenceDate,
      attributedPeriod: row.attributedPeriod,
      amountKrw: row.amountKrw,
      counterparty: row.counterparty,
      description: row.description,
      sourceLabel: row.sourceLabel,
    })
    includedTransactionSignatureCounts.set(
      signature,
      (includedTransactionSignatureCounts.get(signature) ?? 0) + 1,
    )
  }

  const sourceFileIds = new Set([
    ...includedFileSummaryIds,
    ...params.attributionRows
      .filter((row) =>
        row.uploadFileId &&
        (row.staffDecision ?? row.recommendation) === 'include' &&
        isBookkeepingPeriodInRange(periodFromAttributionValue(row), targetRange),
      )
      .map((row) => row.uploadFileId as string),
  ])

  return {
    sourceFiles: params.files.filter((file) => sourceFileIds.has(file.id)),
    filterCandidates(candidates: TransactionCandidate[]) {
      return candidates.filter((candidate) => {
        const signature = candidateSignature(candidate, params.requestedPeriod)
        const remaining = includedTransactionSignatureCounts.get(signature) ?? 0
        if (remaining > 0) {
          includedTransactionSignatureCounts.set(signature, remaining - 1)
          return true
        }
        return includedFileSummaryIds.has(candidate.sourceFileId) &&
          !fileIdsWithTransactionRows.has(candidate.sourceFileId)
      })
    },
  }
}
