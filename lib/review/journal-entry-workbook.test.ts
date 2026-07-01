import { describe, expect, it } from 'vitest'
import { buildJournalEntryWorkbookSource, looksLikeJournalEntryWorkbook } from './journal-entry-workbook'

describe('looksLikeJournalEntryWorkbook', () => {
  it('detects internal ledger workbooks with inflow and outflow columns', () => {
    const source = buildJournalEntryWorkbookSource({
      originalFilename: '2026.일월육일 지출결의서.xlsx',
      detectedFileType: '지출결의서 형식 장부',
      explanation: '시트에 일자, 적요, 입금, 출금, 잔액, 차용, 급여 항목이 정리되어 있습니다.',
      riskFlags: [],
    })

    expect(looksLikeJournalEntryWorkbook(source)).toBe(true)
  })

  it('treats 입출금 wording as both inflow and outflow ledger evidence', () => {
    const source = buildJournalEntryWorkbookSource({
      originalFilename: '2026.일월육일 지출결의서.xlsx',
      detectedFileType: '지출결의서',
      explanation: '입출금 내역이 모두 포함되어 있어 귀속·전표 단계에서 검토할 수 있습니다.',
      riskFlags: [],
    })

    expect(looksLikeJournalEntryWorkbook(source)).toBe(true)
  })

  it('does not classify bank exports as journal entry workbooks', () => {
    const source = buildJournalEntryWorkbookSource({
      originalFilename: '2026.01~03.기업은행.xls',
      detectedFileType: '은행 거래내역',
      explanation: '기업은행 통장 거래내역 조회 결과입니다.',
      riskFlags: [],
    })

    expect(looksLikeJournalEntryWorkbook(source)).toBe(false)
  })

  it('does not classify structured expense approvals without inflow columns as journal entry workbooks', () => {
    const source = buildJournalEntryWorkbookSource({
      originalFilename: '2026.지출결의서.xlsx',
      detectedFileType: '지출결의서',
      explanation: '상호, 내용, 계정, 지출금액, 집행일자, 결재방법 컬럼으로 지출결의서가 정리되어 있습니다.',
      riskFlags: [],
    })

    expect(looksLikeJournalEntryWorkbook(source)).toBe(false)
  })

  it('does not classify expense-only summaries without ledger signals', () => {
    const source = buildJournalEntryWorkbookSource({
      originalFilename: '2026.지출결의서.xlsx',
      detectedFileType: '월별 지출 집계',
      explanation: '월별 지출금액 합계만 정리된 요약표입니다.',
      riskFlags: [],
    })

    expect(looksLikeJournalEntryWorkbook(source)).toBe(false)
  })
})
