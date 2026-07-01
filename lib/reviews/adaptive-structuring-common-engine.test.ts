import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { extractDocumentTextChunks } from '@/lib/ai/extract'
import type { ReviewAdaptiveSourceText } from '@/lib/ai/review-adaptive-structuring-propose'
import { runReviewAdaptiveCommonEngine } from './adaptive-structuring-common-engine'
import type { ReviewAdaptiveModelContract } from './adaptive-structuring-model-contract'

function baseContract(overrides: Partial<ReviewAdaptiveModelContract> = {}): ReviewAdaptiveModelContract {
  return {
    targetWorkflow: 'bookkeeping',
    reviewModelType: 'transaction_detail',
    workbookSignature: {
      sheetNamePatterns: ['Sheet1'],
      requiredHeaderLabels: ['거래일자', '금액'],
      optionalHeaderLabels: ['거래처'],
      headerRowCandidates: [],
    },
    fieldMappings: [
      { sheetName: 'Sheet1', sourceColumn: '거래일자', targetField: 'transactionDate', required: true, dataType: 'date' },
      { sheetName: 'Sheet1', sourceColumn: '거래처', targetField: 'counterparty', required: false, dataType: 'text' },
      { sheetName: 'Sheet1', sourceColumn: '금액', targetField: 'amountKrw', required: false, dataType: 'amount' },
    ],
    ignoredRegions: [],
    validationRules: [],
    outputMode: 'preview_only',
    ...overrides,
  }
}

function fileTextsWith(text: string, sheetName = 'Sheet1'): ReviewAdaptiveSourceText[] {
  return [{ filename: 'workbook.xlsx', sheetName, text, summary: null }]
}

describe('runReviewAdaptiveCommonEngine', () => {
  it('extracts normalized preview rows from an unknown but valid single-row-header workbook', () => {
    const fileTexts = fileTextsWith([
      '1: 거래일자 | 거래처 | 금액',
      '2: 2026-06-05 | 거래처A | 320,000',
    ].join('\n'))

    const result = runReviewAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(true)
    expect(result.standardRows).toHaveLength(1)
    expect(result.standardRows[0]?.values).toMatchObject({
      transactionDate: '2026-06-05',
      counterparty: '거래처A',
      amountKrw: 320000,
    })
  })

  it('fails closed with no rows when the workbook signature does not match (similar but different workbook)', () => {
    const fileTexts = fileTextsWith([
      '1: 품목 | 단가',
      '2: 노트북 | 1,200,000',
    ].join('\n'), 'Sheet2')

    const result = runReviewAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(false)
    expect(result.standardRows).toEqual([])
    expect(result.blockers.length).toBeGreaterThan(0)
  })

  it('returns a precise blocker when the sheet matches but required headers are missing', () => {
    const fileTexts = fileTextsWith([
      '1: 품목 | 단가',
      '2: 노트북 | 1,200,000',
    ].join('\n'))

    const result = runReviewAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(false)
    expect(result.blockers[0]).toContain('필수 헤더')
  })

  it('fails closed on a two-row merged header instead of misreading it', () => {
    const fileTexts = fileTextsWith([
      '1: 거래일자 | | 지급내역 |',
      '2:  | 거래처 | 금액 |',
      '3: 2026-06-05 | 거래처A | 320,000 |',
    ].join('\n'))

    const result = runReviewAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(false)
    expect(result.blockers[0]).toContain('병합 헤더')
  })

  it('excludes a row missing a transaction date instead of producing an unsafe draft row', () => {
    const fileTexts = fileTextsWith([
      '1: 거래일자 | 거래처 | 금액',
      '2:  | 거래처A | 320,000',
      '3: 2026-06-05 | 거래처B | 150,000',
    ].join('\n'))

    const result = runReviewAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(true)
    expect(result.standardRows).toHaveLength(1)
    expect(result.standardRows[0]?.values.counterparty).toBe('거래처B')
    expect(result.blockedRowCount).toBe(1)
  })

  it('excludes a row missing an amount instead of producing an unsafe draft row', () => {
    const fileTexts = fileTextsWith([
      '1: 거래일자 | 거래처 | 금액',
      '2: 2026-06-05 | 거래처A | ',
      '3: 2026-06-06 | 거래처B | 150,000',
    ].join('\n'))

    const result = runReviewAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(true)
    expect(result.standardRows).toHaveLength(1)
    expect(result.standardRows[0]?.values.counterparty).toBe('거래처B')
    expect(result.blockedRowCount).toBe(1)
  })

  it('distinguishes an explicit zero amount from a blank amount', () => {
    const fileTexts = fileTextsWith([
      '1: 거래일자 | 거래처 | 금액',
      '2: 2026-06-05 | 거래처A | 0',
    ].join('\n'))

    const result = runReviewAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.standardRows).toHaveLength(1)
    expect(result.standardRows[0]?.values.amountKrw).toBe(0)
  })

  it('masks resident-number/phone/account-number-shaped values in standardRows before returning them', () => {
    const contract = baseContract({
      fieldMappings: [
        { sheetName: 'Sheet1', sourceColumn: '거래일자', targetField: 'transactionDate', required: true, dataType: 'date' },
        { sheetName: 'Sheet1', sourceColumn: '금액', targetField: 'amountKrw', required: false, dataType: 'amount' },
        { sheetName: 'Sheet1', sourceColumn: '비고', targetField: 'memo', required: false, dataType: 'memo' },
      ],
    })
    const fileTexts = fileTextsWith([
      '1: 거래일자 | 금액 | 비고',
      '2: 2026-06-05 | 320,000 | 901231-1234567',
    ].join('\n'))

    const result = runReviewAdaptiveCommonEngine(contract, fileTexts)

    expect(result.standardRows[0]?.values.amountKrw).toBe(320000)
    expect(result.standardRows[0]?.values.memo).toBe('[마스킹됨]')
  })

  it('ignores result-only/footer rows matched by an ignored region rule', () => {
    const fileTexts = fileTextsWith([
      '1: 거래일자 | 거래처 | 금액',
      '2: 2026-06-05 | 거래처A | 320,000',
      '3: 합계 | 합계 | 320,000',
    ].join('\n'))

    const contract = baseContract({
      ignoredRegions: [{ sheetName: 'Sheet1', sourceColumnOrRegion: '합계', reason: 'footer_or_total' }],
    })

    const result = runReviewAdaptiveCommonEngine(contract, fileTexts)

    expect(result.standardRows).toHaveLength(1)
    expect(result.standardRows[0]?.values.counterparty).toBe('거래처A')
  })

  // P1 regression guard: the unit tests above hand-build fileTexts with sheetName set
  // directly, which masked a real bug — extractDocumentTextChunks under the 'default'
  // profile never sets chunk.sheetName, so matchReviewAdaptiveWorkbookSignature always
  // saw zero candidate sheets for real uploads. This test goes through the actual
  // extraction pipeline (no manual sheetName) the same way the route does, with the
  // 'review' profile that was added to fix it.
  it('matches a real extracted Excel workbook end-to-end through the review chunk profile', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['거래일자', '거래처', '금액'],
      ['2026-06-05', '거래처A', 320000],
      ['2026-06-06', '거래처B', 150000],
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
    const workbookBytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const buffer = workbookBytes.buffer.slice(
      workbookBytes.byteOffset,
      workbookBytes.byteOffset + workbookBytes.byteLength,
    ) as ArrayBuffer

    const chunks = await extractDocumentTextChunks({
      fileBuffer: buffer,
      fileType: 'excel',
      originalFilename: '정산목록.xlsx',
      profile: 'review',
    })
    const fileTexts: ReviewAdaptiveSourceText[] = chunks.map((chunk) => ({
      filename: '정산목록.xlsx',
      text: chunk.text,
      summary: chunk.summary,
      sheetName: chunk.sheetName,
      rowStart: chunk.rowStart,
      rowEnd: chunk.rowEnd,
    }))

    const result = runReviewAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(true)
    expect(result.standardRows).toHaveLength(2)
    expect(result.standardRows[0]?.values.counterparty).toBe('거래처A')
  })
})
