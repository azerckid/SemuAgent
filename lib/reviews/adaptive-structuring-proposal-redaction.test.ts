import { describe, expect, it } from 'vitest'
import {
  REVIEW_ADAPTIVE_SAMPLE_ROW_MAX_COUNT,
  redactAndBoundReviewAdaptiveSampleRows,
  redactReviewAdaptiveSampleValue,
} from './adaptive-structuring-proposal-redaction'

describe('redactReviewAdaptiveSampleValue', () => {
  it('masks resident registration number patterns', () => {
    expect(redactReviewAdaptiveSampleValue('901231-1234567')).toBe('[마스킹됨]')
  })

  it('masks phone number patterns', () => {
    expect(redactReviewAdaptiveSampleValue('010-1234-5678')).toBe('[마스킹됨]')
  })

  it('masks long digit sequences resembling account numbers', () => {
    expect(redactReviewAdaptiveSampleValue('1002345678901')).toBe('[마스킹됨]')
  })

  it('leaves ordinary short values untouched', () => {
    expect(redactReviewAdaptiveSampleValue('주식회사 솔메이트')).toBe('주식회사 솔메이트')
    expect(redactReviewAdaptiveSampleValue('320000')).toBe('320000')
  })
})

describe('redactAndBoundReviewAdaptiveSampleRows', () => {
  it('bounds rows to the max sample row count by default', () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      sheetName: 'Sheet1',
      sourceRowRef: `row ${index + 1}`,
      values: { counterparty: `거래처${index + 1}` },
    }))

    const result = redactAndBoundReviewAdaptiveSampleRows(rows)
    expect(result).toHaveLength(REVIEW_ADAPTIVE_SAMPLE_ROW_MAX_COUNT)
  })

  it('redacts sensitive-looking values inside surviving rows', () => {
    const rows = [{
      sheetName: 'Sheet1',
      sourceRowRef: 'row 1',
      values: { counterparty: '거래처A', accountNumber: '1002345678901' },
    }]

    const result = redactAndBoundReviewAdaptiveSampleRows(rows)
    expect(result[0]?.values.counterparty).toBe('거래처A')
    expect(result[0]?.values.accountNumber).toBe('[마스킹됨]')
  })
})
