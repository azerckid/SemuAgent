import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'
import type { ReviewAdaptiveSourceText } from '@/lib/ai/review-adaptive-structuring-propose'
import type { ReviewAdaptiveModelContract } from './adaptive-structuring-model-contract'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

const collectMocks = vi.hoisted(() => ({
  extractTransactionCandidates: vi.fn(),
  extractDocumentTextChunks: vi.fn(),
}))

vi.mock('@/lib/bookkeeping/transaction-extraction', () => ({
  extractTransactionCandidates: collectMocks.extractTransactionCandidates,
}))
vi.mock('@/lib/ai/extract', () => ({
  extractDocumentTextChunks: collectMocks.extractDocumentTextChunks,
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
  findApprovedReviewAdaptiveModelMatch,
  applyApprovedReviewAdaptiveModelForFile,
  collectTransactionCandidatesForFile,
} = await import('./adaptive-structuring-apply')

const matchingContract: ReviewAdaptiveModelContract = {
  targetWorkflow: 'bookkeeping',
  reviewModelType: 'transaction_detail',
  workbookSignature: {
    sheetNamePatterns: ['Sheet1'],
    requiredHeaderLabels: ['거래일자', '금액'],
    optionalHeaderLabels: ['거래처'],
    headerRowCandidates: [],
  },
  fieldMappings: [
    { sheetName: 'Sheet1', sourceColumn: '거래일자', targetField: 'transactionDate', required: true, dataType: 'date' },
    { sheetName: 'Sheet1', sourceColumn: '거래처', targetField: 'counterparty', required: false, dataType: 'text' },
    { sheetName: 'Sheet1', sourceColumn: '금액', targetField: 'amountKrw', required: false, dataType: 'amount' },
  ],
  ignoredRegions: [],
  validationRules: [],
  outputMode: 'preview_only',
}

const noAmountContract: ReviewAdaptiveModelContract = {
  ...matchingContract,
  workbookSignature: {
    ...matchingContract.workbookSignature,
    requiredHeaderLabels: ['거래일자'],
  },
  fieldMappings: [
    { sheetName: 'Sheet1', sourceColumn: '거래일자', targetField: 'transactionDate', required: true, dataType: 'date' },
  ],
}

const incomeExpenseContract: ReviewAdaptiveModelContract = {
  ...matchingContract,
  workbookSignature: {
    ...matchingContract.workbookSignature,
    requiredHeaderLabels: ['거래일자', '입금액', '출금액'],
  },
  fieldMappings: [
    { sheetName: 'Sheet1', sourceColumn: '거래일자', targetField: 'transactionDate', required: true, dataType: 'date' },
    { sheetName: 'Sheet1', sourceColumn: '입금액', targetField: 'incomeAmountKrw', required: false, dataType: 'amount' },
    { sheetName: 'Sheet1', sourceColumn: '출금액', targetField: 'expenseAmountKrw', required: false, dataType: 'amount' },
  ],
}

const matchingFileTexts: ReviewAdaptiveSourceText[] = [
  { filename: '정산목록.xlsx', sheetName: 'Sheet1', text: '1: 거래일자 | 거래처 | 금액\n2: 2026-06-05 | 거래처A | 320,000', summary: null },
]

const nonMatchingFileTexts: ReviewAdaptiveSourceText[] = [
  { filename: '정산목록.xlsx', sheetName: 'OtherSheet', text: '1: 품목 | 단가\n2: 노트북 | 1,200,000', summary: null },
]

async function insertApprovedModel(params: {
  id: string
  tenantId: string
  contract: ReviewAdaptiveModelContract
  targetWorkflow?: string
  sourceUploadSessionId?: string
}) {
  await testDb.insert(adaptiveStructureModel).values({
    id: params.id,
    tenantId: params.tenantId,
    name: 'test model',
    targetWorkflow: params.targetWorkflow ?? 'bookkeeping',
    sourceClassification: 'business_data',
    status: 'approved',
    engineVersion: 'review-common-engine-v1',
    modelVersion: 1,
    modelJson: JSON.stringify(params.contract),
    sampleRowsPreviewJson: '[]',
    validationSummaryJson: '{}',
    promptVersion: 'v1',
    sourceUploadSessionId: params.sourceUploadSessionId ?? 'source-session-1',
    sourceUploadFileIds: '[]',
    createdByStaffId: 'staff-1',
    createdAt: '2026-06-21T00:00:00.000+09:00',
    updatedAt: '2026-06-21T00:00:00.000+09:00',
    approvedAt: '2026-06-21T00:00:00.000+09:00',
  })
}

describe('findApprovedReviewAdaptiveModelMatch', () => {
  it('returns none when there are no approved models', async () => {
    const result = await findApprovedReviewAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result).toEqual({ kind: 'none' })
  })

  it('ignores models that are not approved (proposed/rejected/retired)', async () => {
    await testDb.insert(adaptiveStructureModel).values({
      id: 'model-proposed',
      tenantId: 'tenant-1',
      name: 'test',
      targetWorkflow: 'bookkeeping',
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
      createdAt: '2026-06-21T00:00:00.000+09:00',
      updatedAt: '2026-06-21T00:00:00.000+09:00',
    })

    const result = await findApprovedReviewAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result).toEqual({ kind: 'none' })
  })

  it('ignores approved models belonging to a different tenant', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-a', contract: matchingContract })

    const result = await findApprovedReviewAdaptiveModelMatch({ tenantId: 'tenant-b', fileTexts: matchingFileTexts })
    expect(result).toEqual({ kind: 'none' })
  })

  // Regression guard for the cross-workflow id-confusion class of bug fixed in Slice 4:
  // a payroll model approved in the same tenant must never be picked up by the review
  // apply path even if its signature happens to match the workbook.
  it('ignores an approved model belonging to the payroll workflow in the same tenant', async () => {
    await insertApprovedModel({ id: 'payroll-model-1', tenantId: 'tenant-1', contract: matchingContract, targetWorkflow: 'payroll' })

    const result = await findApprovedReviewAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result).toEqual({ kind: 'none' })
  })

  it('matches a single approved model whose signature matches the workbook', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })

    const result = await findApprovedReviewAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result.kind).toBe('matched')
  })

  it('returns ambiguous when two approved models both match the workbook', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })
    await insertApprovedModel({ id: 'model-2', tenantId: 'tenant-1', contract: matchingContract })

    const result = await findApprovedReviewAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result.kind).toBe('ambiguous')
    if (result.kind === 'ambiguous') {
      expect(result.matchedModelIds.sort()).toEqual(['model-1', 'model-2'])
    }
  })

  it('fails closed (skips) a model whose stored model_json is corrupted', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })
    await testDb.update(adaptiveStructureModel).set({ modelJson: 'not valid json' })

    const result = await findApprovedReviewAdaptiveModelMatch({ tenantId: 'tenant-1', fileTexts: matchingFileTexts })
    expect(result).toEqual({ kind: 'none' })
  })
})

const file = { id: 'file-1', originalFilename: '정산목록.xlsx' }

describe('applyApprovedReviewAdaptiveModelForFile', () => {
  it('returns null without recording a run when nothing matches', async () => {
    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts: nonMatchingFileTexts,
    })

    expect(result).toBeNull()
    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs).toHaveLength(0)
  })

  it('records a failed run with ambiguous_model_match and applies nothing when two models match', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })
    await insertApprovedModel({ id: 'model-2', tenantId: 'tenant-1', contract: matchingContract })

    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts: matchingFileTexts,
    })

    expect(result).toBeNull()
    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ status: 'failed', modelId: null, errorMessage: 'ambiguous_model_match' })
  })

  it('records extraction_blocked and applies nothing when the model has no date/amount field', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: noAmountContract })

    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts: matchingFileTexts,
    })

    expect(result).toBeNull()
    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs[0]).toMatchObject({ status: 'extraction_blocked', modelId: 'model-1' })
  })

  it('applies the matched model with direction=unknown when only a single generic amount column exists', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })

    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts: matchingFileTexts,
    })

    expect(result).not.toBeNull()
    const candidate = result?.[0]
    expect(candidate?.amountKrw).toBe(320000)
    expect(candidate?.direction).toBe('unknown')
    expect(candidate?.merchantName).toBe('거래처A')
    expect(candidate?.description).toContain('model-1')
    expect(candidate?.description).toContain('v1')

    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs[0]).toMatchObject({ status: 'needs_review', modelId: 'model-1', matchedRowCount: 1 })
  })

  it('does not guess direction from wording when the column structure is a single amount column', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })

    const fileTextsWithExpenseWording: ReviewAdaptiveSourceText[] = [
      { filename: '정산목록.xlsx', sheetName: 'Sheet1', text: '1: 거래일자 | 거래처 | 금액\n2: 2026-06-05 | 지출처A | 320,000', summary: null },
    ]

    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts: fileTextsWithExpenseWording,
    })

    expect(result?.[0]?.direction).toBe('unknown')
  })

  it('sets direction=income when the income amount column has a value', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: incomeExpenseContract })

    const fileTexts: ReviewAdaptiveSourceText[] = [
      { filename: '정산목록.xlsx', sheetName: 'Sheet1', text: '1: 거래일자 | 입금액 | 출금액\n2: 2026-06-05 | 320,000 | ', summary: null },
    ]

    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts,
    })

    expect(result?.[0]?.direction).toBe('income')
    expect(result?.[0]?.amountKrw).toBe(320000)
  })

  it('sets direction=expense when the expense amount column has a value', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: incomeExpenseContract })

    const fileTexts: ReviewAdaptiveSourceText[] = [
      { filename: '정산목록.xlsx', sheetName: 'Sheet1', text: '1: 거래일자 | 입금액 | 출금액\n2: 2026-06-05 |  | 150,000', summary: null },
    ]

    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts,
    })

    expect(result?.[0]?.direction).toBe('expense')
    expect(result?.[0]?.amountKrw).toBe(150000)
  })

  // P1 regression guard: bank/settlement workbooks commonly fill the unused
  // income/expense column with an explicit 0 instead of leaving it blank. Treating
  // 0 as "has a value" picks the wrong column (income=0, expense=150,000 would
  // otherwise become direction=income, amountKrw=0).
  it('sets direction=expense (not income) when the income column is an explicit 0 and the expense column has the real value', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: incomeExpenseContract })

    const fileTexts: ReviewAdaptiveSourceText[] = [
      { filename: '정산목록.xlsx', sheetName: 'Sheet1', text: '1: 거래일자 | 입금액 | 출금액\n2: 2026-06-05 | 0 | 150,000', summary: null },
    ]

    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts,
    })

    expect(result?.[0]?.direction).toBe('expense')
    expect(result?.[0]?.amountKrw).toBe(150000)
  })

  it('blocks a row where both income and expense are explicit 0 instead of producing a zero-amount candidate', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: incomeExpenseContract })

    const fileTexts: ReviewAdaptiveSourceText[] = [
      {
        filename: '정산목록.xlsx',
        sheetName: 'Sheet1',
        text: [
          '1: 거래일자 | 입금액 | 출금액',
          '2: 2026-06-05 | 0 | 0',
          '3: 2026-06-06 | 320,000 | 0',
        ].join('\n'),
        summary: null,
      },
    ]

    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts,
    })

    expect(result).toHaveLength(1)
    expect(result?.[0]?.direction).toBe('income')
    expect(result?.[0]?.amountKrw).toBe(320000)

    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs[0]).toMatchObject({ matchedRowCount: 1, blockedRowCount: 1 })
  })

  it('blocks a row where both income and expense have non-zero values (ambiguous) instead of guessing', async () => {
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: incomeExpenseContract })

    const fileTexts: ReviewAdaptiveSourceText[] = [
      {
        filename: '정산목록.xlsx',
        sheetName: 'Sheet1',
        text: [
          '1: 거래일자 | 입금액 | 출금액',
          '2: 2026-06-05 | 320,000 | 150,000',
        ].join('\n'),
        summary: null,
      },
    ]

    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts,
    })

    expect(result).toBeNull()
    const runs = await testDb.select().from(adaptiveStructureModelRun)
    expect(runs[0]).toMatchObject({ status: 'extraction_blocked', modelId: 'model-1', matchedRowCount: 0 })
  })

  it('does not store resident/phone/account-number-shaped values anywhere in the produced candidate', async () => {
    const contractWithMemo: ReviewAdaptiveModelContract = {
      ...matchingContract,
      fieldMappings: [
        ...matchingContract.fieldMappings,
        { sheetName: 'Sheet1', sourceColumn: '비고', targetField: 'memo', required: false, dataType: 'memo' },
      ],
    }
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: contractWithMemo })

    const fileTextsWithPii: ReviewAdaptiveSourceText[] = [
      {
        filename: '정산목록.xlsx',
        sheetName: 'Sheet1',
        text: '1: 거래일자 | 거래처 | 금액 | 비고\n2: 2026-06-05 | 거래처A | 320,000 | 901231-1234567',
        summary: null,
      },
    ]

    const result = await applyApprovedReviewAdaptiveModelForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file,
      fileTexts: fileTextsWithPii,
    })

    expect(JSON.stringify(result)).not.toContain('901231')
  })
})

describe('collectTransactionCandidatesForFile', () => {
  const collectFile = { id: 'file-1', originalFilename: '정산목록.xlsx', fileType: 'excel' }
  const buffer = new ArrayBuffer(8)

  beforeEach(() => {
    collectMocks.extractTransactionCandidates.mockReset()
    collectMocks.extractDocumentTextChunks.mockReset()
  })

  it('returns the rule-based candidates and never tries the adaptive model when the rule extractor already found rows', async () => {
    const ruleCandidates = [{
      sourceFileId: 'file-1',
      sourceFilename: '정산목록.xlsx',
      sourceType: 'bank' as const,
      direction: 'unknown' as const,
      rawRow: [],
    }]
    collectMocks.extractTransactionCandidates.mockReturnValue(ruleCandidates)

    const result = await collectTransactionCandidatesForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file: collectFile,
      buffer,
    })

    expect(result).toBe(ruleCandidates)
    expect(collectMocks.extractDocumentTextChunks).not.toHaveBeenCalled()
  })

  it('falls back to the approved adaptive model when the rule extractor finds nothing for this file', async () => {
    collectMocks.extractTransactionCandidates.mockReturnValue([])
    collectMocks.extractDocumentTextChunks.mockResolvedValue([
      { text: '1: 거래일자 | 거래처 | 금액\n2: 2026-06-05 | 거래처A | 320,000', summary: null, sheetName: 'Sheet1' },
    ])
    await insertApprovedModel({ id: 'model-1', tenantId: 'tenant-1', contract: matchingContract })

    const result = await collectTransactionCandidatesForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file: collectFile,
      buffer,
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.merchantName).toBe('거래처A')
    expect(collectMocks.extractDocumentTextChunks).toHaveBeenCalledWith(expect.objectContaining({ profile: 'review' }))
  })

  it('returns an empty array (current behavior, no regression) when both the rule extractor and the adaptive model find nothing', async () => {
    collectMocks.extractTransactionCandidates.mockReturnValue([])
    collectMocks.extractDocumentTextChunks.mockResolvedValue([
      { text: '1: 품목 | 단가\n2: 노트북 | 1,200,000', summary: null, sheetName: 'OtherSheet' },
    ])

    const result = await collectTransactionCandidatesForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file: collectFile,
      buffer,
    })

    expect(result).toEqual([])
  })

  it('returns an empty array when the rule extractor finds nothing and the file has no readable text at all', async () => {
    collectMocks.extractTransactionCandidates.mockReturnValue([])
    collectMocks.extractDocumentTextChunks.mockResolvedValue([{ text: null, summary: '파일 처리 중 오류 발생' }])

    const result = await collectTransactionCandidatesForFile({
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      file: collectFile,
      buffer,
    })

    expect(result).toEqual([])
  })
})
