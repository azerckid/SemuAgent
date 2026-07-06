import { describe, expect, it } from 'vitest'
import { buildSimplifiedWageRecords, serializeSimplifiedWageRecords } from './build-records'
import { SIMPLIFIED_WAGE_RECORD_LENGTH } from './constants'
import { buildFileName, pad9, readPad9, readPadX } from './format'
import type { BuildSimplifiedWageInput, SimplifiedWageEmployeeSegment } from './types'
import { validateBuiltRecords, validateInputBeforeBuild } from './validate'

const H1_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']

function monthly(grossPerMonth: number): Record<string, number> {
  return Object.fromEntries(H1_MONTHS.map((m) => [m, grossPerMonth]))
}

function readyEmployee(over: Partial<SimplifiedWageEmployeeSegment> = {}): SimplifiedWageEmployeeSegment {
  return {
    employeeKey: 'code:E-001',
    employeeName: 'KimRep',
    simplifiedStatus: 'ready',
    residentId: '8001011234567',
    workPeriodStart: '20260101',
    workPeriodEnd: '20260630',
    grossPayKrw: 42_000_000,
    recognizedBonusKrw: 0,
    monthlyGrossPayKrw: monthly(7_000_000),
    ...over,
  }
}

function baseInput(over: Partial<BuildSimplifiedWageInput> = {}): BuildSimplifiedWageInput {
  return {
    year: 2026,
    half: 1,
    submittedOn: '20260705',
    taxOfficeCode: '114',
    submitterKind: 'individual',
    businessRegistrationNumber: '123-45-67890',
    businessName: 'Haesol Consulting',
    representativeName: 'Kim CEO',
    obligorRegistrationId: '8001011234567',
    contactDepartment: 'Finance',
    contactName: 'KimRep',
    contactPhone: '0212345678',
    employees: [readyEmployee()],
    ...over,
  }
}

describe('buildFileName', () => {
  it('prefixes SC and strips hyphens from business registration number', () => {
    expect(buildFileName('123-45-67890')).toBe('SC1234567890')
  })
})

describe('buildSimplifiedWageRecords — happy path', () => {
  it('builds one A, one B, and N C records of 190 bytes', () => {
    const result = buildSimplifiedWageRecords(baseInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fileName).toBe('SC1234567890')
    expect(result.records).toHaveLength(3)
    for (const rec of result.records) {
      expect(rec.length).toBe(SIMPLIFIED_WAGE_RECORD_LENGTH)
    }
    expect(readPadX(result.records[0], 0, 1)).toBe('A')
    expect(readPadX(result.records[1], 0, 1)).toBe('B')
    expect(readPadX(result.records[2], 0, 1)).toBe('C')
    expect(readPad9(result.records[0], 160, 5)).toBe(1)
    expect(readPad9(result.records[1], 110, 10)).toBe(1)
    expect(readPad9(result.records[2], 106, 13)).toBe(42_000_000)
  })

  it('serializes with CRLF between records', () => {
    const result = buildSimplifiedWageRecords(baseInput())
    if (!result.ok) throw new Error('expected ok')
    const body = serializeSimplifiedWageRecords(result.records)
    expect(body.length).toBe(190 * 3 + 2 * 2)
  })
})

describe('validation V-01 ~ V-06 (built records)', () => {
  it('V-01 flags wrong record length', () => {
    const bad = Buffer.alloc(100, 0x20)
    const issues = validateBuiltRecords([bad])
    expect(issues.some((i) => i.ruleId === 'V-01')).toBe(true)
  })

  it('V-02 flags missing A record at start', () => {
    const b = Buffer.alloc(SIMPLIFIED_WAGE_RECORD_LENGTH, 0x20)
    b.write('B', 0)
    const issues = validateBuiltRecords([b])
    expect(issues.some((i) => i.ruleId === 'V-02')).toBe(true)
  })

  it('V-03 flags B count mismatch with A14', () => {
    const result = buildSimplifiedWageRecords(baseInput())
    if (!result.ok) throw new Error('expected ok')
    const tampered = Buffer.from(result.records[0])
    pad9(2, 5).copy(tampered, 160)
    const issues = validateBuiltRecords([tampered, result.records[1], result.records[2]])
    expect(issues.some((i) => i.ruleId === 'V-03')).toBe(true)
  })
})

describe('validation V-07 ~ V-11 (input)', () => {
  it('V-07 blocks non-ready employees', () => {
    const result = buildSimplifiedWageRecords(
      baseInput({
        employees: [readyEmployee({ simplifiedStatus: 'needs_review' })],
      }),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((i) => i.ruleId === 'V-07')).toBe(true)
  })

  it('V-08 blocks missing resident id', () => {
    const issues = validateInputBeforeBuild(
      baseInput({ employees: [readyEmployee({ residentId: null })] }),
    )
    expect(issues.some((i) => i.ruleId === 'V-08')).toBe(true)
  })

  it('V-09 blocks invalid tax office code', () => {
    const issues = validateInputBeforeBuild(baseInput({ taxOfficeCode: '' }))
    expect(issues.some((i) => i.ruleId === 'V-09')).toBe(true)
  })

  it('V-10 blocks missing payroll months', () => {
    const issues = validateInputBeforeBuild(baseInput({ missingPayrollMonths: ['2026-03'] }))
    expect(issues.some((i) => i.ruleId === 'V-10')).toBe(true)
  })

  it('V-11 blocks monthly sum mismatch', () => {
    const issues = validateInputBeforeBuild(
      baseInput({
        employees: [
          readyEmployee({
            grossPayKrw: 99,
            monthlyGrossPayKrw: monthly(7_000_000),
          }),
        ],
      }),
    )
    expect(issues.some((i) => i.ruleId === 'V-11')).toBe(true)
  })

  it('V-06 blocks inverted work period', () => {
    const issues = validateInputBeforeBuild(
      baseInput({
        employees: [
          readyEmployee({
            workPeriodStart: '20260630',
            workPeriodEnd: '20260101',
          }),
        ],
      }),
    )
    expect(issues.some((i) => i.ruleId === 'V-06')).toBe(true)
  })
})

describe('Korean name byte padding', () => {
  it('fits C7 within 30 EUC-KR bytes', () => {
    const result = buildSimplifiedWageRecords(
      baseInput({
        employees: [readyEmployee({ employeeName: '김대표' })],
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const nameField = result.records[2].subarray(36, 66)
    expect(nameField.length).toBe(30)
    expect(readPadX(result.records[2], 36, 30)).toContain('김')
  })
})
