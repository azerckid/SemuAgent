import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

const mocks = vi.hoisted(() => ({
  loadReviewAdaptiveStructuringEligibilityContext: vi.fn(),
  generateReviewAdaptiveStructuringProposal: vi.fn(),
  blobGet: vi.fn(),
  extractDocumentTextChunks: vi.fn(),
}))

vi.mock('@/lib/reviews/adaptive-structuring-eligibility-context', () => ({
  loadReviewAdaptiveStructuringEligibilityContext: mocks.loadReviewAdaptiveStructuringEligibilityContext,
}))
vi.mock('@/lib/ai/review-adaptive-structuring-propose', () => ({
  generateReviewAdaptiveStructuringProposal: mocks.generateReviewAdaptiveStructuringProposal,
  REVIEW_ADAPTIVE_STRUCTURING_PROMPT_VERSION: 'review-adaptive-structuring-v1',
}))
vi.mock('@vercel/blob', () => ({ get: mocks.blobGet }))
vi.mock('@/lib/ai/extract', () => ({ extractDocumentTextChunks: mocks.extractDocumentTextChunks }))

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
})

beforeEach(async () => {
  await client.execute('DELETE FROM adaptive_structure_model')
  mocks.loadReviewAdaptiveStructuringEligibilityContext.mockReset()
  mocks.generateReviewAdaptiveStructuringProposal.mockReset()
  mocks.blobGet.mockReset()
  mocks.extractDocumentTextChunks.mockReset()
})

const { adaptiveStructureModel } = appSchema
const {
  createProposedReviewAdaptiveModel,
  approveReviewAdaptiveModel,
  rejectReviewAdaptiveModel,
  retireReviewAdaptiveModel,
  listReviewAdaptiveModels,
} = await import('./adaptive-structuring-registry')

const sourceFile = { id: 'file-1', originalFilename: '정산목록.xlsx', fileType: 'excel', storageKey: 'blob-key-1' }

const readyProposal = {
  status: 'proposal_ready' as const,
  reason: '제안 가능',
  candidateSheets: [{ sheetName: 'Sheet1', role: 'transaction_detail' as const, confidence: 0.8 }],
  proposedMappings: [
    { sheetName: 'Sheet1', sourceColumn: '거래일자', targetField: 'transactionDate' as const, required: true, confidence: 'high' as const },
    { sheetName: 'Sheet1', sourceColumn: '금액', targetField: 'amountKrw' as const, required: false, confidence: 'high' as const },
  ],
  sampleRows: [],
  ignoredRegions: [],
  missingRequiredFields: [],
  warnings: [],
}

function mockEligibleContextWithMatchingWorkbook() {
  mocks.loadReviewAdaptiveStructuringEligibilityContext.mockResolvedValue({
    session: { id: 'session-1' },
    sourceFiles: [sourceFile],
    eligibility: { eligible: true, reason: '적격', candidateFiles: [], blockedFiles: [] },
  })
  // mockResolvedValue would share the same (already-consumed) stream across repeated
  // calls in idempotency tests; mockImplementation gives each call a fresh Response body.
  mocks.blobGet.mockImplementation(async () => ({ statusCode: 200, stream: new Response('binary').body }))
  mocks.extractDocumentTextChunks.mockResolvedValue([
    { text: '1: 거래일자 | 금액\n2: 2026-06-05 | 320000', summary: null, sheetName: 'Sheet1' },
  ])
  mocks.generateReviewAdaptiveStructuringProposal.mockResolvedValue({ provider: 'claude', data: readyProposal })
}

describe('createProposedReviewAdaptiveModel', () => {
  it('persists a proposed model when the engine confirms the proposal matches the workbook', async () => {
    mockEligibleContextWithMatchingWorkbook()

    const result = await createProposedReviewAdaptiveModel({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: result.modelId,
      tenantId: 'tenant-1',
      targetWorkflow: 'bookkeeping',
      status: 'proposed',
      createdByStaffId: 'staff-1',
    })
    expect(JSON.parse(rows[0]!.modelJson).outputMode).toBe('preview_only')
  })

  it('is idempotent: registering the same session twice returns the same modelId without a second AI call or a second row', async () => {
    mockEligibleContextWithMatchingWorkbook()

    const first = await createProposedReviewAdaptiveModel({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })
    const second = await createProposedReviewAdaptiveModel({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    if (!first.success || !second.success) return
    expect(second.modelId).toBe(first.modelId)
    expect(mocks.generateReviewAdaptiveStructuringProposal).toHaveBeenCalledTimes(1)

    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows).toHaveLength(1)
  })

  it('is idempotent against an already-approved model for the same session (does not create a second active model)', async () => {
    mockEligibleContextWithMatchingWorkbook()
    const first = await createProposedReviewAdaptiveModel({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })
    if (!first.success) throw new Error('setup failed')
    await testDb.update(adaptiveStructureModel)
      .set({ status: 'approved' })
      .where(eq(adaptiveStructureModel.id, first.modelId))

    const second = await createProposedReviewAdaptiveModel({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })

    expect(second).toEqual({ success: true, modelId: first.modelId })
    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows).toHaveLength(1)
  })

  it('allows a new registration when the previous model for the same session was rejected (not an active state)', async () => {
    mockEligibleContextWithMatchingWorkbook()
    const first = await createProposedReviewAdaptiveModel({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })
    if (!first.success) throw new Error('setup failed')
    await testDb.update(adaptiveStructureModel)
      .set({ status: 'rejected' })
      .where(eq(adaptiveStructureModel.id, first.modelId))

    const second = await createProposedReviewAdaptiveModel({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })

    expect(second.success).toBe(true)
    if (!second.success) return
    expect(second.modelId).not.toBe(first.modelId)
    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows).toHaveLength(2)
  })

  it('does not persist anything when the server recomputes ineligible', async () => {
    mocks.loadReviewAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: { eligible: false, reason: '구조화 후보 없음', candidateFiles: [], blockedFiles: [] },
    })

    const result = await createProposedReviewAdaptiveModel({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })

    expect(result).toEqual({ success: false, status: 400, error: '구조화 후보 없음' })
    expect(mocks.blobGet).not.toHaveBeenCalled()
    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows).toHaveLength(0)
  })

  it('does not persist anything when the engine fails to match the workbook', async () => {
    mocks.loadReviewAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: { eligible: true, reason: '적격', candidateFiles: [], blockedFiles: [] },
    })
    mocks.blobGet.mockResolvedValue({ statusCode: 200, stream: new Response('binary').body })
    mocks.extractDocumentTextChunks.mockResolvedValue([
      { text: '1: 품목 | 단가\n2: 노트북 | 1200000', summary: null, sheetName: 'Sheet2' },
    ])
    mocks.generateReviewAdaptiveStructuringProposal.mockResolvedValue({ provider: 'claude', data: readyProposal })

    const result = await createProposedReviewAdaptiveModel({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })

    expect(result.success).toBe(false)
    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows).toHaveLength(0)
  })

  it('does not persist anything when the AI proposal itself is not proposal_ready', async () => {
    mockEligibleContextWithMatchingWorkbook()
    mocks.generateReviewAdaptiveStructuringProposal.mockResolvedValue({
      provider: null,
      data: { ...readyProposal, status: 'needs_more_information', candidateSheets: [], proposedMappings: [] },
    })

    const result = await createProposedReviewAdaptiveModel({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })

    expect(result.success).toBe(false)
    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows).toHaveLength(0)
  })
})

describe('approve/reject/retire transitions', () => {
  async function insertProposedModel(tenantId: string, id = 'model-1', targetWorkflow = 'bookkeeping') {
    await testDb.insert(adaptiveStructureModel).values({
      id,
      tenantId,
      name: 'Sheet1 (transaction_detail)',
      targetWorkflow,
      sourceClassification: 'business_data',
      status: 'proposed',
      engineVersion: 'review-common-engine-v1',
      modelVersion: 1,
      modelJson: '{}',
      sampleRowsPreviewJson: '[]',
      validationSummaryJson: '{}',
      promptVersion: 'review-adaptive-structuring-v1',
      sourceUploadSessionId: 'session-1',
      sourceUploadFileIds: '["file-1"]',
      createdByStaffId: 'staff-1',
      createdAt: '2026-06-21T00:00:00.000+09:00',
      updatedAt: '2026-06-21T00:00:00.000+09:00',
    })
  }

  it('approves a proposed model and records approver/timestamp', async () => {
    await insertProposedModel('tenant-1')

    const result = await approveReviewAdaptiveModel({
      tenantId: 'tenant-1',
      modelId: 'model-1',
      approvedByStaffId: 'admin-staff-1',
    })

    expect(result.success).toBe(true)
    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows[0]).toMatchObject({
      status: 'approved',
      approvedByStaffId: 'admin-staff-1',
    })
    expect(rows[0]?.approvedAt).not.toBeNull()
  })

  it('rejects a proposed model', async () => {
    await insertProposedModel('tenant-1')

    const result = await rejectReviewAdaptiveModel({ tenantId: 'tenant-1', modelId: 'model-1' })

    expect(result.success).toBe(true)
    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows[0]?.status).toBe('rejected')
  })

  it('only lets one of two concurrent approve/reject calls on the same model win', async () => {
    await insertProposedModel('tenant-1')

    const [approveResult, rejectResult] = await Promise.all([
      approveReviewAdaptiveModel({ tenantId: 'tenant-1', modelId: 'model-1', approvedByStaffId: 'admin-staff-1' }),
      rejectReviewAdaptiveModel({ tenantId: 'tenant-1', modelId: 'model-1' }),
    ])

    const outcomes = [approveResult.success, rejectResult.success]
    expect(outcomes.filter(Boolean)).toHaveLength(1)

    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(['approved', 'rejected']).toContain(rows[0]?.status)
  })

  it('cannot approve a model that is not in proposed status', async () => {
    await insertProposedModel('tenant-1')
    await rejectReviewAdaptiveModel({ tenantId: 'tenant-1', modelId: 'model-1' })

    const result = await approveReviewAdaptiveModel({
      tenantId: 'tenant-1',
      modelId: 'model-1',
      approvedByStaffId: 'admin-staff-1',
    })

    expect(result).toMatchObject({ success: false, status: 409 })
  })

  it('retires an approved model but cannot retire one that is still only proposed', async () => {
    await insertProposedModel('tenant-1')

    const tooEarly = await retireReviewAdaptiveModel({ tenantId: 'tenant-1', modelId: 'model-1' })
    expect(tooEarly).toMatchObject({ success: false, status: 409 })

    await approveReviewAdaptiveModel({ tenantId: 'tenant-1', modelId: 'model-1', approvedByStaffId: 'admin-staff-1' })
    const result = await retireReviewAdaptiveModel({ tenantId: 'tenant-1', modelId: 'model-1' })

    expect(result.success).toBe(true)
    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows[0]?.status).toBe('retired')
  })

  it('does not let tenant B see, approve, reject, or retire tenant A models', async () => {
    await insertProposedModel('tenant-a')

    const approveResult = await approveReviewAdaptiveModel({
      tenantId: 'tenant-b',
      modelId: 'model-1',
      approvedByStaffId: 'staff-b',
    })
    const rejectResult = await rejectReviewAdaptiveModel({ tenantId: 'tenant-b', modelId: 'model-1' })
    const retireResult = await retireReviewAdaptiveModel({ tenantId: 'tenant-b', modelId: 'model-1' })
    const listResult = await listReviewAdaptiveModels({ tenantId: 'tenant-b' })

    expect(approveResult).toMatchObject({ success: false, status: 404 })
    expect(rejectResult).toMatchObject({ success: false, status: 404 })
    expect(retireResult).toMatchObject({ success: false, status: 404 })
    expect(listResult).toEqual([])
  })

  // Regression guard for the cross-workflow id-confusion bug caught in review before
  // this slice was written: adaptive_structure_model is shared by payroll and review
  // (bookkeeping). tenantId + modelId alone is not enough — a payroll model id in the
  // same tenant must not be visible or operable through the review registry functions.
  it('does not let the review registry see, approve, reject, or retire a payroll model in the same tenant', async () => {
    await insertProposedModel('tenant-1', 'payroll-model-1', 'payroll')

    const approveResult = await approveReviewAdaptiveModel({
      tenantId: 'tenant-1',
      modelId: 'payroll-model-1',
      approvedByStaffId: 'admin-staff-1',
    })
    const rejectResult = await rejectReviewAdaptiveModel({ tenantId: 'tenant-1', modelId: 'payroll-model-1' })
    const retireResult = await retireReviewAdaptiveModel({ tenantId: 'tenant-1', modelId: 'payroll-model-1' })
    const listResult = await listReviewAdaptiveModels({ tenantId: 'tenant-1' })

    expect(approveResult).toMatchObject({ success: false, status: 404 })
    expect(rejectResult).toMatchObject({ success: false, status: 404 })
    expect(retireResult).toMatchObject({ success: false, status: 404 })
    expect(listResult).toEqual([])

    const rows = await testDb.select().from(adaptiveStructureModel)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'payroll-model-1', status: 'proposed', targetWorkflow: 'payroll' })
  })
})
