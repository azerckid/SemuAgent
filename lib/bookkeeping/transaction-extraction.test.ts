import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  extractTransactionCandidates,
  inspectBookkeepingFileForTransactions,
} from './transaction-extraction'

function workbookBuffer(rowsBySheet: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new()
  for (const [sheetName, rows] of Object.entries(rowsBySheet)) {
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  }
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

describe('extractTransactionCandidates', () => {
  it('keeps dated KCP rows and skips currency summary rows', () => {
    const buffer = workbookBuffer({
      '5월': [
        ['사이트명', '사이트코드', '마감일자', '정산일자', '정산예상금액', '신용카드'],
        ['(주)디와이인터내셔널', 'GKB9S', '2026.05.01', '2026.05.11', '896,889', '896,889'],
        ['(주)디와이인터내셔널', 'GKB9S', '2026.05.03', '2026.05.11', '287,526', '287,526'],
        ['', '', '원화 합계', '', '12,811,925', '12,771,981'],
        ['', '', '달러 합계', '', '0.00', '0.00'],
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-kcp',
        originalFilename: 'KCP-4~6월.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates).toHaveLength(2)
    expect(candidates.map((candidate) => candidate.transactionDate)).toEqual(['2026-05-01', '2026-05-03'])
    expect(candidates.map((candidate) => candidate.amountKrw)).toEqual([896889, 287526])
    expect(candidates[0]?.description).toContain('5월 시트 2행')
    expect(candidates.map((candidate) => candidate.description).join('\n')).not.toContain('원화 합계')
  })

  it('uses KCP amount headers instead of trailing zero columns', () => {
    const buffer = workbookBuffer({
      '4월': [
        ['사이트명', '사이트코드', '마감일자', '정산일자', '정산예상금액', '신용카드', '계좌이체', '가상계좌'],
        ['(주)디와이인터내셔널', 'GKB9S', '2026.04.01', '2026.04.13', '677,625', '677,625', '0', '0'],
        ['(주)디와이인터내셔널', 'GKB9S', '2026.04.02', '2026.04.13', '72,802', '72,802', '0', '0'],
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-kcp-trailing-zero',
        originalFilename: 'KCP-4~6월.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates).toHaveLength(2)
    expect(candidates.map((candidate) => candidate.transactionDate)).toEqual(['2026-04-01', '2026-04-02'])
    expect(candidates.map((candidate) => candidate.amountKrw)).toEqual([677625, 72802])
  })

  it('keeps dated bank rows and skips bank total-count summary rows', () => {
    const buffer = workbookBuffer({
      '4월': [
        ['번호', '거래일시', '구분', '내용', '출금', '입금'],
        ['1', '2026.04.01 10:55:01', '모바일', '박현정', '0', '610,500'],
        ['2', '2026.04.01 14:14:45', '인터넷', '선진바이오(주)', '0', '696,190'],
        ['총 53건', '37,246,370원', '41,468,183원', '0', '0'],
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-bank',
        originalFilename: '우리은행 거래내역조회(102)-4~6월.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates).toHaveLength(2)
    expect(candidates.map((candidate) => candidate.transactionDate)).toEqual(['2026-04-01', '2026-04-01'])
    expect(candidates.map((candidate) => candidate.amountKrw)).toEqual([610500, 696190])
    expect(candidates.map((candidate) => candidate.direction)).toEqual(['income', 'income'])
    expect(candidates[0]?.description).toContain('4월 시트 2행')
    expect(candidates.map((candidate) => candidate.description).join('\n')).not.toContain('총 53건')
  })

  it('uses deposit and withdrawal headers to preserve bank transaction direction', () => {
    const buffer = workbookBuffer({
      '과거거래내역조회20250327': [
        ['과거거래내역조회'],
        ['No', '거래일시', '적요', '의뢰인/수취인', '입금', '출금', '잔액', '구분', '거래점'],
        ['207', '2024-07-24 16:10', '김기동(세무사김기동', '김기동(세무사김기동', '0', '720,500', '6,943', '타행송금', '을지로6가'],
        ['210', '2024-07-31 19:43', '신영화', '신영화', '865,750', '0', '1,022,193', '대체', '대외기관0026'],
        ['212', '2024-07-31 20:31', 'LGU+신영화', null, '0', '65,750', '5,943', '대체', '을지로6가'],
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-hana-bank',
        originalFilename: '하나은행2024.01.01-12.31.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates.map((candidate) => ({
      merchantName: candidate.merchantName,
      amountKrw: candidate.amountKrw,
      direction: candidate.direction,
    }))).toEqual([
      { merchantName: '김기동(세무사김기동', amountKrw: 720500, direction: 'expense' },
      { merchantName: '신영화', amountKrw: 865750, direction: 'income' },
      { merchantName: 'LGU+신영화', amountKrw: 65750, direction: 'expense' },
    ])
  })

  it('extracts expense approval rows as supporting transaction evidence', () => {
    const buffer = workbookBuffer({
      '26.1': [
        ['상호', '내용', '계정', '지출금액', '집행일자', '결재방법', '비고'],
        ['일월육일', '직원중식', '복리후생비', '78,000', '2026-01-06', '체크카드', '점심 식대'],
        ['기업은행', '인터넷뱅킹 수수료', '지급수수료', '500', '2026-01-06', '계좌이체', '송금수수료'],
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-expense-approval',
        originalFilename: '2026.지출결의서.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates).toHaveLength(2)
    expect(candidates.map((candidate) => candidate.sourceType)).toEqual(['other', 'other'])
    expect(candidates.map((candidate) => candidate.transactionDate)).toEqual(['2026-01-06', '2026-01-06'])
    expect(candidates.map((candidate) => candidate.direction)).toEqual(['expense', 'expense'])
    expect(candidates.map((candidate) => candidate.merchantName)).toEqual(['일월육일', '기업은행'])
    expect(candidates.map((candidate) => candidate.amountKrw)).toEqual([78000, 500])
    expect(candidates[0]?.description).toContain('계정: 복리후생비')
    expect(candidates[1]?.description).toContain('결재방법: 계좌이체')
  })

  it('does not treat bank transaction rows containing receipt words as new headers', () => {
    const buffer = workbookBuffer({
      '4월': [
        ['거래내역조회_입출식 예금'],
        ['계좌번호:524-037413-01-019 조회기준일:2026년 05월 04일 현재잔액:19,592,986원 조회시작일자:2026-04-01 조회종료일자:2026-04-30'],
        ['', '거래일시', '출금', '입금', '거래후 잔액', '거래내용', '상대은행', '거래구분', '수표어음금액'],
        ['1', '2026-04-01 03:41:30', '0', '2,561,569', '6,844,569', 'Npay정산', 'SC은행', '타행이체', '0'],
        ['2', '2026-04-01 11:49:12', '0', '440,000', '7,284,569', '주식회사디와이씨', '기업은행', '무통장입금', '0'],
        ['3', '2026-04-01 12:38:09', '0', '275,000', '7,559,569', '(주)오미풀', '기업은행', '현금영수증', '0'],
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-bank-receipt-words',
        originalFilename: '기업은행 거래내역조회-4~6월.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates).toHaveLength(3)
    expect(candidates.map((candidate) => candidate.amountKrw)).toEqual([2561569, 440000, 275000])
    expect(candidates.map((candidate) => candidate.transactionDate)).toEqual(['2026-04-01', '2026-04-01', '2026-04-01'])
  })

  it('does not treat decimal amounts as dates', () => {
    const buffer = workbookBuffer({
      '4월': [
        ['구분', '내용', '출금', '입금'],
        ['달러 합계', '정산 합계', '0.00', '0.00'],
        ['정상 거래', '2026.04.03', '0', '407,000'],
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-decimal',
        originalFilename: '기업은행 거래내역조회-4~6월.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.transactionDate).toBe('2026-04-03')
    expect(candidates[0]?.description).not.toContain('0.00')
  })

  it('skips repeated currency summary rows from merged spreadsheet labels', () => {
    const buffer = workbookBuffer({
      '4월': [
        ['사이트명', '사이트코드', '마감일자', '정산일자', '정산예상금액', '신용카드'],
        ['(주)디와이인터내셔널', 'GKB9S', '2026.04.01', '2026.04.13', '677,625', '677,625'],
        ['원화 합계', '원화 합계', '원화 합계', '원화 합계', '27,550,123', '27,298,563'],
        ['달러 합계', '달러 합계', '달러 합계', '달러 합계', '0.00', '0.00'],
        ['엔화 합계', '엔화 합계', '엔화 합계', '엔화 합계', '0', '0'],
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-kcp-merged-summary',
        originalFilename: 'KCP-4~6월.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.transactionDate).toBe('2026-04-01')
    expect(candidates.map((candidate) => candidate.description).join('\n')).not.toContain('합계')
  })

  it('flags monthly VAT summary files as unsuitable even when filename looks like Naver Pay', () => {
    const buffer = workbookBuffer({
      '4월': [
        [
          '부가세 신고기간',
          '과세매출금액',
          '면세매출금액',
          '신용카드 매출전표',
          '현금영수증(소득공제)',
          '현금영수증(지출증빙)',
          '현금영수증(발행 제외)',
          '기타',
        ],
        ['2026.04', '40,281,820', '-', '32,815,261', '401,964', '5,897,840', '-', '1,166,755'],
      ],
      '5월': [
        [
          '부가세 신고기간',
          '과세매출금액',
          '면세매출금액',
          '신용카드 매출전표',
          '현금영수증(소득공제)',
          '현금영수증(지출증빙)',
          '현금영수증(발행 제외)',
          '기타',
        ],
        ['2026.05', '17,913,088', '0', '15,065,449', '304,537', '2,388,897', '0', '154,205'],
      ],
    })

    const file = {
      id: 'file-naverpay-summary',
      originalFilename: '네이버페이-4~6월.xlsx',
      fileType: 'excel',
    }

    const candidates = extractTransactionCandidates({ file, buffer })
    const inspection = inspectBookkeepingFileForTransactions({ file, buffer })

    expect(candidates).toHaveLength(0)
    expect(inspection).toMatchObject({
      usableForTransactionWorkpapers: false,
      documentKind: 'monthly_vat_summary',
      candidateCount: 0,
    })
    expect(inspection.reason).toContain('월별 매출 집계표')
  })

  it('recognizes enterprise bank rows after descriptive workbook header rows', () => {
    const buffer = workbookBuffer({
      '4월': [
        ['거래내역조회'],
        ['예금주명: 테스트회사'],
        ['계좌번호: 000-000000-00-000 조회시작일자:2026-04-01 조회종료일자:2026-04-30'],
        ['', '거래일시', '출금', '입금', '거래후 잔액', '거래내용', '상대은행'],
        ['1', '2026-04-01 09:01:00', '0', '2,561,569', '2,561,569', 'Npay정산', 'SC은행'],
        ['2', '2026-04-02 10:22:00', '13,000', '0', '2,548,569', '수수료', '기업은행'],
      ],
    })
    const file = {
      id: 'file-enterprise-bank',
      originalFilename: '기업은행 거래내역조회-4~6월.xlsx',
      fileType: 'excel',
    }

    const candidates = extractTransactionCandidates({ file, buffer })
    const inspection = inspectBookkeepingFileForTransactions({ file, buffer })

    expect(candidates).toHaveLength(2)
    expect(candidates.map((candidate) => candidate.transactionDate)).toEqual(['2026-04-01', '2026-04-02'])
    expect(inspection).toMatchObject({
      usableForTransactionWorkpapers: true,
      documentKind: 'transaction_detail',
      candidateCount: 2,
    })
  })

  it('normalizes sparse empty cells in real bank exports before schema validation', () => {
    const sparseRow = [
      '1',
      '2026-04-01 03:41:30',
      '0',
      '2,561,569',
      '6,844,569',
      'Npay정산',
      ,
      'SC은행',
      ,
      '타행이체',
      '0',
      ,
      '네이버파이낸셜주식회',
      '결제서비스',
    ]
    const buffer = workbookBuffer({
      '4월': [
        ['거래내역조회'],
        ['계좌번호: 000 조회시작일자:2026-04-01 조회종료일자:2026-04-30'],
        ['', '거래일시', '출금', '입금', '거래후 잔액', '거래내용', '상대계좌번호', '상대은행', '메모', '거래구분', '수표어음금액', 'CMS코드', '상대계좌예금주명'],
        sparseRow,
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-bank-sparse',
        originalFilename: '기업은행 거래내역조회-4~6월.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.rawRow).toContain('')
    expect(candidates[0]?.amountKrw).toBe(2561569)
  })

  it('preserves exact VAT supply, tax, and gross values from a tax-invoice row', () => {
    const buffer = workbookBuffer({
      '매입': [
        ['작성일자', '매입매출구분', '거래처', '공급가액', '세액', '합계금액', '과세유형'],
        ['2026-06-10', '매입', '주식회사 테스트', '100,000', '10,000', '110,000', '과세'],
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-tax-invoice-exact',
        originalFilename: '전자세금계산서.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      sourceType: 'tax_invoice',
      amountKrw: 110000,
      direction: 'expense',
      sourceRowRef: 'file-tax-invoice-exact:매입:2',
      vatFact: {
        direction: 'purchase',
        taxType: 'taxable',
        supplyAmountKrw: 100000,
        taxAmountKrw: 10000,
        grossAmountKrw: 110000,
        sourceReference: 'file-tax-invoice-exact:매입:2',
      },
    })
  })

  it('does not infer a VAT fact when an exact source field is missing', () => {
    const buffer = workbookBuffer({
      '매입': [
        ['작성일자', '매입매출구분', '거래처', '공급가액', '합계금액', '과세유형'],
        ['2026-06-10', '매입', '주식회사 테스트', '100,000', '110,000', '과세'],
      ],
    })

    const candidates = extractTransactionCandidates({
      file: {
        id: 'file-tax-invoice-missing-tax',
        originalFilename: '전자세금계산서.xlsx',
        fileType: 'excel',
      },
      buffer,
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.amountKrw).toBe(110000)
    expect(candidates[0]?.vatFact).toBeUndefined()
  })
})
