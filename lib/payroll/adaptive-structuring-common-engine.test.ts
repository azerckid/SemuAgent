import { describe, expect, it } from 'vitest'
import type { PayrollSourceText } from '@/lib/ai/payroll-extract'
import { runPayrollAdaptiveCommonEngine } from './adaptive-structuring-common-engine'
import type { PayrollAdaptiveModelContract } from './adaptive-structuring-model-contract'

function baseContract(overrides: Partial<PayrollAdaptiveModelContract> = {}): PayrollAdaptiveModelContract {
  return {
    targetWorkflow: 'payroll',
    payrollModelType: 'payroll_period_payments',
    workbookSignature: {
      sheetNamePatterns: ['Sheet1'],
      requiredHeaderLabels: ['성명', '지급월'],
      optionalHeaderLabels: ['기본급'],
      headerRowCandidates: [],
      payrollPeriodSignals: [],
    },
    fieldMappings: [
      { sheetName: 'Sheet1', sourceColumn: '성명', targetField: 'employeeName', required: true, dataType: 'text' },
      { sheetName: 'Sheet1', sourceColumn: '지급월', targetField: 'payrollMonth', required: true, dataType: 'date' },
      { sheetName: 'Sheet1', sourceColumn: '기본급', targetField: 'baseSalary', required: false, dataType: 'amount' },
      {
        sheetName: 'Sheet1',
        sourceColumn: '국민연금',
        targetField: 'nationalPensionBasis',
        required: false,
        dataType: 'amount',
      },
    ],
    ignoredRegions: [],
    validationRules: [],
    outputMode: 'preview_only',
    ...overrides,
  }
}

function fileTextsWith(text: string, sheetName = 'Sheet1'): PayrollSourceText[] {
  return [{ filename: 'workbook.xlsx', sheetName, text, summary: null }]
}

describe('runPayrollAdaptiveCommonEngine', () => {
  it('extracts normalized preview rows from an unknown but valid single-row-header workbook', () => {
    const fileTexts = fileTextsWith([
      '1: 성명 | 지급월 | 기본급 | 국민연금',
      '2: 홍길동 | 2026-06 | 3,000,000 | 135,000',
    ].join('\n'))

    const result = runPayrollAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(true)
    expect(result.standardRows).toHaveLength(1)
    expect(result.standardRows[0]?.values).toMatchObject({
      employeeName: '홍길동',
      payrollMonth: '2026-06-01',
      baseSalary: 3000000,
      nationalPensionBasis: 135000,
    })
  })

  it('fails closed with no rows when the workbook signature does not match (similar but different workbook)', () => {
    const fileTexts = fileTextsWith([
      '1: 거래처 | 품목 | 단가',
      '2: A상사 | 노트북 | 1,200,000',
    ].join('\n'), 'Sheet2')

    const result = runPayrollAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(false)
    expect(result.standardRows).toEqual([])
    expect(result.blockers.length).toBeGreaterThan(0)
  })

  it('returns a precise blocker when the sheet matches but required headers are missing', () => {
    const fileTexts = fileTextsWith([
      '1: 거래처 | 품목 | 단가',
      '2: A상사 | 노트북 | 1,200,000',
    ].join('\n'))

    const result = runPayrollAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(false)
    expect(result.blockers[0]).toContain('필수 헤더')
  })

  it('fails closed on a two-row merged header instead of misreading it', () => {
    const fileTexts = fileTextsWith([
      '1: 성명 | | 지급내역 |',
      '2:  | 사번 | 지급월 | 기본급',
      '3: 홍길동 | E001 | 2026-06 | 3,000,000',
    ].join('\n'))

    const result = runPayrollAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(false)
    expect(result.blockers[0]).toContain('병합 헤더')
  })

  it('excludes a row missing employee identity instead of producing an unsafe draft row', () => {
    const fileTexts = fileTextsWith([
      '1: 성명 | 지급월 | 기본급',
      '2:  | 2026-06 | 3,000,000',
      '3: 김철수 | 2026-06 | 2,800,000',
    ].join('\n'))

    const result = runPayrollAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.matched).toBe(true)
    expect(result.standardRows).toHaveLength(1)
    expect(result.standardRows[0]?.values.employeeName).toBe('김철수')
    expect(result.blockedRowCount).toBe(1)
  })

  it('keeps missing deduction basis as 자료없음 instead of zero', () => {
    const fileTexts = fileTextsWith([
      '1: 성명 | 지급월 | 기본급 | 국민연금',
      '2: 홍길동 | 2026-06 | 3,000,000 | ',
    ].join('\n'))

    const result = runPayrollAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.standardRows[0]?.values.nationalPensionBasis).toBe('자료없음')
  })

  it('distinguishes an explicit zero amount from a blank amount', () => {
    const fileTexts = fileTextsWith([
      '1: 성명 | 지급월 | 기본급 | 국민연금',
      '2: 홍길동 | 2026-06 | 0 | 135,000',
    ].join('\n'))

    const result = runPayrollAdaptiveCommonEngine(baseContract(), fileTexts)

    expect(result.standardRows[0]?.values.baseSalary).toBe(0)
  })

  it('masks resident-number/phone/account-number-shaped values in standardRows before returning them', () => {
    const contract = baseContract({
      fieldMappings: [
        { sheetName: 'Sheet1', sourceColumn: '성명', targetField: 'employeeName', required: true, dataType: 'text' },
        { sheetName: 'Sheet1', sourceColumn: '지급월', targetField: 'payrollMonth', required: true, dataType: 'date' },
        {
          sheetName: 'Sheet1',
          sourceColumn: '주민번호',
          targetField: 'residentOrInternalKey',
          required: false,
          dataType: 'identifier',
        },
      ],
    })
    const fileTexts = fileTextsWith([
      '1: 성명 | 지급월 | 주민번호',
      '2: 홍길동 | 2026-06 | 901231-1234567',
    ].join('\n'))

    const result = runPayrollAdaptiveCommonEngine(contract, fileTexts)

    expect(result.standardRows[0]?.values.employeeName).toBe('홍길동')
    expect(result.standardRows[0]?.values.residentOrInternalKey).toBe('[마스킹됨]')
  })

  it('ignores result-only/footer rows matched by an ignored region rule', () => {
    const fileTexts = fileTextsWith([
      '1: 성명 | 지급월 | 기본급',
      '2: 홍길동 | 2026-06 | 3,000,000',
      '3: 합계 | 2026-06 | 3,000,000',
    ].join('\n'))

    const contract = baseContract({
      ignoredRegions: [{ sheetName: 'Sheet1', sourceColumnOrRegion: '합계', reason: 'footer_or_total' }],
    })

    const result = runPayrollAdaptiveCommonEngine(contract, fileTexts)

    expect(result.standardRows).toHaveLength(1)
    expect(result.standardRows[0]?.values.employeeName).toBe('홍길동')
  })
})
