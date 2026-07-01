import * as XLSX from 'xlsx'
import { transactionCandidateSchema, type TransactionCandidate } from './schemas'

const MAX_SHEETS = 24
const MAX_ROWS = 1000
const MAX_CANDIDATES = 1000

type SourceType = TransactionCandidate['sourceType']
type Direction = TransactionCandidate['direction']

type HeaderMap = {
  headers: string[]
  dateIndexes: number[]
  amountIndexes: number[]
  incomeAmountIndexes: number[]
  expenseAmountIndexes: number[]
  merchantIndexes: number[]
}

export type BookkeepingTransactionFileInspection = {
  usableForTransactionWorkpapers: boolean
  documentKind: 'transaction_detail' | 'monthly_vat_summary' | 'unknown'
  reason: string
  candidateCount: number
}

type UploadFileLike = {
  id: string
  originalFilename: string
  fileType: string
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function normalizeAmount(value: string): number | null {
  if (/^20\d{2}[./-]\d{1,2}$/.test(value.trim())) return null
  const cleaned = value.replace(/[,\s원₩]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const negative = /^\(.+\)$/.test(cleaned) || cleaned.startsWith('-')
  const numeric = Number(cleaned.replace(/[()]/g, ''))
  if (!Number.isFinite(numeric)) return null
  const amount = Math.round(Math.abs(numeric))
  return negative ? -amount : amount
}

function pickRepresentativeAmount(amounts: Array<{ amount: number; index?: number }>) {
  if (amounts.length === 0) return null
  const nonZero = amounts.filter(({ amount }) => amount !== 0)
  const candidates = nonZero.length > 0 ? nonZero : amounts
  return candidates.reduce((picked, amount) => (
    Math.abs(amount.amount) > Math.abs(picked.amount) ? amount : picked
  ), candidates[0] ?? { amount: 0 })
}

function normalizeDate(value: string): string | null {
  const source = value.trim()
  if (!source) return null

  const ymd = source.match(/(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/)
  if (ymd) {
    const month = Number(ymd[2])
    const day = Number(ymd[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
  }

  const md = source.match(/\b(\d{1,2})[-./월\s]+(\d{1,2})\b/)
  if (md) {
    const month = Number(md[1])
    const day = Number(md[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`
  }

  return null
}

function inferSourceType(file: UploadFileLike, row: string[]): SourceType {
  const text = `${file.originalFilename}\n${row.join(' ')}`.toLowerCase()
  if (/지출\s*결의|지출결의|결재방법|집행일자|지출금액/.test(text)) return 'other'
  if (/카드|card/.test(text)) return 'card'
  if (/세금계산서|tax.?invoice/.test(text)) return 'tax_invoice'
  if (/영수증|receipt/.test(text)) return 'receipt'
  if (/통장|은행|bank|statement|거래내역/.test(text)) return 'bank'
  return 'other'
}

function inferDirection(row: string[], amount: number | null): Direction {
  const text = row.join(' ')
  if (/입금|매출|수입|deposit|income/i.test(text)) return 'income'
  if (/출금|지출|결제|사용|withdraw|expense|payment/i.test(text)) return 'expense'
  if (amount !== null && amount < 0) return 'expense'
  return 'unknown'
}

function pickMerchant(row: string[]) {
  const candidates = row
    .map((cell) => cell.trim())
    .filter((cell) => {
      if (!cell) return false
      if (normalizeDate(cell)) return false
      if (normalizeAmount(cell) !== null) return false
      return cell.length <= 80
    })
  return candidates[0] ?? undefined
}

function normalizeHeader(value: string) {
  return value.replace(/[\s()[\]{}·:._-]/g, '').toLowerCase()
}

function isDateHeader(value: string) {
  return [
    '거래일시',
    '거래일자',
    '마감일자',
    '승인일자',
    '결제일자',
    '매출일자',
    '작성일자',
    '증빙일자',
    '정산일자',
    '집행일자',
    '지출일자',
    '사용일자',
    '발생일자',
    '날짜',
    '일자',
  ].includes(value)
}

function isAmountHeader(value: string) {
  return [
    '정산예상금액',
    '거래금액',
    '결제금액',
    '승인금액',
    '매출금액',
    '공급가액',
    '지출금액',
    '집행금액',
    '사용금액',
    '청구금액',
    '영수금액',
    '수납금액',
    '입금액',
    '출금액',
    '지급',
    '지급원',
    '입금',
    '입금원',
    '출금',
    '출금원',
    '신용카드',
    '계좌이체',
    '가상계좌',
    '현금',
    '금액',
  ].includes(value)
}

function isIncomeAmountHeader(value: string) {
  return [
    '입금액',
    '입금',
    '입금원',
    '매출금액',
    '정산예상금액',
  ].includes(value)
}

function isExpenseAmountHeader(value: string) {
  return [
    '출금액',
    '출금',
    '출금원',
    '지출금액',
    '집행금액',
    '사용금액',
    '청구금액',
    '영수금액',
    '수납금액',
    '지급',
    '지급원',
    '결제금액',
    '승인금액',
  ].includes(value)
}

function isMerchantHeader(value: string) {
  return [
    '거래처',
    '적요',
    '내용',
    '기재내용',
    '거래내용',
    '사이트명',
    '가맹점',
    '상호',
    '거래처명',
    '사용처',
    '수취인',
    '의뢰인수취인',
    '판매처',
    '보낸분',
    '받는분',
    '이름',
  ].includes(value)
}

function isMonthlyVatSummaryHeader(row: string[]) {
  const normalized = row.map(normalizeHeader)
  const hasVatPeriod = normalized.includes('부가세신고기간')
  const aggregateHeaders = new Set([
    '과세매출금액',
    '면세매출금액',
    '신용카드매출전표',
    '현금영수증소득공제',
    '현금영수증지출증빙',
    '현금영수증발행제외',
    '기타',
  ])
  const aggregateCount = normalized.filter((cell) => aggregateHeaders.has(cell)).length
  return hasVatPeriod && aggregateCount >= 2
}

function detectHeaderMap(row: string[]): HeaderMap | null {
  const normalized = row.map(normalizeHeader)
  const dateIndexes: number[] = []
  const amountIndexes: number[] = []
  const incomeAmountIndexes: number[] = []
  const expenseAmountIndexes: number[] = []
  const merchantIndexes: number[] = []
  let recognizedHeaderCells = 0

  normalized.forEach((cell, index) => {
    if (!cell) return
    if (isDateHeader(cell)) {
      dateIndexes.push(index)
      recognizedHeaderCells += 1
    }
    if (isAmountHeader(cell)) {
      amountIndexes.push(index)
      recognizedHeaderCells += 1
    }
    if (isIncomeAmountHeader(cell)) incomeAmountIndexes.push(index)
    if (isExpenseAmountHeader(cell)) expenseAmountIndexes.push(index)
    if (isMerchantHeader(cell)) {
      merchantIndexes.push(index)
      recognizedHeaderCells += 1
    }
  })

  if (dateIndexes.length === 0 || amountIndexes.length === 0 || recognizedHeaderCells < 2) return null
  return { headers: row, dateIndexes, amountIndexes, incomeAmountIndexes, expenseAmountIndexes, merchantIndexes }
}

function detectDocumentKind(rows: Array<{ row: string[] }>): BookkeepingTransactionFileInspection['documentKind'] {
  if (rows.some((row) => isMonthlyVatSummaryHeader(row.row))) return 'monthly_vat_summary'
  return 'unknown'
}

function pickByIndexes<T>(values: string[], indexes: number[], mapper: (value: string) => T | null) {
  for (const index of indexes) {
    const mapped = mapper(values[index] ?? '')
    if (mapped !== null) return mapped
  }
  return null
}

function pickMerchantFromHeader(row: string[], headerMap?: HeaderMap | null) {
  if (!headerMap || headerMap.merchantIndexes.length === 0) return pickMerchant(row)
  const merchant = pickByIndexes(row, headerMap.merchantIndexes, (value) => {
    const trimmed = value.trim()
    return trimmed && normalizeAmount(trimmed) === null && !normalizeDate(trimmed) ? trimmed : null
  })
  return merchant ?? pickMerchant(row)
}

function pickDescription(row: string[]) {
  const values = row.map((cell) => cell.trim()).filter(Boolean)
  return values.slice(0, 6).join(' · ') || undefined
}

function pickHeaderLabeledDescription(row: string[], headerMap?: HeaderMap | null) {
  if (!headerMap) return pickDescription(row)
  const labeledValues = row
    .map((cell, index) => {
      const value = cell.trim()
      if (!value) return null
      const header = headerMap.headers[index]?.trim()
      return header ? `${header}: ${value}` : value
    })
    .filter((value): value is string => value !== null)
  return labeledValues.slice(0, 10).join(' · ') || pickDescription(row)
}

function inferDirectionFromHeaderAmount(
  headerMap: HeaderMap | null | undefined,
  amountIndex: number | undefined,
  row: string[],
  amount: number | null,
): Direction {
  if (headerMap && amountIndex !== undefined) {
    if (headerMap.incomeAmountIndexes.includes(amountIndex)) return 'income'
    if (headerMap.expenseAmountIndexes.includes(amountIndex)) return 'expense'
  }
  return inferDirection(row, amount)
}

function isSummaryRow(row: string[]) {
  const text = row.join(' ')
  return /(^|\s)(합계|총계|소계|원화\s*합계|달러\s*합계|엔화\s*합계|total|subtotal)(\s|$)/i.test(text) ||
    /(^|\s)총\s*\d+\s*건(\s|$)/.test(text)
}

function rowToCandidate(
  file: UploadFileLike,
  row: string[],
  meta: { sheetName: string; rowNumber: number; headerMap?: HeaderMap | null },
): TransactionCandidate | null {
  if (isSummaryRow(row)) return null

  const headerDate = meta.headerMap
    ? pickByIndexes(row, meta.headerMap.dateIndexes, normalizeDate)
    : null
  const date = headerDate ?? row.map(normalizeDate).find(Boolean) ?? undefined
  const headerAmounts = meta.headerMap
    ? meta.headerMap.amountIndexes
      .map((index) => ({ index, amount: normalizeAmount(row[index] ?? '') }))
      .filter((value): value is { index: number; amount: number } => value.amount !== null)
    : []
  const fallbackAmounts = row
    .map(normalizeAmount)
    .filter((value): value is number => value !== null)
    .map((amount) => ({ amount }))
  const amounts = headerAmounts.length > 0 ? headerAmounts : fallbackAmounts

  if (!date && amounts.length === 0) return null
  if (amounts.length === 0) return null

  const pickedAmount = pickRepresentativeAmount(amounts)
  if (pickedAmount === null) return null
  const description = pickHeaderLabeledDescription(row, meta.headerMap)
  const candidate = {
    sourceFileId: file.id,
    sourceFilename: file.originalFilename,
    sourceType: inferSourceType(file, row),
    transactionDate: date,
    merchantName: pickMerchantFromHeader(row, meta.headerMap),
    description: [
      `${meta.sheetName} 시트 ${meta.rowNumber}행`,
      description,
    ].filter(Boolean).join(' · '),
    amountKrw: Math.abs(pickedAmount.amount),
    direction: inferDirectionFromHeaderAmount(meta.headerMap, pickedAmount.index, row, pickedAmount.amount),
    rawRow: row.slice(0, 30),
  }

  const parsed = transactionCandidateSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

function extractExcelRows(buffer: ArrayBuffer) {
  const workbook = XLSX.read(Buffer.from(buffer), {
    type: 'buffer',
    cellDates: false,
    sheetRows: MAX_ROWS,
  })
  return workbook.SheetNames.slice(0, MAX_SHEETS).flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
    return XLSX.utils.sheet_to_json<Array<unknown>>(sheet, {
      header: 1,
      blankrows: true,
      raw: false,
    }).map((row, index) => ({
      sheetName,
      rowNumber: range.s.r + index + 1,
      row: Array.from(row, normalizeCell),
    }))
  })
}

function extractCsvRows(buffer: ArrayBuffer) {
  const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) return []
  const range = XLSX.utils.decode_range(firstSheet['!ref'] ?? 'A1')
  return XLSX.utils.sheet_to_json<Array<unknown>>(firstSheet, {
    header: 1,
    blankrows: true,
    raw: false,
  }).map((row, index) => ({
    sheetName: workbook.SheetNames[0] ?? 'CSV',
    rowNumber: range.s.r + index + 1,
    row: Array.from(row, normalizeCell),
  }))
}

export function extractTransactionCandidates(params: {
  file: UploadFileLike
  buffer: ArrayBuffer
}): TransactionCandidate[] {
  if (params.file.fileType !== 'excel' && !/\.(csv|xlsx?|xlsm)$/i.test(params.file.originalFilename)) {
    return []
  }

  const rows = /\.csv$/i.test(params.file.originalFilename)
    ? extractCsvRows(params.buffer)
    : extractExcelRows(params.buffer)
  if (detectDocumentKind(rows) === 'monthly_vat_summary') return []

  const candidates: TransactionCandidate[] = []
  const headerMaps = new Map<string, HeaderMap | null>()
  for (const row of rows) {
    if (candidates.length >= MAX_CANDIDATES) break
    const detectedHeader = detectHeaderMap(row.row)
    if (detectedHeader) {
      headerMaps.set(row.sheetName, detectedHeader)
      continue
    }
    const candidate = rowToCandidate(params.file, row.row, {
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      headerMap: headerMaps.get(row.sheetName),
    })
    if (candidate) candidates.push(candidate)
  }

  return candidates
}

export function inspectBookkeepingFileForTransactions(params: {
  file: UploadFileLike
  buffer: ArrayBuffer
}): BookkeepingTransactionFileInspection {
  if (params.file.fileType !== 'excel' && !/\.(csv|xlsx?|xlsm)$/i.test(params.file.originalFilename)) {
    return {
      usableForTransactionWorkpapers: false,
      documentKind: 'unknown',
      reason: '엑셀 또는 CSV 거래자료가 아니어서 거래행을 추출할 수 없습니다.',
      candidateCount: 0,
    }
  }

  const rows = /\.csv$/i.test(params.file.originalFilename)
    ? extractCsvRows(params.buffer)
    : extractExcelRows(params.buffer)
  const documentKind = detectDocumentKind(rows)
  const candidates = extractTransactionCandidates(params)

  if (documentKind === 'monthly_vat_summary') {
    return {
      usableForTransactionWorkpapers: false,
      documentKind,
      reason: '엑셀 내부가 거래 상세내역이 아니라 부가세 신고기간별 월별 매출 집계표입니다. 거래일자, 거래처, 건별 금액이 있는 정산 상세내역이 필요합니다.',
      candidateCount: candidates.length,
    }
  }

  if (candidates.length > 0) {
    return {
      usableForTransactionWorkpapers: true,
      documentKind: 'transaction_detail',
      reason: '거래일자와 건별 금액이 있는 거래 상세행을 추출했습니다.',
      candidateCount: candidates.length,
    }
  }

  return {
    usableForTransactionWorkpapers: false,
    documentKind,
    reason: '거래일자와 건별 금액이 있는 거래 상세행을 찾지 못했습니다.',
    candidateCount: 0,
  }
}
