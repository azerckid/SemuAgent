import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { vi } from 'vitest'
import * as appSchema from '@/lib/db/schema'
import type { PayrollSourceText } from '@/lib/ai/payroll-extract'
import type { PayrollAdaptiveModelContract } from './adaptive-structuring-model-contract'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: appSchema })
  await client.execute(`
    CREATE TABLE adaptive_structure_model (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      name text NOT NULL,
      target_workflow text NOT NULL,
      source_classification text NOT NULL DEFAULT 'business_data',
      status text NOT NULL DEFAULT 'proposed',
      engine_version text NOT NULL,
      model_version integer NOT NULL DEFAULT 1,
      model_json text NOT NULL,
      sample_rows_preview_json text NOT NULL,
      validation_summary_json text NOT NULL,
      prompt_version text NOT NULL,
      source_upload_session_id text NOT NULL,
      source_upload_file_ids text NOT NULL,
      created_by_staff_id text NOT NULL,
      approved_by_staff_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      approved_at text,
      rejected_at text,
      retired_at text
    )
  `)
  await client.execute(`
    CREATE TABLE adaptive_structure_model_run (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      model_id text,
      upload_session_id text NOT NULL,
      status text NOT NULL,
      engine_version text,
      matched_row_count integer NOT NULL DEFAULT 0,
      blocked_row_count integer NOT NULL DEFAULT 0,
      warnings_json text NOT NULL DEFAULT '[]',
      blockers_json text NOT NULL DEFAULT '[]',
      error_message text,
      created_at text NOT NULL
    )
  `)
})

beforeEach(async () => {
  await client.execute('DELETE FROM adaptive_structure_model')
  await client.execute('DELETE FROM adaptive_structure_model_run')
})

const { adaptiveStructureModel, adaptiveStructureModelRun } = appSchema
const {
  findApprovedPayrollAdaptiveModelMatch,
  applyApprovedPayrollAdaptiveModel,
} = await import('./adaptive-structuring-apply')

const matchingContract: PayrollAdaptiveModelContract = {
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
  ],
  ignoredRegions: [],
  validationRules: [],
  outputMode: 'preview_only',
}

const noAmountContract: PayrollAdaptiveModelContract = {
  ...matchingContract,
  fieldMappings: [
    { sheetName: 'Sheet1', sourceColumn: '성명', targetField: 'employeeName', required: true, dataType: 'text' },
    { sheetName: 'Sheet1', sourceColumn: '지급월', targetField: 'payrollMonth', required: true, dataType: 'date' },
  ],
}

const matchingFileTexts: PayrollSourceText[] = [
  { filename: '워크북.xlsx', sheetName: 'Sheet1', text: '1: 성명 | 지급월 | 기본급\n2: 홍길동 | 2026-06 | 3,000,000', summary: null },
]

const nonMatchingFileTexts: PayrollSourceText[] = [
  { filename: '워크북.xlsx', sheetName: 'OtherSheet', text: '1: 거래처 | 품목\n2: A상사 | 노트북', summary: null },
]

async function insertApprovedModel(params: {
  id: string
  tenantId: string
  contract: PayrollAdaptiveModelContract
  sourceUploadSessionId?: string
}) {
  await testDb.insert(adaptiveStructureModel).values({
    id: params.id,
    tenantId: params.tenantId,
    name: 'test model',
    targetWorkflow: 'payroll',
    sourceClassification: 'business_data',
    status: 'approved',
    engineVersion: 'payroll-common-engine-v1',
    modelVersion: 1,
    modelJson: JSON.stringify(params.contract),
    sampleRowsPreviewJson: '[]',
    validationSummaryJson: '{}',
    promptVersion: 'v1',
    sourceUploadSessionId: params.sourceUploadSessionId ?? 'source-session-1',
    sourceUploadFileIds: '[]',
    createdByStaffId: 'staff-1',
    createdAt: '2026-06-20T00:00:00.000+09:00',
    updatedAt: '2026-06-20T00:00:00.000+09:00',
    approvedAt: '2026-06-20T00:00:00.000+09:00',
  })
}

describe('findApprovedPayrollAdaptiveModelMatch', () => {
  it('returns none when there are no approved models', async () => {
    const result = await findApprovedPayrollAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result).toEqual({ kind: 'none' })
  })

  it('ignores models that are not approved (proposed/rejected/retired)', async () => {
    await testDb.insert(adaptiveStructureModel).values({
      id: 'model-proposed',
      tenantId: 'tenant-1',
      name: 'test',
      targetWorkflow: 'payroll',
      sourceClassification: 'business_data',
      status: 'proposed',
      engineVersion: 'v1',
      modelVersion: 1,
      modelJson: JSON.stringify(matchingContract),
      sampleRowsPreviewJson: '[]',
      validationSummaryJson: '{}',
      promptVersion: 'v1',
      sourceUploadSessionId: 'source-session-1',
      sourceUploadFileIds: '[]',
      createdByStaffId: 'staff-1',
      createdAt: '2026-06-20T00:00:00.000+09:00',
      updatedAt: '2026-06-20T00:00:00.000+09:00',
    })

    const result = await findApprovedPayrollAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result).toEqual({ kind: 'none' })
  })

  it('ignores approved models belonging to a different tenant', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-a', contract: matchingContract })

    const result = await findApprovedPayrollAdaptiveModelMatch({ tenantId: 'tenant-b', fileTexts: matchingFileTexts })
    expect(result).toEqual({ kind: 'none' })
  })

  it('matches a single approved model whose signature matches the workbook', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })

    const result = await findApprovedPayrollAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result.kind).toBe('matched')
  })

  it('returns ambiguous when two approved models both match the workbook', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })
    await insertApprovedModel({ id: 'model-2', tenantId: 'tenant-1', contract: matchingContract })

    const result = await findApprovedPayrollAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result.kind).toBe('ambiguous')
    if (result.kind === 'ambiguous') {
      expect(result.matchedModelIds.sort()).toEqual(['model-1', 'model-2'])
    }
  })

  it('fails closed (skips) a model whose stored model_json is corrupted', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })
    await testDb.update(adaptiveStructureModel).set({ modelJson: 'not valid json' })

    const result = await findApprovedPayrollAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result).toEqual({ kind: 'none' })
  })
})

describe('applyApprovedPayrollAdaptiveModel', () => {
  it('returns null without recording a run when nothing matches', async () => {
    const result = await applyApprovedPayrollAdaptiveModel({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      payrollPeriod: '2026-06',
      fileTexts: nonMatchingFileTexts,
    })

    expect(result).toBeNull()
    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs).toHaveLength(0)
  })

  it('records a failed run with ambiguous_model_match and applies nothing when two models match', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })
    await insertApprovedModel({ id: 'model-2', tenantId: 'tenant-1', contract: matchingContract })

    const result = await applyApprovedPayrollAdaptiveModel({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      payrollPeriod: '2026-06',
      fileTexts: matchingFileTexts,
    })

    expect(result).toBeNull()
    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ status: 'failed', modelId: null, errorMessage: 'ambiguous_model_match' })
  })

  it('records extraction_blocked and applies nothing when the model does not have a payable amount field', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: noAmountContract })

    const result = await applyApprovedPayrollAdaptiveModel({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      payrollPeriod: '2026-06',
      fileTexts: matchingFileTexts,
    })

    expect(result).toBeNull()
    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs[0]).toMatchObject({ status: 'extraction_blocked', modelId: 'model-1' })
  })

  it('applies the matched model and always marks rows needs_review with the model version in memo', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })

    const result = await applyApprovedPayrollAdaptiveModel({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      payrollPeriod: '2026-06',
      fileTexts: matchingFileTexts,
    })

    expect(result?.success).toBe(true)
    const row = result?.data.rows[0]
    expect(row?.employeeName).toBe('홍길동')
    expect(row?.baseSalary).toBe(3000000)
    expect(row?.aiVerdict).toBe('fail')
    expect(row?.memo).toContain('model-1')
    expect(row?.memo).toContain('v1')

    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs[0]).toMatchObject({ status: 'needs_review', modelId: 'model-1', matchedRowCount: 1 })
  })

  it('does not store the resident/internal key value anywhere in the produced row', async () => {
    const contractWithIdentity: PayrollAdaptiveModelContract = {
      ...matchingContract,
      fieldMappings: [
        ...matchingContract.fieldMappings,
        { sheetName: 'Sheet1', sourceColumn: '주민번호', targetField: 'residentOrInternalKey', required: false, dataType: 'identifier' },
      ],
    }
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: contractWithIdentity })

    const fileTextsWithResidentNumber: PayrollSourceText[] = [
      {
        filename: '워크북.xlsx',
        sheetName: 'Sheet1',
        text: '1: 성명 | 지급월 | 기본급 | 주민번호\n2: 홍길동 | 2026-06 | 3,000,000 | 901231-1234567',
        summary: null,
      },
    ]

    const result = await applyApprovedPayrollAdaptiveModel({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      payrollPeriod: '2026-06',
      fileTexts: fileTextsWithResidentNumber,
    })

    const row = result?.data.rows[0]
    expect(JSON.stringify(row)).not.toContain('901231')
  })

  it('rejects a row whose only identity signal is residentOrInternalKey (never persisted, so the row would otherwise have no name/code)', async () => {
    const identityViaResidentKeyOnlyContract: PayrollAdaptiveModelContract = {
      ...matchingContract,
      workbookSignature: {
        ...matchingContract.workbookSignature,
        requiredHeaderLabels: ['주민번호', '지급월'],
      },
      fieldMappings: [
        { sheetName: 'Sheet1', sourceColumn: '주민번호', targetField: 'residentOrInternalKey', required: true, dataType: 'identifier' },
        { sheetName: 'Sheet1', sourceColumn: '지급월', targetField: 'payrollMonth', required: true, dataType: 'date' },
        { sheetName: 'Sheet1', sourceColumn: '기본급', targetField: 'baseSalary', required: false, dataType: 'amount' },
      ],
    }
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: identityViaResidentKeyOnlyContract })

    const fileTexts: PayrollSourceText[] = [
      {
        filename: '워크북.xlsx',
        sheetName: 'Sheet1',
        text: '1: 주민번호 | 지급월 | 기본급\n2: 901231-1234567 | 2026-06 | 3,000,000',
        summary: null,
      },
    ]

    const result = await applyApprovedPayrollAdaptiveModel({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      payrollPeriod: '2026-06',
      fileTexts,
    })

    expect(result).toBeNull()
    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs[0]).toMatchObject({ status: 'extraction_blocked', modelId: 'model-1', matchedRowCount: 0 })
  })

  it('rejects a row whose only amount signal is fixedAllowance/monthlyFixedPay (no row column, so it would otherwise have no numeric amount at all)', async () => {
    const fixedAllowanceOnlyContract: PayrollAdaptiveModelContract = {
      ...matchingContract,
      fieldMappings: [
        { sheetName: 'Sheet1', sourceColumn: '성명', targetField: 'employeeName', required: true, dataType: 'text' },
        { sheetName: 'Sheet1', sourceColumn: '지급월', targetField: 'payrollMonth', required: true, dataType: 'date' },
        { sheetName: 'Sheet1', sourceColumn: '고정수당', targetField: 'fixedAllowance', required: false, dataType: 'amount' },
      ],
    }
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: fixedAllowanceOnlyContract })

    const fileTexts: PayrollSourceText[] = [
      {
        filename: '워크북.xlsx',
        sheetName: 'Sheet1',
        text: '1: 성명 | 지급월 | 고정수당\n2: 홍길동 | 2026-06 | 500,000',
        summary: null,
      },
    ]

    const result = await applyApprovedPayrollAdaptiveModel({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      payrollPeriod: '2026-06',
      fileTexts,
    })

    expect(result).toBeNull()
    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs[0]).toMatchObject({ status: 'extraction_blocked', modelId: 'model-1', matchedRowCount: 0 })
  })
})
