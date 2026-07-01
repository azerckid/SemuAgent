import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { extractDocumentText, extractDocumentTextChunks } from './extract'

function workbookBuffer(rowsBySheet: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new()
  for (const [sheetName, rows] of Object.entries(rowsBySheet)) {
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  }
  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function payrollRows(sheetName: string, count: number) {
  return [
    ['사원코드', '성명', '부서', '직급', '기본급', '연차수당', '충당액', '비고'],
    ...Array.from({ length: count }, (_, index) => {
      const rowNumber = index + 1
      return [
        `PAY-${String(rowNumber).padStart(3, '0')}`,
        `${sheetName}-직원-${rowNumber}`,
        '운영지원팀',
        '매니저',
        3000000 + rowNumber,
        100000 + rowNumber,
        50000 + rowNumber,
        `${sheetName} 다중 시트 급여 테스트 행 ${rowNumber} `.repeat(3),
      ]
    }),
  ]
}

describe('extractDocumentText', () => {
  it('keeps all payroll workbook sheet sections within the payroll extraction profile', async () => {
    const buffer = workbookBuffer({
      기초자료: payrollRows('기초자료', 120),
      연차수당: payrollRows('연차수당', 120),
      초년도연차: payrollRows('초년도연차', 120),
      병역사항: payrollRows('병역사항', 120),
      충당액: payrollRows('충당액', 120),
      지급대장: payrollRows('지급대장', 120),
    })

    const result = await extractDocumentText({
      fileBuffer: buffer,
      fileType: 'excel',
      originalFilename: '급여관련테스트자료.xlsx',
      profile: 'payroll',
    })

    expect(result.summary).toContain('Excel 시트 추출 성공 (6/6개 시트')
    expect(result.text).toContain('추출 프로필: payroll')
    expect(result.text).toContain('## 시트: 기초자료')
    expect(result.text).toContain('## 시트: 충당액')
    expect(result.text).toContain('## 시트: 지급대장')
    expect(result.text).toContain('지급대장-직원-20')
  })

  it('balances oversized payroll workbooks so later sheet names are still visible', async () => {
    const rowsBySheet = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => {
        const sheetName = `급여시트${index + 1}`
        return [sheetName, payrollRows(sheetName, 200)]
      }),
    )
    const buffer = workbookBuffer(rowsBySheet)

    const result = await extractDocumentText({
      fileBuffer: buffer,
      fileType: 'excel',
      originalFilename: '대용량급여자료.xlsx',
      profile: 'payroll',
    })

    expect(result.text).toContain('## 시트: 급여시트1')
    expect(result.text).toContain('## 시트: 급여시트10')
    expect(result.text).toContain('[이하 생략: 이 시트 텍스트가 길어 앞부분만 전달됨]')
  })

  it('creates payroll row chunks that include later rows from long sheets', async () => {
    const buffer = workbookBuffer({
      지급대장: payrollRows('지급대장', 280),
    })

    const chunks = await extractDocumentTextChunks({
      fileBuffer: buffer,
      fileType: 'excel',
      originalFilename: '긴급여자료.xlsx',
      profile: 'payroll',
    })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.some((chunk) => chunk.text?.includes('지급대장-직원-250'))).toBe(true)
    expect(chunks.every((chunk) => chunk.text?.includes('추출 프로필: payroll-chunked'))).toBe(true)
  })

  it('creates payroll chunks for sheets beyond the single-prompt sheet profile', async () => {
    const rowsBySheet = Object.fromEntries(
      Array.from({ length: 14 }, (_, index) => {
        const sheetName = `급여시트${index + 1}`
        return [sheetName, payrollRows(sheetName, 5)]
      }),
    )
    const buffer = workbookBuffer(rowsBySheet)

    const chunks = await extractDocumentTextChunks({
      fileBuffer: buffer,
      fileType: 'excel',
      originalFilename: '다중시트급여자료.xlsx',
      profile: 'payroll',
    })

    expect(chunks.some((chunk) => chunk.text?.includes('## 시트: 급여시트14'))).toBe(true)
  })
})

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

function utf16LeAscii(value: string): number[] {
  const bytes: number[] = []
  for (const char of value) {
    bytes.push(char.charCodeAt(0) & 0xff, 0x00)
  }
  return bytes
}

/** 암호화 OOXML을 흉내 낸 최소 버퍼 (CFB + EncryptedPackage 마커). */
function encryptedExcelBuffer(): ArrayBuffer {
  return new Uint8Array([
    ...CFB_SIGNATURE,
    ...new Array(40).fill(0x00),
    ...utf16LeAscii('EncryptedPackage'),
    ...new Array(16).fill(0x00),
  ]).buffer
}

describe('extractDocumentText - password and failure classification', () => {
  it('extracts a normal Excel without a failure reason', async () => {
    const buffer = workbookBuffer({ 거래내역: payrollRows('거래내역', 5) })

    const result = await extractDocumentText({
      fileBuffer: buffer,
      fileType: 'excel',
      originalFilename: '정상자료.xlsx',
    })

    expect(result.failureReason).toBeUndefined()
    expect(result.text).toContain('## 시트: 거래내역')
  })

  it('flags a password-protected Excel as password_required, not generic failure', async () => {
    const result = await extractDocumentText({
      fileBuffer: encryptedExcelBuffer(),
      fileType: 'excel',
      originalFilename: '비밀번호자료.xlsx',
    })

    expect(result.failureReason).toBe('password_required')
    expect(result.text).toBeNull()
    expect(result.summary).toContain('비밀번호')
  })

  it('classifies a corrupted Excel as parse_failed', async () => {
    const corrupted = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05])
      .buffer

    const result = await extractDocumentText({
      fileBuffer: corrupted,
      fileType: 'excel',
      originalFilename: '손상자료.xlsx',
    })

    expect(result.failureReason).toBe('parse_failed')
    expect(result.text).toBeNull()
  })

  it('flags a password-protected payroll workbook in the chunk path', async () => {
    const chunks = await extractDocumentTextChunks({
      fileBuffer: encryptedExcelBuffer(),
      fileType: 'excel',
      originalFilename: '비밀번호급여.xlsx',
      profile: 'payroll',
    })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.failureReason).toBe('password_required')
  })
})

describe('extractDocumentTextChunks - sheet-chunk metadata by profile', () => {
  it('does NOT set chunk.sheetName under the default profile, even though the combined text mentions the sheet name', async () => {
    const buffer = workbookBuffer({ 거래내역: payrollRows('거래내역', 5) })

    const chunks = await extractDocumentTextChunks({
      fileBuffer: buffer,
      fileType: 'excel',
      originalFilename: '정산목록.xlsx',
      // profile omitted on purpose: this is the bug class a Slice 3 PR regressed on —
      // the rendered text contains '## 시트: 거래내역' but chunk.sheetName stays undefined,
      // so any engine that filters on chunk.sheetName silently sees zero candidate sheets.
    })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toContain('## 시트: 거래내역')
    expect(chunks[0]?.sheetName).toBeUndefined()
  })

  it('sets chunk.sheetName/rowStart/rowEnd per sheet under the review profile', async () => {
    const buffer = workbookBuffer({
      거래내역: payrollRows('거래내역', 5),
      참고자료: payrollRows('참고자료', 3),
    })

    const chunks = await extractDocumentTextChunks({
      fileBuffer: buffer,
      fileType: 'excel',
      originalFilename: '정산목록.xlsx',
      profile: 'review',
    })

    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks.every((chunk) => Boolean(chunk.sheetName))).toBe(true)
    expect(chunks.some((chunk) => chunk.sheetName === '거래내역')).toBe(true)
    expect(chunks.some((chunk) => chunk.sheetName === '참고자료')).toBe(true)
    expect(chunks.every((chunk) => chunk.text?.includes('추출 프로필: review-chunked'))).toBe(true)
  })

  it('creates review row chunks that include later rows from long sheets', async () => {
    const buffer = workbookBuffer({ 거래내역: payrollRows('거래내역', 200) })

    const chunks = await extractDocumentTextChunks({
      fileBuffer: buffer,
      fileType: 'excel',
      originalFilename: '긴거래내역.xlsx',
      profile: 'review',
    })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.some((chunk) => chunk.text?.includes('거래내역-직원-180'))).toBe(true)
  })

  it('flags a password-protected workbook in the review chunk path', async () => {
    const chunks = await extractDocumentTextChunks({
      fileBuffer: encryptedExcelBuffer(),
      fileType: 'excel',
      originalFilename: '비밀번호자료.xlsx',
      profile: 'review',
    })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.failureReason).toBe('password_required')
  })
})
