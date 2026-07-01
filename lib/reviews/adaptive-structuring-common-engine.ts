import { DateTime } from 'luxon'
import { parseRenderedRows, type ParsedRow } from '@/lib/payroll/structured-calculation'
import type { ReviewAdaptiveSourceText } from '@/lib/ai/review-adaptive-structuring-propose'
import type {
  ReviewAdaptiveFieldDataType,
  ReviewAdaptiveIgnoredRegionRule,
  ReviewAdaptiveModelContract,
} from './adaptive-structuring-model-contract'
import { redactReviewAdaptiveSampleValue } from './adaptive-structuring-proposal-redaction'
import {
  REVIEW_ADAPTIVE_AMOUNT_TARGET_FIELDS,
  REVIEW_ADAPTIVE_DATE_TARGET_FIELDS,
} from './adaptive-structuring-proposal-schema'

const HEADER_SEARCH_ROW_LIMIT = 30

export type ReviewAdaptivePreviewRow = {
  sheetName: string
  sourceRowRef: string
  values: Record<string, string | number | null>
}

export type ReviewAdaptiveCommonEngineEvidence = {
  sheetName: string
  matchedRequiredHeaders: string[]
  missingRequiredHeaders: string[]
}

export type ReviewAdaptiveCommonEngineResult = {
  matched: boolean
  standardRows: ReviewAdaptivePreviewRow[]
  blockedRowCount: number
  warnings: string[]
  blockers: string[]
  evidence: ReviewAdaptiveCommonEngineEvidence[]
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, '').trim().toLowerCase()
}

function looseLabelMatch(cellText: string, label: string): boolean {
  const normalizedCell = normalizeLabel(cellText)
  const normalizedLabel = normalizeLabel(label)
  if (!normalizedCell || !normalizedLabel) return false
  if (normalizedCell === normalizedLabel) return true
  return normalizedLabel.length >= 2 && normalizedCell.includes(normalizedLabel)
}

function findLabelColumnIndex(row: ParsedRow, label: string): number {
  return row.cells.findIndex((cellText) => looseLabelMatch(cellText, label))
}

function matchedLabelsInRow(row: ParsedRow, labels: string[]): Set<string> {
  const matched = new Set<string>()
  for (const label of labels) {
    if (findLabelColumnIndex(row, label) >= 0) matched.add(label)
  }
  return matched
}

function sheetNameMatchesPattern(sheetName: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true
  return patterns.some((pattern) => looseLabelMatch(sheetName, pattern) || looseLabelMatch(pattern, sheetName))
}

type HeaderLocateResult =
  | { kind: 'found'; headerRowIndex: number }
  | { kind: 'merged_header_unsupported' }
  | { kind: 'not_found'; missingLabels: string[] }

// payroll 엔진과 동일 결정: 2행 이상 병합 헤더는 첫 구현에서 지원하지 않고 명확한
// 사유로 fail closed 한다. 단일 행에서 필수 헤더를 모두 찾지 못했지만 인접한 두 행에
// 걸쳐 모두 발견되면 병합 헤더로 보고 matched:false를 반환한다.
function locateHeaderRow(rows: ParsedRow[], requiredLabels: string[]): HeaderLocateResult {
  const searchRows = rows.slice(0, HEADER_SEARCH_ROW_LIMIT)

  for (let i = 0; i < searchRows.length; i++) {
    const matched = matchedLabelsInRow(searchRows[i]!, requiredLabels)
    if (matched.size === requiredLabels.length) {
      return { kind: 'found', headerRowIndex: i }
    }
  }

  for (let i = 0; i < searchRows.length - 1; i++) {
    const matchedTop = matchedLabelsInRow(searchRows[i]!, requiredLabels)
    const matchedBottom = matchedLabelsInRow(searchRows[i + 1]!, requiredLabels)
    if (matchedTop.size === 0 || matchedBottom.size === 0) continue
    const union = new Set([...matchedTop, ...matchedBottom])
    const neitherRowAloneSufficient = matchedTop.size < requiredLabels.length && matchedBottom.size < requiredLabels.length
    if (union.size === requiredLabels.length && neitherRowAloneSufficient) {
      return { kind: 'merged_header_unsupported' }
    }
  }

  const bestMatch = searchRows.reduce<Set<string>>((best, row) => {
    const matched = matchedLabelsInRow(row, requiredLabels)
    return matched.size > best.size ? matched : best
  }, new Set<string>())

  return {
    kind: 'not_found',
    missingLabels: requiredLabels.filter((label) => !bestMatch.has(label)),
  }
}

type AmountCellResult = { status: 'blank' | 'zero' | 'present'; value: number | null }

function parseAmountCell(raw: string): AmountCellResult {
  const trimmed = raw.trim()
  if (!trimmed) return { status: 'blank', value: null }
  const cleaned = trimmed.replace(/,/g, '').replace(/[^\d.-]/g, '')
  if (!cleaned) return { status: 'blank', value: null }
  const numberValue = Number(cleaned)
  if (!Number.isFinite(numberValue)) return { status: 'blank', value: null }
  if (numberValue === 0) return { status: 'zero', value: 0 }
  return { status: 'present', value: Math.round(numberValue) }
}

const DATE_CELL_FORMATS = ['yyyy-MM-dd', 'yyyy.MM.dd', 'yyyy/MM/dd', 'yyyy-MM', 'yyyy.MM', 'yyyy/MM']

function parseDateCell(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  for (const format of DATE_CELL_FORMATS) {
    const parsed = DateTime.fromFormat(trimmed, format)
    if (parsed.isValid) return parsed.toISODate()
  }
  const iso = DateTime.fromISO(trimmed)
  return iso.isValid ? iso.toISODate() : null
}

function normalizeCellValue(raw: string, dataType: ReviewAdaptiveFieldDataType): string | number | null {
  if (dataType === 'amount') {
    const parsed = parseAmountCell(raw)
    return parsed.status === 'blank' ? null : parsed.value
  }
  if (dataType === 'date') {
    return parseDateCell(raw)
  }
  const trimmed = raw.trim()
  return trimmed || null
}

// 엔진은 워크북 원문 셀 값을 직접 읽으므로, AI 제안의 sampleRows와 똑같이
// 주민번호/전화번호/계좌번호 패턴을 화면에 보내기 전에 마스킹한다(Slice 2와 동일 보호).
function redactPreviewRowValues(
  values: Record<string, string | number | null>,
): Record<string, string | number | null> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => (
      [key, typeof value === 'string' ? redactReviewAdaptiveSampleValue(value) : value]
    )),
  )
}

function rowMatchesIgnoredRegion(
  row: ParsedRow,
  ignoredRegionsForSheet: ReviewAdaptiveIgnoredRegionRule[],
): boolean {
  return ignoredRegionsForSheet.some((region) => (
    row.cells.some((cellText) => looseLabelMatch(cellText, region.sourceColumnOrRegion))
  ))
}

export function matchReviewAdaptiveWorkbookSignature(
  contract: ReviewAdaptiveModelContract,
  fileTexts: ReviewAdaptiveSourceText[],
): { matched: boolean; matchingSheetNames: string[]; blockers: string[] } {
  const matchingSheetNames = [...new Set(
    fileTexts
      .filter((fileText) => fileText.text && fileText.sheetName)
      .map((fileText) => fileText.sheetName!)
      .filter((sheetName) => sheetNameMatchesPattern(sheetName, contract.workbookSignature.sheetNamePatterns)),
  )]

  if (matchingSheetNames.length === 0) {
    return { matched: false, matchingSheetNames: [], blockers: ['제안된 시트명을 워크북에서 찾지 못했습니다.'] }
  }

  return { matched: true, matchingSheetNames, blockers: [] }
}

// AI가 제안한 매핑(Slice 2)을 같은 워크북에 결정론적으로 재실행해 검증한다(preview_only).
// 승인된 모델 저장/재사용이나 거래 row 영속화는 다루지 않는다. payroll의 직원 식별자
// 요구사항 대신, 거래 row는 거래일/증빙일 1개 이상 + 금액 1개 이상이 있어야 인정한다.
export function runReviewAdaptiveCommonEngine(
  contract: ReviewAdaptiveModelContract,
  fileTexts: ReviewAdaptiveSourceText[],
): ReviewAdaptiveCommonEngineResult {
  const signatureMatch = matchReviewAdaptiveWorkbookSignature(contract, fileTexts)
  if (!signatureMatch.matched) {
    return {
      matched: false,
      standardRows: [],
      blockedRowCount: 0,
      warnings: [],
      blockers: signatureMatch.blockers,
      evidence: [],
    }
  }

  const standardRows: ReviewAdaptivePreviewRow[] = []
  const warnings: string[] = []
  const blockers: string[] = []
  const evidence: ReviewAdaptiveCommonEngineEvidence[] = []
  let blockedRowCount = 0
  let anySheetMatched = false

  for (const sheetName of signatureMatch.matchingSheetNames) {
    const sheetFieldMappings = contract.fieldMappings.filter((mapping) => mapping.sheetName === sheetName)
    if (sheetFieldMappings.length === 0) continue

    const sheetText = fileTexts.find((fileText) => fileText.sheetName === sheetName)?.text ?? null
    const rows = parseRenderedRows(sheetText)
    if (rows.length === 0) {
      blockers.push(`[${sheetName}] 시트에서 행을 읽지 못했습니다.`)
      continue
    }

    // 헤더 행 탐지에는 시그니처 레벨 필수 헤더(날짜/금액)만 쓴다. 거래처/내용 같은
    // 보조 컬럼은 매핑이 안 돼 있어도 구조 매칭 자체를 막지 않는다 — 해당 필드만 비워둔다.
    const sheetSourceColumns = new Set(sheetFieldMappings.map((mapping) => mapping.sourceColumn))
    const requiredLabels = [...new Set(
      contract.workbookSignature.requiredHeaderLabels.filter((label) => sheetSourceColumns.has(label)),
    )]
    if (requiredLabels.length === 0) {
      blockers.push(`[${sheetName}] 검증할 필수 헤더가 없습니다.`)
      continue
    }
    const headerResult = locateHeaderRow(rows, requiredLabels)

    if (headerResult.kind === 'merged_header_unsupported') {
      blockers.push(`[${sheetName}] 2행 이상 병합 헤더로 보입니다. 현재 버전은 지원하지 않습니다.`)
      evidence.push({ sheetName, matchedRequiredHeaders: [], missingRequiredHeaders: requiredLabels })
      continue
    }
    if (headerResult.kind === 'not_found') {
      blockers.push(`[${sheetName}] 필수 헤더(${headerResult.missingLabels.join(', ')})를 찾지 못했습니다.`)
      evidence.push({
        sheetName,
        matchedRequiredHeaders: requiredLabels.filter((label) => !headerResult.missingLabels.includes(label)),
        missingRequiredHeaders: headerResult.missingLabels,
      })
      continue
    }

    anySheetMatched = true
    const headerRow = rows[headerResult.headerRowIndex]!
    evidence.push({ sheetName, matchedRequiredHeaders: requiredLabels, missingRequiredHeaders: [] })

    const mappingColumns = sheetFieldMappings
      .map((mapping) => ({ mapping, columnIndex: findLabelColumnIndex(headerRow, mapping.sourceColumn) }))
      .filter((entry) => entry.columnIndex >= 0)

    const sheetIgnoredRegions = contract.ignoredRegions.filter((region) => region.sheetName === sheetName)
    const dataRows = rows.slice(headerResult.headerRowIndex + 1)

    for (const row of dataRows) {
      if (row.cells.every((cellText) => !cellText.trim())) continue
      if (rowMatchesIgnoredRegion(row, sheetIgnoredRegions)) continue

      const values: Record<string, string | number | null> = {}
      for (const { mapping, columnIndex } of mappingColumns) {
        const raw = row.cells[columnIndex] ?? ''
        values[mapping.targetField] = normalizeCellValue(raw, mapping.dataType)
      }

      const datePresent = REVIEW_ADAPTIVE_DATE_TARGET_FIELDS.some((field) => values[field])
      const amountPresent = REVIEW_ADAPTIVE_AMOUNT_TARGET_FIELDS.some((field) => values[field] !== null && values[field] !== undefined)
      if (!datePresent || !amountPresent) {
        blockedRowCount += 1
        continue
      }

      standardRows.push({ sheetName, sourceRowRef: `row ${row.rowNumber}`, values: redactPreviewRowValues(values) })
    }
  }

  if (!anySheetMatched) {
    return { matched: false, standardRows: [], blockedRowCount, warnings, blockers, evidence }
  }

  return { matched: true, standardRows, blockedRowCount, warnings, blockers, evidence }
}
