import { describe, expect, it } from 'vitest'
import { isDisplayableClassificationRow } from './classification-rows'
import { buildFileSummaryClassificationCandidates } from './file-summary-classification'
import { formatClassificationRowsForExport } from './export'

describe('formatClassificationRowsForExport', () => {
  it('maps internal rows to stable Korean export columns', () => {
    const [row] = formatClassificationRowsForExport([{
      sourceType: 'bank',
      transactionDate: '2026-06-02',
      merchantName: '테스트상사',
      description: '수수료 결제',
      amountKrw: 10000,
      direction: 'expense',
      recommendedAccount: 'fees',
      recommendationConfidence: 'high',
      recommendationReason: '수수료 성격입니다.',
      finalAccount: 'fees',
      staffMemo: '확인',
      status: 'confirmed',
      sourceFilename: '은행거래내역.xlsx',
    }])

    expect(row).toMatchObject({
      거래일자: '2026-06-02',
      귀속월: '2026-06',
      원천파일: '은행거래내역.xlsx',
      구분: '출금',
      거래처: '테스트상사',
      출금: 10000,
      계정항목: '지급수수료',
      AI추천: '지급수수료',
      상태: 'confirmed',
    })
  })

  it('builds account classification candidates from file-summary receipt evidence', () => {
    const [candidate] = buildFileSummaryClassificationCandidates({
      targetRange: {
        type: 'monthly',
        start: '2024-07',
        end: '2024-07',
        label: '2024-07',
      },
      attributionRows: [{
        uploadFileId: 'file-1',
        sourceKind: 'file_summary',
        sourceLabel: '2024.7월분 신영화.jpg',
        evidenceDate: '2024-07-31',
        attributedPeriod: '2024-07',
        amountKrw: 0,
        counterparty: null,
        description: '김영수증 2024년 7월 31일 발행된 (주)LG유플러스의 통신요금 카드 결제 영수증입니다. 요청 기간에 부합하며 결제 금액은 65,750원입니다.',
        recommendation: 'include',
        staffDecision: null,
      }],
    })

    expect(candidate).toMatchObject({
      sourceFileId: 'file-1',
      sourceType: 'receipt',
      transactionDate: '2024-07-31',
      amountKrw: 65750,
      direction: 'expense',
    })
  })

  it('keeps image communication payment evidence when OCR text says card payment without receipt wording', () => {
    const [candidate] = buildFileSummaryClassificationCandidates({
      targetRange: {
        type: 'monthly',
        start: '2024-07',
        end: '2024-07',
        label: '2024-07',
      },
      attributionRows: [{
        uploadFileId: 'file-shinyounghwa',
        sourceKind: 'file_summary',
        sourceLabel: '2024.7월분 신영화.jpg',
        evidenceDate: '2024-07-31',
        attributedPeriod: '2024-07',
        amountKrw: 0,
        counterparty: 'LGU+신영화',
        description: '2024년 7월 31일 발행된 LG유플러스 통신요금 카드 결제 자료입니다. 결제 금액 65,750',
        recommendation: 'include',
        staffDecision: null,
      }],
    })

    expect(candidate).toMatchObject({
      sourceFileId: 'file-shinyounghwa',
      sourceType: 'receipt',
      sourceFilename: '2024.7월분 신영화.jpg',
      transactionDate: '2024-07-31',
      merchantName: 'LGU+신영화',
      amountKrw: 65750,
      direction: 'expense',
    })
    expect(isDisplayableClassificationRow(candidate)).toBe(true)
  })

  it('keeps image evidence visible even when amount extraction is missing', () => {
    expect(isDisplayableClassificationRow({
      sourceType: 'receipt',
      transactionDate: '2024-07-31',
      description: '통신요금 카드 결제 영수증입니다.',
      amountKrw: null,
    })).toBe(true)
    expect(isDisplayableClassificationRow({
      sourceType: 'bank',
      transactionDate: '2024-07-31',
      description: '거래 상세 행',
      amountKrw: null,
    })).toBe(false)
  })
})
