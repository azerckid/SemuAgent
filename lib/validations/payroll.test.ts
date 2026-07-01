import { describe, expect, it } from 'vitest'
import {
  defaultPayrollExcelMapping,
  mappingJsonSchema,
  payrollExtractedRowSchema,
} from './payroll'

describe('payroll Excel mapping schema', () => {
  it('accepts the fixed A-U upload template mapping', () => {
    expect(mappingJsonSchema.safeParse(defaultPayrollExcelMapping).success).toBe(true)
  })

  it('rejects mappings outside the fixed A-U output area', () => {
    const invalid: unknown[] = defaultPayrollExcelMapping.map((item) => ({ ...item }))
    invalid[0] = { field: 'employee_code', column: 'V', columnIndex: 21 }

    expect(mappingJsonSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects field-column mismatches', () => {
    const invalid: unknown[] = defaultPayrollExcelMapping.map((item) => ({ ...item }))
    invalid[0] = { field: 'employee_code', column: 'B', columnIndex: 1 }

    expect(mappingJsonSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects missing or duplicate fields', () => {
    const invalid: unknown[] = defaultPayrollExcelMapping
      .slice(1)
      .map((item) => ({ ...item }))
    invalid.push({ ...defaultPayrollExcelMapping[1] })

    expect(mappingJsonSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('payrollExtractedRowSchema sourceReference', () => {
  const baseRow = {
    employeeName: '김은주',
    baseSalary: 2740000,
    confidence: 'high',
    aiVerdict: 'pass',
  }

  it('accepts a record sourceReference as-is', () => {
    const parsed = payrollExtractedRowSchema.safeParse({
      ...baseRow,
      sourceReference: { filename: '급여.xlsx', sheetName: '인적사항', rowHint: '12' },
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.sourceReference).toEqual({
        filename: '급여.xlsx',
        sheetName: '인적사항',
        rowHint: '12',
      })
    }
  })

  it('coerces a string sourceReference into a record', () => {
    const parsed = payrollExtractedRowSchema.safeParse({
      ...baseRow,
      sourceReference: '인적사항 시트 12행',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.sourceReference).toEqual({ reference: '인적사항 시트 12행' })
    }
  })

  it('coerces an empty string sourceReference to null', () => {
    const parsed = payrollExtractedRowSchema.safeParse({
      ...baseRow,
      sourceReference: '  ',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.sourceReference).toBeNull()
    }
  })

  it('still accepts null sourceReference', () => {
    const parsed = payrollExtractedRowSchema.safeParse({
      ...baseRow,
      sourceReference: null,
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.sourceReference).toBeNull()
    }
  })
})
