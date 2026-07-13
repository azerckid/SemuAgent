import { describe, expect, it } from 'vitest'
import type { PaymentStatementSummary, SimplifiedRow } from '@/lib/payment-statements/summary'
import { clipWorkPeriod, monthlyGrossForHalf } from './employee-segments'
import { buildSimplifiedWageEfilingSummary } from './panel-summary'
import { pendingPiiIssue, validateDataReadiness } from './validate-panel'
import type { BuildSimplifiedWageInput, SimplifiedWageEmployeeSegment } from './types'

const H1_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']

function simplifiedRow(over: Partial<SimplifiedRow> = {}): SimplifiedRow {
  return {
    employeeKey: 'code:E-001',
    employeeName: 'KimRep',
    employeeCode: 'E-001',
    periodLabel: '01~06월 (6개월)',
    grossPayKrw: 42_000_000,
    withholdingTaxKrw: 2_940_000,
    status: 'ready',
    statusLabel: '준비 완료',
    tone: 'ok',
    ...over,
  }
}

function paymentSummary(over: Partial<PaymentStatementSummary> = {}): PaymentStatementSummary {
  return {
    tenant: { id: 't1', name: 'Test Co', timezone: 'Asia/Seoul' },
    businessEntity: { id: 'c1', name: 'Haesol Consulting' },
    context: {
      year: 2026,
      half: 1,
      halfMonths: H1_MONTHS,
      yearMonths: H1_MONTHS,
      halfLabel: '2026년 상반기',
      halfRangeLabel: '2026-01 ~ 2026-06',
    },
    hero: { totalEmployees: 1, attentionCount: 0, readyCount: 1, readinessPercent: 100 },
    blockers: [],
    simplified: [simplifiedRow()],
    yearEnd: [],
    ...over,
  }
}

function readySegment(over: Partial<SimplifiedWageEmployeeSegment> = {}): SimplifiedWageEmployeeSegment {
  return {
    employeeKey: 'code:E-001',
    employeeName: 'KimRep',
    simplifiedStatus: 'ready',
    residentId: null,
    workPeriodStart: '20260101',
    workPeriodEnd: '20260630',
    grossPayKrw: 42_000_000,
    recognizedBonusKrw: 0,
    monthlyGrossPayKrw: Object.fromEntries(H1_MONTHS.map((m) => [m, 7_000_000])),
    ...over,
  }
}

describe('clipWorkPeriod', () => {
  it('clips hire date to half start', () => {
    const context = paymentSummary().context
    const { workPeriodStart } = clipWorkPeriod(context, {
      employeeCode: 'E-001',
      displayName: 'KimRep',
      employeeStatus: 'active',
      hireDate: '2026-03-15',
      terminationDate: null,
    })
    expect(workPeriodStart).toBe('20260315')
  })
})

describe('monthlyGrossForHalf', () => {
  it('sums gross per month in half', () => {
    const monthly = monthlyGrossForHalf(
      [
        { employeeCode: 'E-001', employeeName: 'KimRep', period: '2026-01', grossPayKrw: 100, incomeTaxKrw: 10, status: 'ready' },
        { employeeCode: 'E-001', employeeName: 'KimRep', period: '2026-02', grossPayKrw: 200, incomeTaxKrw: 20, status: 'ready' },
      ],
      H1_MONTHS,
    )
    expect(monthly['2026-01']).toBe(100)
    expect(monthly['2026-02']).toBe(200)
    expect(monthly['2026-06']).toBe(0)
  })
})

describe('validateDataReadiness', () => {
  it('does not require residentId (V-08 excluded)', () => {
    const input: BuildSimplifiedWageInput = {
      year: 2026,
      half: 1,
      submittedOn: '20260705',
      taxOfficeCode: '',
      submitterKind: 'individual',
      businessRegistrationNumber: '123-45-67890',
      businessName: 'Haesol',
      representativeName: 'Kim CEO',
      obligorRegistrationId: '',
      contactDepartment: '',
      contactName: '',
      contactPhone: '',
      employees: [readySegment()],
    }
    const issues = validateDataReadiness(input)
    expect(issues.some((i) => i.ruleId === 'V-08')).toBe(false)
  })

  it('flags V-07 for non-ready employees', () => {
    const input: BuildSimplifiedWageInput = {
      year: 2026,
      half: 1,
      submittedOn: '20260705',
      taxOfficeCode: '',
      submitterKind: 'individual',
      businessRegistrationNumber: '1234567890',
      businessName: 'Haesol',
      representativeName: 'Kim CEO',
      obligorRegistrationId: '',
      contactDepartment: '',
      contactName: '',
      contactPhone: '',
      employees: [readySegment({ simplifiedStatus: 'missing_months' })],
    }
    expect(validateDataReadiness(input).some((i) => i.ruleId === 'V-07')).toBe(true)
  })
})

describe('pendingPiiIssue', () => {
  it('never includes residentId values', () => {
    const issue = pendingPiiIssue(3)
    expect(issue?.message).toContain('3명')
    expect(issue?.message).not.toMatch(/\d{13}/)
  })
})

describe('buildSimplifiedWageEfilingSummary', () => {
  it('builds direct-entry values and surfaces employee blockers without file metadata', () => {
    const summary = buildSimplifiedWageEfilingSummary({
      paymentSummary: paymentSummary({
        simplified: [
          simplifiedRow(),
          simplifiedRow({
            employeeKey: 'code:E-002',
            employeeName: 'Lee',
            employeeCode: 'E-002',
            status: 'missing_months',
            statusLabel: '월 급여 누락',
            tone: 'warn',
          }),
        ],
      }),
      business: {
        businessRegistrationNumber: '123-45-67890',
        businessName: 'Haesol Consulting',
        representativeName: 'Kim CEO',
        submitterKind: 'individual',
        maskedBusinessRegistrationNumber: '123-**-*****0',
      },
      employees: [
        readySegment(),
        readySegment({
          employeeKey: 'code:E-002',
          employeeName: 'Lee',
          simplifiedStatus: 'missing_months',
        }),
      ],
      missingPayrollMonths: [],
      submittedOn: '20260705',
    })

    expect(summary.stats.readyCount).toBe(1)
    expect(summary.stats.attentionCount).toBe(1)
    expect(summary.stats.totalEmployees).toBe(2)
    expect(summary.validationItems.some((i) => i.employeeName === 'Lee')).toBe(true)
    expect(summary.validationItems.some((i) => i.ruleId === 'V-08')).toBe(false)
    expect(summary.directEntry.overview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '작성 화면', value: '간이지급명세서(근로소득) 직접작성' }),
        expect.objectContaining({ label: '소득자 수', value: '1명' }),
        expect.objectContaining({ label: '지급총액 합계', value: '42,000,000원' }),
      ]),
    )
    expect(summary.directEntry.employees).toEqual([
      expect.objectContaining({
        employeeName: 'KimRep',
        workPeriodLabel: '2026-01-01 ~ 2026-06-30',
        grossPayKrw: 42_000_000,
        recognizedBonusKrw: 0,
        monthlyPay: H1_MONTHS.map((period) => ({
          period,
          label: `${Number(period.slice(5))}월`,
          grossPayKrw: 7_000_000,
        })),
      }),
    ])
  })

  it('omits PII pending when no ready employees', () => {
    const summary = buildSimplifiedWageEfilingSummary({
      paymentSummary: paymentSummary({
        simplified: [simplifiedRow({ status: 'needs_review', statusLabel: '급여 미확정', tone: 'warn' })],
      }),
      business: {
        businessRegistrationNumber: '1234567890',
        businessName: 'Haesol',
        representativeName: 'Kim',
        submitterKind: 'individual',
        maskedBusinessRegistrationNumber: null,
      },
      employees: [readySegment({ simplifiedStatus: 'needs_review' })],
      missingPayrollMonths: [],
      submittedOn: '20260705',
    })

    expect(summary.validationItems.some((i) => i.ruleId === 'V-08')).toBe(false)
    expect(summary.directEntry.employees).toHaveLength(0)
    expect(summary.hasBlockingDataIssues).toBe(true)
  })
})
