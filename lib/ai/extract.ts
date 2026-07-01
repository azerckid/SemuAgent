import * as XLSX from 'xlsx'
import {
  classifyExcelReadFailure,
  describeExcelAccessFailure,
  isPasswordProtectedExcel,
  type ExcelAccessFailureReason,
} from './excel-access'

const MAX_EXTRACTED_TEXT_CHARS = 20000
const MAX_SHEETS = 8
const MAX_ROWS_PER_SHEET = 80
const MAX_COLS_PER_ROW = 20

const PAYROLL_MAX_EXTRACTED_TEXT_CHARS = 60000
const PAYROLL_MAX_SHEETS = 12
const PAYROLL_MAX_ROWS_PER_SHEET = 160
const PAYROLL_MAX_COLS_PER_ROW = 24
const PAYROLL_CHUNK_MAX_TEXT_CHARS = 18000
const PAYROLL_CHUNK_MAX_SHEETS = 40
const PAYROLL_CHUNK_MAX_ROWS_PER_CHUNK = 120
const PAYROLL_CHUNK_HEADER_ROWS = 2

// review(자료검토) adaptive structuring 엔진은 시트 단위 chunk(sheetName 메타데이터 포함)가
// 필요하다. 'default' profile은 전체 시트를 한 chunk로 합쳐서 sheetName을 채우지 않으므로
// payroll과 같은 chunk 경로를 별도 profile로 둔다. 일반 자료검토 파일은 payroll 워크북보다
// 작다고 보고 'default' 크기 한도를 그대로 쓴다.
const REVIEW_CHUNK_MAX_TEXT_CHARS = 8000
const REVIEW_CHUNK_MAX_SHEETS = MAX_SHEETS
const REVIEW_CHUNK_MAX_ROWS_PER_CHUNK = MAX_ROWS_PER_SHEET
const REVIEW_CHUNK_HEADER_ROWS = 2

export type ExtractionResult = {
  text: string | null
  summary: string | null
  /**
   * 추출 실패 사유. 성공 시에는 설정되지 않는다(undefined).
   * Slice 1: 비밀번호 필요 / 일반 파싱 실패를 구분하기 위한 기반 필드.
   */
  failureReason?: ExcelAccessFailureReason
}

export type ExtractedTextChunk = ExtractionResult & {
  chunkIndex?: number
  chunkTotal?: number
  sheetName?: string
  rowStart?: number
  rowEnd?: number
}

export type ExcelExtractionProfile = 'default' | 'payroll' | 'review'

type ExcelExtractionLimits = {
  maxTextChars: number
  maxSheets: number
  maxRowsPerSheet: number
  maxColsPerRow: number
}

type RenderedExcelSection = {
  sheetName: string
  text: string
}

type PendingExcelChunk = {
  sheetName: string
  sheetRange: string | null
  rowStart: number | null
  rowEnd: number | null
  text: string
}

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function truncateText(value: string, maxChars = MAX_EXTRACTED_TEXT_CHARS): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}\n\n[이하 생략: 추출 텍스트가 길어 앞부분만 전달됨]`
}

function getExcelExtractionLimits(profile: ExcelExtractionProfile): ExcelExtractionLimits {
  if (profile === 'payroll') {
    return {
      maxTextChars: PAYROLL_MAX_EXTRACTED_TEXT_CHARS,
      maxSheets: PAYROLL_MAX_SHEETS,
      maxRowsPerSheet: PAYROLL_MAX_ROWS_PER_SHEET,
      maxColsPerRow: PAYROLL_MAX_COLS_PER_ROW,
    }
  }

  return {
    maxTextChars: MAX_EXTRACTED_TEXT_CHARS,
    maxSheets: MAX_SHEETS,
    maxRowsPerSheet: MAX_ROWS_PER_SHEET,
    maxColsPerRow: MAX_COLS_PER_ROW,
  }
}

export type DocumentExtractFileType = 'pdf' | 'excel' | 'image' | 'text' | 'word' | 'other'

export async function extractDocumentText(params: {
  fileBuffer: ArrayBuffer | null
  fileType: DocumentExtractFileType
  originalFilename: string
  contentType?: string
  profile?: ExcelExtractionProfile
}): Promise<ExtractionResult> {
  if (!params.fileBuffer) {
    return { text: null, summary: '파일 버퍼 없음' }
  }

  if (params.fileType === 'pdf') {
    return extractPdfText(params.fileBuffer)
  }

  if (params.fileType === 'excel') {
    return extractExcelText(params.fileBuffer, params.originalFilename, params.profile ?? 'default')
  }

  if (params.fileType === 'text') {
    return extractPlainText(params.fileBuffer)
  }

  if (params.fileType === 'word') {
    return extractWordText(params.fileBuffer, params.contentType ?? '', params.originalFilename)
  }

  return { text: null, summary: null }
}

export async function extractDocumentTextChunks(params: {
  fileBuffer: ArrayBuffer | null
  fileType: DocumentExtractFileType
  originalFilename: string
  contentType?: string
  profile?: ExcelExtractionProfile
}): Promise<ExtractedTextChunk[]> {
  if (!params.fileBuffer) {
    return [{ text: null, summary: '파일 버퍼 없음' }]
  }

  if (params.fileType === 'excel' && params.profile === 'payroll') {
    return extractPayrollExcelTextChunks(params.fileBuffer, params.originalFilename)
  }

  if (params.fileType === 'excel' && params.profile === 'review') {
    return extractReviewExcelTextChunks(params.fileBuffer, params.originalFilename)
  }

  const result = await extractDocumentText(params)
  return [result]
}

function extractPlainText(fileBuffer: ArrayBuffer): ExtractionResult {
  try {
    const text = truncateText(normalizeText(new TextDecoder('utf-8', { fatal: false }).decode(fileBuffer)))
    if (!text) {
      return { text: null, summary: '텍스트 파일 내용이 비어 있습니다' }
    }
    return {
      text,
      summary: `텍스트 파일 추출 성공 (${text.length.toLocaleString('ko-KR')}자)`,
    }
  } catch (err) {
    return {
      text: null,
      summary: `텍스트 파일 추출 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
    }
  }
}

async function extractWordText(
  fileBuffer: ArrayBuffer,
  contentType: string,
  originalFilename: string,
): Promise<ExtractionResult> {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  const isDocx = normalized === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || originalFilename.toLowerCase().endsWith('.docx')

  try {
    if (isDocx) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer: Buffer.from(fileBuffer) })
      const text = truncateText(normalizeText(result.value ?? ''))
      if (!text) {
        return { text: null, summary: 'Word 문서에서 텍스트를 추출하지 못했습니다' }
      }
      return {
        text,
        summary: `Word(docx) 텍스트 추출 성공 (${text.length.toLocaleString('ko-KR')}자)`,
      }
    }

    const WordExtractor = (await import('word-extractor')).default
    const extractor = new WordExtractor()
    const document = await extractor.extract(Buffer.from(fileBuffer))
    const text = truncateText(normalizeText(document.getBody() ?? ''))
    if (!text) {
      return { text: null, summary: 'Word(doc) 문서에서 텍스트를 추출하지 못했습니다' }
    }
    return {
      text,
      summary: `Word(doc) 텍스트 추출 성공 (${text.length.toLocaleString('ko-KR')}자)`,
    }
  } catch (err) {
    return {
      text: null,
      summary: `Word 문서 추출 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
    }
  }
}

async function extractPdfText(fileBuffer: ArrayBuffer): Promise<ExtractionResult> {
  let parser: InstanceType<Awaited<typeof import('pdf-parse')>['PDFParse']> | null = null

  try {
    const { PDFParse } = await import('pdf-parse')
    parser = new PDFParse({ data: Buffer.from(fileBuffer) })
    const result = await parser.getText()
    const text = truncateText(normalizeText(result.text ?? ''))

    if (!text) {
      return {
        text: null,
        summary: 'PDF 텍스트 레이어 없음 또는 텍스트 추출 결과 없음',
      }
    }

    return {
      text,
      summary: `PDF 텍스트 추출 성공 (${result.pages.length}페이지, ${text.length.toLocaleString('ko-KR')}자)`,
    }
  } catch (err) {
    return {
      text: null,
      summary: `PDF 텍스트 추출 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
    }
  } finally {
    await parser?.destroy().catch(() => undefined)
  }
}

function renderExcelSections(
  workbook: XLSX.WorkBook,
  sheetNames: string[],
  limits: ExcelExtractionLimits,
): RenderedExcelSection[] {
  return sheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const sheetRange = typeof sheet?.['!fullref'] === 'string'
      ? sheet['!fullref']
      : sheet?.['!ref']
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date | null>>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
    })

    const renderedRows = rows
      .slice(0, limits.maxRowsPerSheet)
      .map((row, rowIndex) => {
        const cells = row
          .slice(0, limits.maxColsPerRow)
          .map((cell) => String(cell ?? '').trim())
        return `${rowIndex + 1}: ${cells.join(' | ')}`
      })
      .join('\n')

    return {
      sheetName,
      text: [
        `## 시트: ${sheetName}`,
        `범위: ${sheetRange ?? '알 수 없음'}`,
        renderedRows || '(내용 없음)',
      ].join('\n'),
    }
  })
}

function renderExcelRow(
  row: Array<string | number | boolean | Date | null>,
  rowIndex: number,
  maxCols: number,
): string {
  const cells = row
    .slice(0, maxCols)
    .map((cell) => String(cell ?? '').trim())
  return `${rowIndex + 1}: ${cells.join(' | ')}`
}

function balanceExcelSectionsForLimit(
  sections: RenderedExcelSection[],
  maxChars: number,
): RenderedExcelSection[] {
  const totalChars = sections.reduce((sum, section) => sum + section.text.length, 0)
  if (totalChars <= maxChars) return sections

  const perSheetBudget = Math.max(1200, Math.floor(maxChars / Math.max(1, sections.length)) - 200)

  return sections.map((section) => {
    if (section.text.length <= perSheetBudget) return section
    return {
      ...section,
      text: `${section.text.slice(0, perSheetBudget)}\n[이하 생략: 이 시트 텍스트가 길어 앞부분만 전달됨]`,
    }
  })
}

function extractExcelText(
  fileBuffer: ArrayBuffer,
  originalFilename: string,
  profile: ExcelExtractionProfile,
): ExtractionResult {
  if (isPasswordProtectedExcel(fileBuffer)) {
    return {
      text: null,
      summary: describeExcelAccessFailure('password_required'),
      failureReason: 'password_required',
    }
  }

  try {
    const limits = getExcelExtractionLimits(profile)
    const workbook = XLSX.read(Buffer.from(fileBuffer), {
      type: 'buffer',
      cellDates: true,
      sheetRows: limits.maxRowsPerSheet,
    })

    const sheetNames = workbook.SheetNames.slice(0, limits.maxSheets)
    const sections = balanceExcelSectionsForLimit(
      renderExcelSections(workbook, sheetNames, limits),
      limits.maxTextChars,
    )

    const metadata = [
      `파일명: ${originalFilename}`,
      `시트 수: ${workbook.SheetNames.length}`,
    ]
    if (profile !== 'default') {
      metadata.push(`추출 프로필: ${profile}`)
    }

    const text = truncateText(normalizeText([
      ...metadata,
      sections.map((section) => section.text).join('\n\n'),
    ].join('\n\n')), limits.maxTextChars)

    return {
      text,
      summary: `Excel 시트 추출 성공 (${sheetNames.length}/${workbook.SheetNames.length}개 시트, ${text.length.toLocaleString('ko-KR')}자)`,
    }
  } catch (err) {
    const failureReason = classifyExcelReadFailure({ buffer: fileBuffer, error: err })
    if (failureReason === 'password_required') {
      return {
        text: null,
        summary: describeExcelAccessFailure('password_required'),
        failureReason,
      }
    }
    return {
      text: null,
      summary: `Excel 시트 추출 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
      failureReason,
    }
  }
}

function buildPayrollChunkText(params: {
  originalFilename: string
  sheetCount: number
  sheetName: string
  sheetRange: string | null
  rowStart: number | null
  rowEnd: number | null
  chunkIndex: number
  chunkTotal: number
  body: string
}): string {
  const rowRange = params.rowStart && params.rowEnd
    ? `${params.rowStart}-${params.rowEnd}`
    : '내용 없음'

  return truncateText(normalizeText([
    `파일명: ${params.originalFilename}`,
    `시트 수: ${params.sheetCount}`,
    '추출 프로필: payroll-chunked',
    `chunk: ${params.chunkIndex}/${params.chunkTotal}`,
    `## 시트: ${params.sheetName}`,
    `범위: ${params.sheetRange ?? '알 수 없음'}`,
    `행 범위: ${rowRange}`,
    params.body || '(내용 없음)',
  ].join('\n')), PAYROLL_CHUNK_MAX_TEXT_CHARS)
}

function buildPayrollSheetChunks(params: {
  sheetName: string
  sheet: XLSX.WorkSheet
}): PendingExcelChunk[] {
  const sheetRange = typeof params.sheet['!fullref'] === 'string'
    ? params.sheet['!fullref']
    : params.sheet['!ref'] ?? null
  const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date | null>>(params.sheet, {
    header: 1,
    blankrows: false,
    raw: false,
  })

  if (rows.length === 0) {
    return [{
      sheetName: params.sheetName,
      sheetRange,
      rowStart: null,
      rowEnd: null,
      text: '(내용 없음)',
    }]
  }

  const headerRows = rows
    .slice(0, PAYROLL_CHUNK_HEADER_ROWS)
    .map((row, index) => renderExcelRow(row, index, PAYROLL_MAX_COLS_PER_ROW))
  const chunks: PendingExcelChunk[] = []
  let rowIndex = 0

  while (rowIndex < rows.length) {
    const rowStartIndex = rowIndex
    const lines: string[] = []

    if (rowStartIndex > 0 && headerRows.length > 0) {
      lines.push('[상단 기준행]')
      lines.push(...headerRows)
      lines.push('[chunk 행]')
    }

    while (rowIndex < rows.length && rowIndex - rowStartIndex < PAYROLL_CHUNK_MAX_ROWS_PER_CHUNK) {
      const renderedRow = renderExcelRow(rows[rowIndex], rowIndex, PAYROLL_MAX_COLS_PER_ROW)
      const nextLength = lines.join('\n').length + renderedRow.length + 1
      if (lines.length > 0 && nextLength > PAYROLL_CHUNK_MAX_TEXT_CHARS - 700) {
        break
      }
      lines.push(renderedRow)
      rowIndex += 1
    }

    if (rowIndex === rowStartIndex) {
      lines.push(renderExcelRow(rows[rowIndex], rowIndex, PAYROLL_MAX_COLS_PER_ROW))
      rowIndex += 1
    }

    chunks.push({
      sheetName: params.sheetName,
      sheetRange,
      rowStart: rowStartIndex + 1,
      rowEnd: rowIndex,
      text: lines.join('\n'),
    })
  }

  return chunks
}

function extractPayrollExcelTextChunks(
  fileBuffer: ArrayBuffer,
  originalFilename: string,
): ExtractedTextChunk[] {
  if (isPasswordProtectedExcel(fileBuffer)) {
    return [{
      text: null,
      summary: describeExcelAccessFailure('password_required'),
      failureReason: 'password_required',
    }]
  }

  try {
    const workbook = XLSX.read(Buffer.from(fileBuffer), {
      type: 'buffer',
      cellDates: true,
    })

    const sheetNames = workbook.SheetNames.slice(0, PAYROLL_CHUNK_MAX_SHEETS)
    const pendingChunks = sheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      return buildPayrollSheetChunks({
        sheetName,
        sheet,
      })
    })

    const omittedSheetCount = workbook.SheetNames.length - sheetNames.length
    if (omittedSheetCount > 0) {
      pendingChunks.push({
        sheetName: '추출 제외 sheet',
        sheetRange: null,
        rowStart: null,
        rowEnd: null,
        text: `[경고] sheet가 ${workbook.SheetNames.length.toLocaleString('ko-KR')}개라서 앞의 ${PAYROLL_CHUNK_MAX_SHEETS.toLocaleString('ko-KR')}개만 chunk 추출했습니다. 제외된 sheet 수: ${omittedSheetCount.toLocaleString('ko-KR')}개`,
      })
    }

    const chunkTotal = pendingChunks.length
    return pendingChunks.map((chunk, index) => {
      const chunkIndex = index + 1
      const text = buildPayrollChunkText({
        originalFilename,
        sheetCount: workbook.SheetNames.length,
        sheetName: chunk.sheetName,
        sheetRange: chunk.sheetRange,
        rowStart: chunk.rowStart,
        rowEnd: chunk.rowEnd,
        chunkIndex,
        chunkTotal,
        body: chunk.text,
      })

      return {
        text,
        summary: `Excel payroll chunk 추출 성공 (${chunkIndex}/${chunkTotal}, ${chunk.sheetName}${chunk.rowStart && chunk.rowEnd ? ` ${chunk.rowStart}-${chunk.rowEnd}행` : ''}, ${text.length.toLocaleString('ko-KR')}자)`,
        chunkIndex,
        chunkTotal,
        sheetName: chunk.sheetName,
        rowStart: chunk.rowStart ?? undefined,
        rowEnd: chunk.rowEnd ?? undefined,
      }
    })
  } catch (err) {
    const failureReason = classifyExcelReadFailure({ buffer: fileBuffer, error: err })
    if (failureReason === 'password_required') {
      return [{
        text: null,
        summary: describeExcelAccessFailure('password_required'),
        failureReason,
      }]
    }
    return [{
      text: null,
      summary: `Excel payroll chunk 추출 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
      failureReason,
    }]
  }
}

function buildReviewChunkText(params: {
  originalFilename: string
  sheetCount: number
  sheetName: string
  sheetRange: string | null
  rowStart: number | null
  rowEnd: number | null
  chunkIndex: number
  chunkTotal: number
  body: string
}): string {
  const rowRange = params.rowStart && params.rowEnd
    ? `${params.rowStart}-${params.rowEnd}`
    : '내용 없음'

  return truncateText(normalizeText([
    `파일명: ${params.originalFilename}`,
    `시트 수: ${params.sheetCount}`,
    '추출 프로필: review-chunked',
    `chunk: ${params.chunkIndex}/${params.chunkTotal}`,
    `## 시트: ${params.sheetName}`,
    `범위: ${params.sheetRange ?? '알 수 없음'}`,
    `행 범위: ${rowRange}`,
    params.body || '(내용 없음)',
  ].join('\n')), REVIEW_CHUNK_MAX_TEXT_CHARS)
}

function buildReviewSheetChunks(params: {
  sheetName: string
  sheet: XLSX.WorkSheet
}): PendingExcelChunk[] {
  const sheetRange = typeof params.sheet['!fullref'] === 'string'
    ? params.sheet['!fullref']
    : params.sheet['!ref'] ?? null
  const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date | null>>(params.sheet, {
    header: 1,
    blankrows: false,
    raw: false,
  })

  if (rows.length === 0) {
    return [{
      sheetName: params.sheetName,
      sheetRange,
      rowStart: null,
      rowEnd: null,
      text: '(내용 없음)',
    }]
  }

  const headerRows = rows
    .slice(0, REVIEW_CHUNK_HEADER_ROWS)
    .map((row, index) => renderExcelRow(row, index, MAX_COLS_PER_ROW))
  const chunks: PendingExcelChunk[] = []
  let rowIndex = 0

  while (rowIndex < rows.length) {
    const rowStartIndex = rowIndex
    const lines: string[] = []

    if (rowStartIndex > 0 && headerRows.length > 0) {
      lines.push('[상단 기준행]')
      lines.push(...headerRows)
      lines.push('[chunk 행]')
    }

    while (rowIndex < rows.length && rowIndex - rowStartIndex < REVIEW_CHUNK_MAX_ROWS_PER_CHUNK) {
      const renderedRow = renderExcelRow(rows[rowIndex], rowIndex, MAX_COLS_PER_ROW)
      const nextLength = lines.join('\n').length + renderedRow.length + 1
      if (lines.length > 0 && nextLength > REVIEW_CHUNK_MAX_TEXT_CHARS - 700) {
        break
      }
      lines.push(renderedRow)
      rowIndex += 1
    }

    if (rowIndex === rowStartIndex) {
      lines.push(renderExcelRow(rows[rowIndex], rowIndex, MAX_COLS_PER_ROW))
      rowIndex += 1
    }

    chunks.push({
      sheetName: params.sheetName,
      sheetRange,
      rowStart: rowStartIndex + 1,
      rowEnd: rowIndex,
      text: lines.join('\n'),
    })
  }

  return chunks
}

// review(자료검토) adaptive structuring 엔진이 시트별 sheetName/rowStart/rowEnd 메타데이터를
// 읽을 수 있도록 payroll과 같은 chunk 경로를 쓴다. 'default' profile은 전체 시트를 한
// chunk로 합쳐서 sheetName을 채우지 않으므로 엔진의 워크북 시그니처 매칭이 항상 실패한다.
function extractReviewExcelTextChunks(
  fileBuffer: ArrayBuffer,
  originalFilename: string,
): ExtractedTextChunk[] {
  if (isPasswordProtectedExcel(fileBuffer)) {
    return [{
      text: null,
      summary: describeExcelAccessFailure('password_required'),
      failureReason: 'password_required',
    }]
  }

  try {
    const workbook = XLSX.read(Buffer.from(fileBuffer), {
      type: 'buffer',
      cellDates: true,
    })

    const sheetNames = workbook.SheetNames.slice(0, REVIEW_CHUNK_MAX_SHEETS)
    const pendingChunks = sheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      return buildReviewSheetChunks({
        sheetName,
        sheet,
      })
    })

    const omittedSheetCount = workbook.SheetNames.length - sheetNames.length
    if (omittedSheetCount > 0) {
      pendingChunks.push({
        sheetName: '추출 제외 sheet',
        sheetRange: null,
        rowStart: null,
        rowEnd: null,
        text: `[경고] sheet가 ${workbook.SheetNames.length.toLocaleString('ko-KR')}개라서 앞의 ${REVIEW_CHUNK_MAX_SHEETS.toLocaleString('ko-KR')}개만 chunk 추출했습니다. 제외된 sheet 수: ${omittedSheetCount.toLocaleString('ko-KR')}개`,
      })
    }

    const chunkTotal = pendingChunks.length
    return pendingChunks.map((chunk, index) => {
      const chunkIndex = index + 1
      const text = buildReviewChunkText({
        originalFilename,
        sheetCount: workbook.SheetNames.length,
        sheetName: chunk.sheetName,
        sheetRange: chunk.sheetRange,
        rowStart: chunk.rowStart,
        rowEnd: chunk.rowEnd,
        chunkIndex,
        chunkTotal,
        body: chunk.text,
      })

      return {
        text,
        summary: `Excel review chunk 추출 성공 (${chunkIndex}/${chunkTotal}, ${chunk.sheetName}${chunk.rowStart && chunk.rowEnd ? ` ${chunk.rowStart}-${chunk.rowEnd}행` : ''}, ${text.length.toLocaleString('ko-KR')}자)`,
        chunkIndex,
        chunkTotal,
        sheetName: chunk.sheetName,
        rowStart: chunk.rowStart ?? undefined,
        rowEnd: chunk.rowEnd ?? undefined,
      }
    })
  } catch (err) {
    const failureReason = classifyExcelReadFailure({ buffer: fileBuffer, error: err })
    if (failureReason === 'password_required') {
      return [{
        text: null,
        summary: describeExcelAccessFailure('password_required'),
        failureReason,
      }]
    }
    return [{
      text: null,
      summary: `Excel review chunk 추출 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
      failureReason,
    }]
  }
}
