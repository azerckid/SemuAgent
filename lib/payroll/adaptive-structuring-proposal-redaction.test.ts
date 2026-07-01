import { describe, expect, it } from 'vitest'
import {
  PAYROLL_ADAPTIVE_SAMPLE_ROW_MAX_COUNT,
  redactAndBoundPayrollAdaptiveSampleRows,
  redactPayrollAdaptiveSampleValue,
} from './adaptive-structuring-proposal-redaction'

describe('redactPayrollAdaptiveSampleValue', () => {
  it('masks resident registration number patterns', () => {
    expect(redactPayrollAdaptiveSampleValue('901231-1234567')).toBe('[마스킹됨]')
  })

  it('masks phone number patterns', () => {
    expect(redactPayrollAdaptiveSampleValue('010-1234-5678')).toBe('[마스킹됨]')
  })

  it('masks long digit sequences resembling account numbers', () => {
    expect(redactPayrollAdaptiveSampleValue('1002345678901')).toBe('[마스킹됨]')
  })

  it('leaves ordinary short values untouched', () => {
    expect(redactPayrollAdaptiveSampleValue('홍길동')).toBe('홍길동')
    expect(redactPayrollAdaptiveSampleValue('3200000')).toBe('3200000')
  })
})

describe('redactAndBoundPayrollAdaptiveSampleRows', () => {
  it('bounds rows to the max sample row count by default', () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      sheetName: 'Sheet1',
      sourceRowRef: `row ${index + 1}`,
      values: { employeeName: `직원${index + 1}` },
    }))

    const result = redactAndBoundPayrollAdaptiveSampleRows(rows)
    expect(result).toHaveLength(PAYROLL_ADAPTIVE_SAMPLE_ROW_MAX_COUNT)
  })

  it('redacts sensitive-looking values inside surviving rows', () => {
    const rows = [{
      sheetName: 'Sheet1',
      sourceRowRef: 'row 1',
      values: { employeeName: '홍길동', residentNumber: '901231-1234567' },
    }]

    const result = redactAndBoundPayrollAdaptiveSampleRows(rows)
    expect(result[0]?.values.employeeName).toBe('홍길동')
    expect(result[0]?.values.residentNumber).toBe('[마스킹됨]')
  })
})
