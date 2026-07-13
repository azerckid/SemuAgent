import { describe, expect, it } from 'vitest'
import { assembleBuildInput } from './assemble-build-input'
import type { SimplifiedWageEfilingContext } from './efiling-context'
import type { SimplifiedWageEmployeeSegment } from './types'

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
    monthlyGrossPayKrw: { '2026-01': 7_000_000 },
    ...over,
  }
}

function baseContext(): SimplifiedWageEfilingContext {
  return {
    paymentSummary: {
      tenant: { id: 't1', name: 'Test', timezone: 'Asia/Seoul' },
      businessEntity: { id: 'c1', name: 'Haesol' },
      context: {
        year: 2026,
        half: 1,
        halfMonths: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
        requiredMonths: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
        yearMonths: [],
        halfLabel: '2026년 상반기',
        halfRangeLabel: '2026-01 ~ 2026-06',
        periodStatus: 'completed',
      },
      hero: { totalEmployees: 1, attentionCount: 0, readyCount: 1, periodOpenCount: 0, readinessPercent: 100 },
      blockers: [],
      simplified: [],
      yearEnd: [],
    },
    business: {
      businessRegistrationNumber: '123-45-67890',
      businessName: 'Haesol Consulting',
      representativeName: 'Kim CEO',
      submitterKind: 'individual',
      maskedBusinessRegistrationNumber: null,
    },
    employees: [readySegment()],
    missingPayrollMonths: [],
    submittedOn: '20260705',
  }
}

describe('assembleBuildInput', () => {
  it('maps request PII into ready employee segments and B8 obligor id', () => {
    const input = assembleBuildInput(baseContext(), {
      year: 2026,
      half: 1,
      taxOfficeCode: '114',
      contactName: 'KimRep',
      contactPhone: '0212345678',
      representativeId: '7001011234567',
      employeePii: { 'code:E-001': { residentId: '8001011234567' } },
    })

    expect(input.employees[0].residentId).toBe('8001011234567')
    expect(input.taxOfficeCode).toBe('114')
    expect(input.obligorRegistrationId).toBe('7001011234567')
  })

  it('sets obligor registration id from representativeId', () => {
    const input = assembleBuildInput(baseContext(), {
      year: 2026,
      half: 1,
      taxOfficeCode: '114',
      contactName: 'KimRep',
      contactPhone: '0212345678',
      representativeId: '1234567890123',
      employeePii: { 'code:E-001': { residentId: '8001011234567' } },
    })

    expect(input.obligorRegistrationId).toBe('1234567890123')
  })
})
