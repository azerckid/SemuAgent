import { describe, expect, it } from 'vitest'
import { buildFileSummaryRows, buildGeneratedRows } from './period-attribution-rows'
import type { TransactionCandidate } from './schemas'

function candidate(params: {
  sourceFileId: string
  sourceFilename?: string
  transactionDate: string
  amountKrw?: number
  merchantName?: string
}): TransactionCandidate {
  return {
    sourceFileId: params.sourceFileId,
    sourceFilename: params.sourceFilename ?? '하나은행2024.01.01-12.31.xlsx',
    sourceType: 'bank',
    transactionDate: params.transactionDate,
    merchantName: params.merchantName ?? `거래처-${params.sourceFileId}`,
    description: '테스트 거래',
    amountKrw: params.amountKrw ?? 1000,
    direction: 'expense',
    rawRow: [params.transactionDate, params.merchantName ?? `거래처-${params.sourceFileId}`],
  }
}

describe('buildGeneratedRows', () => {
  it('keeps only the selected monthly target period as included by default', () => {
    const rows = buildGeneratedRows({
      requestedPeriod: '2024-07',
      targetRange: {
        type: 'monthly',
        start: '2024-07',
        end: '2024-07',
        label: '2024-07',
      },
      candidates: [
        candidate({ sourceFileId: 'jan', transactionDate: '2024-01-15' }),
        candidate({ sourceFileId: 'jun', transactionDate: '2024-06-15' }),
        candidate({ sourceFileId: 'jul', transactionDate: '2024-07-15' }),
        candidate({ sourceFileId: 'aug', transactionDate: '2024-08-15' }),
      ],
    })

    expect(rows).toHaveLength(4)
    expect(rows.map((row) => [row.attributedPeriod, row.periodRelation, row.recommendation])).toEqual([
      ['2024-01', 'prior', 'reference_only'],
      ['2024-06', 'prior', 'reference_only'],
      ['2024-07', 'requested', 'include'],
      ['2024-08', 'future', 'reference_only'],
    ])
  })

  it('includes all periods inside a quarterly target range and keeps outside rows as reference', () => {
    const rows = buildGeneratedRows({
      requestedPeriod: '2024-07',
      targetRange: {
        type: 'quarterly',
        start: '2024-07',
        end: '2024-09',
        label: '2024-Q3',
      },
      candidates: [
        candidate({ sourceFileId: 'jun', transactionDate: '2024-06-15' }),
        candidate({ sourceFileId: 'jul', transactionDate: '2024-07-15' }),
        candidate({ sourceFileId: 'sep', transactionDate: '2024-09-15' }),
        candidate({ sourceFileId: 'oct', transactionDate: '2024-10-15' }),
      ],
    })

    expect(rows.map((row) => [row.attributedPeriod, row.periodRelation, row.recommendation])).toEqual([
      ['2024-06', 'prior', 'reference_only'],
      ['2024-07', 'requested', 'include'],
      ['2024-09', 'requested', 'include'],
      ['2024-10', 'future', 'reference_only'],
    ])
  })

  it('creates file-summary rows for AI-read image evidence periods', () => {
    const rows = buildFileSummaryRows({
      targetRange: {
        type: 'monthly',
        start: '2024-07',
        end: '2024-07',
        label: '2024-07',
      },
      candidates: [
        {
          uploadFileId: 'july-receipt',
          sourceFilename: '2024.07월분 도현우.jpg',
          evidenceDate: '2024-07-31',
          amountKrw: 62190,
          description: 'AI 분석 결과 기준 영수증',
        },
        {
          uploadFileId: 'april-maintenance',
          sourceFilename: '2024.7월납부.jpg',
          attributedPeriod: '2024-04',
          evidenceDate: '2024-08-02',
          amountKrw: 351510,
          description: '고지년월 2024-04 관리비 납부확인서',
        },
      ],
    })

    expect(rows.map((row) => [
      row.sourceKind,
      row.sourceLabel,
      row.attributedPeriod,
      row.periodRelation,
      row.recommendation,
    ])).toEqual([
      ['file_summary', '2024.07월분 도현우.jpg', '2024-07', 'requested', 'include'],
      ['file_summary', '2024.7월납부.jpg', '2024-04', 'prior', 'reference_only'],
    ])
  })
})
