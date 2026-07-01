import { describe, expect, it } from 'vitest'

import { buildWageStatementDraft } from './wage-statement-draft'

describe('buildWageStatementDraft', () => {
  it('builds a detailed draft from a payroll row and keeps missing values as no_data', () => {
    const draft = buildWageStatementDraft({
      payrollPeriod: '2026-06',
      paymentDate: '2026-06-25',
      companyName: '테스트회사',
      row: {
        employeeCode: 'PAY-001',
        employeeName: '한은숙',
        department: '경영지원팀',
        jobTitle: '과장',
        jobType: '상용직',
        baseSalary: 3000000,
        mealAllowance: 200000,
        holidayWorkAllowance: 120000,
        annualLeaveAllowance: null,
        nightWorkAllowance: 70000,
        deductionAmount: null,
        confidence: 'high',
      },
    })

    expect(draft).toMatchObject({
      kind: 'wage_statement_draft',
      status: 'draft',
      companyName: '테스트회사',
      payrollPeriod: '2026-06',
      paymentDate: '2026-06-25',
      employee: {
        code: 'PAY-001',
        name: '한은숙',
      },
      summary: {
        grossPay: 3390000,
        deductionTotal: null,
        netPay: null,
      },
    })
    expect(draft.earningItems.find((item) => item.key === 'baseSalary')).toMatchObject({
      amount: 3000000,
      status: 'calculated',
    })
    expect(draft.earningItems.find((item) => item.key === 'annualLeaveAllowance')).toMatchObject({
      amount: null,
      status: 'no_data',
    })
    expect(draft.deductionItems.find((item) => item.key === 'deductionAmount')).toMatchObject({
      label: '공제합계',
      amount: null,
      status: 'no_data',
    })
    expect(draft.missingItems).toContain('공제합계')
    expect(draft.notes.join(' ')).toContain('자료없음')
  })

  it('calculates net pay only when deduction total is available', () => {
    const draft = buildWageStatementDraft({
      payrollPeriod: '2026-06',
      row: {
        employeeCode: 'PAY-002',
        employeeName: '박순',
        baseSalary: 2900000,
        mealAllowance: 200000,
        nationalPension: 130500,
        healthInsurance: 102805,
        longTermCare: 13313,
        employmentInsurance: 26100,
        incomeTax: 34000,
        localIncomeTax: 3400,
        deductionAmount: 310000,
        confidence: 'high',
      },
    })

    expect(draft.summary).toMatchObject({
      grossPay: 3100000,
      deductionTotal: 310000,
      netPay: 2790000,
    })
    expect(draft.deductionItems.find((item) => item.key === 'nationalPension')).toMatchObject({
      amount: 130500,
      status: 'calculated',
    })
    expect(draft.deductionItems.find((item) => item.key === 'deductionAmount')).toMatchObject({
      amount: 310000,
      status: 'calculated',
    })
  })
})
