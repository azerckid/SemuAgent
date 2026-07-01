import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractDocumentTextChunks } from '@/lib/ai/extract'
import { runPayrollAdaptiveCommonEngine } from './adaptive-structuring-common-engine'
import type { PayrollAdaptiveModelContract } from './adaptive-structuring-model-contract'

const fixtureRoot = path.join(
  process.cwd(),
  'docs/05_QA_Validation/fixtures/payroll-adaptive-structuring',
)

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

async function loadFixtureAsPayrollSourceTexts(filename: string) {
  const buffer = readFileSync(path.join(fixtureRoot, filename))
  const chunks = await extractDocumentTextChunks({
    fileBuffer: toArrayBuffer(buffer),
    fileType: 'excel',
    originalFilename: filename,
    profile: 'payroll',
  })

  return chunks.map((chunk) => ({
    filename,
    text: chunk.text,
    summary: chunk.summary,
    chunkIndex: chunk.chunkIndex,
    chunkTotal: chunk.chunkTotal,
    sheetName: chunk.sheetName,
    rowStart: chunk.rowStart,
    rowEnd: chunk.rowEnd,
  }))
}

function contractFor(params: {
  sheetName: string
  identityColumn?: string
  periodColumn?: string
  amountColumn?: string
  deductionColumn?: string
}): PayrollAdaptiveModelContract {
  const fieldMappings: PayrollAdaptiveModelContract['fieldMappings'] = []
  const requiredHeaderLabels: string[] = []

  if (params.identityColumn) {
    requiredHeaderLabels.push(params.identityColumn)
    fieldMappings.push({
      sheetName: params.sheetName,
      sourceColumn: params.identityColumn,
      targetField: 'employeeName',
      required: true,
      dataType: 'text',
    })
  }

  if (params.periodColumn) {
    requiredHeaderLabels.push(params.periodColumn)
    fieldMappings.push({
      sheetName: params.sheetName,
      sourceColumn: params.periodColumn,
      targetField: 'payrollMonth',
      required: true,
      dataType: 'date',
    })
  }

  if (params.amountColumn) {
    fieldMappings.push({
      sheetName: params.sheetName,
      sourceColumn: params.amountColumn,
      targetField: 'baseSalary',
      required: false,
      dataType: 'amount',
    })
  }

  if (params.deductionColumn) {
    fieldMappings.push({
      sheetName: params.sheetName,
      sourceColumn: params.deductionColumn,
      targetField: 'nationalPensionBasis',
      required: false,
      dataType: 'amount',
    })
  }

  return {
    targetWorkflow: 'payroll',
    payrollModelType: 'payroll_period_payments',
    workbookSignature: {
      sheetNamePatterns: [params.sheetName],
      requiredHeaderLabels,
      optionalHeaderLabels: [
        params.amountColumn,
        params.deductionColumn,
      ].filter((value): value is string => Boolean(value)),
      headerRowCandidates: [],
      payrollPeriodSignals: [],
    },
    fieldMappings,
    ignoredRegions: [],
    validationRules: [],
    outputMode: 'preview_only',
  }
}

const approvedValidFixtureContract = contractFor({
  sheetName: '월급지급_새양식',
  identityColumn: '사원표시명',
  periodColumn: '대상월',
  amountColumn: '급여본액',
  deductionColumn: '원천소득세',
})

describe('payroll adaptive structuring fixture regressions', () => {
  it('extracts the unknown-valid fixture through the common engine', async () => {
    const fileTexts = await loadFixtureAsPayrollSourceTexts('unknown-valid-payroll-2026-06.xlsx')
    const result = runPayrollAdaptiveCommonEngine(approvedValidFixtureContract, fileTexts)

    expect(result.matched).toBe(true)
    expect(result.standardRows).toHaveLength(3)
    expect(result.blockedRowCount).toBe(0)
    expect(result.standardRows[0]?.values).toMatchObject({
      employeeName: '테스트직원A',
      payrollMonth: '2026-06-01',
      baseSalary: 3200000,
      nationalPensionBasis: 118000,
    })
  })

  it.each([
    'metadata-only-company-profile.xlsx',
    'policy-only-payroll-rules.xlsx',
    'result-only-payroll-summary.xlsx',
    'similar-different-payroll.xlsx',
  ])('fails closed when the approved valid fixture model is applied to %s', async (filename) => {
    const fileTexts = await loadFixtureAsPayrollSourceTexts(filename)
    const result = runPayrollAdaptiveCommonEngine(approvedValidFixtureContract, fileTexts)

    expect(result.matched).toBe(false)
    expect(result.standardRows).toEqual([])
  })

  it('blocks rows when a payroll-like fixture has no employee identity column', async () => {
    const fileTexts = await loadFixtureAsPayrollSourceTexts('missing-identity-payroll.xlsx')
    const result = runPayrollAdaptiveCommonEngine(
      contractFor({
        sheetName: '식별자누락',
        periodColumn: '대상월',
        amountColumn: '급여본액',
      }),
      fileTexts,
    )

    expect(result.matched).toBe(true)
    expect(result.standardRows).toEqual([])
    expect(result.blockedRowCount).toBe(2)
  })

  it('fails closed when a payroll-like fixture has no payment period column', async () => {
    const fileTexts = await loadFixtureAsPayrollSourceTexts('missing-period-payroll.xlsx')
    const result = runPayrollAdaptiveCommonEngine(
      contractFor({
        sheetName: '귀속월누락',
        identityColumn: '사원표시명',
        periodColumn: '대상월',
        amountColumn: '급여본액',
      }),
      fileTexts,
    )

    expect(result.matched).toBe(false)
    expect(result.standardRows).toEqual([])
    expect(result.blockers.length).toBeGreaterThan(0)
  })

  it('keeps missing deduction basis values as 자료없음 instead of zero', async () => {
    const fileTexts = await loadFixtureAsPayrollSourceTexts('missing-deduction-basis-payroll.xlsx')
    const result = runPayrollAdaptiveCommonEngine(
      contractFor({
        sheetName: '공제기준누락',
        identityColumn: '사원표시명',
        periodColumn: '대상월',
        amountColumn: '급여본액',
        deductionColumn: '국민연금',
      }),
      fileTexts,
    )

    expect(result.matched).toBe(true)
    expect(result.standardRows).toHaveLength(2)
    expect(result.standardRows[0]?.values.nationalPensionBasis).toBe('자료없음')
  })

  it('fails closed when a non-XLSX text file is parsed as a one-column worksheet', async () => {
    const fileTexts = await loadFixtureAsPayrollSourceTexts('malformed-workbook.txt')
    const result = runPayrollAdaptiveCommonEngine(approvedValidFixtureContract, fileTexts)

    expect(fileTexts).toHaveLength(1)
    expect(result.matched).toBe(false)
    expect(result.standardRows).toEqual([])
  })
})
