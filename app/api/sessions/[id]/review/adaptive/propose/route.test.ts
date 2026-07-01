import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  loadReviewAdaptiveStructuringEligibilityContext: vi.fn(),
  blobGet: vi.fn(),
  extractDocumentTextChunks: vi.fn(),
  generateReviewAdaptiveStructuringProposal: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireTenantSession: mocks.requireTenantSession }))
vi.mock('@/lib/reviews/adaptive-structuring-eligibility-context', () => ({
  loadReviewAdaptiveStructuringEligibilityContext: mocks.loadReviewAdaptiveStructuringEligibilityContext,
}))
vi.mock('@vercel/blob', () => ({ get: mocks.blobGet }))
vi.mock('@/lib/ai/extract', () => ({ extractDocumentTextChunks: mocks.extractDocumentTextChunks }))
vi.mock('@/lib/ai/review-adaptive-structuring-propose', () => ({
  generateReviewAdaptiveStructuringProposal: mocks.generateReviewAdaptiveStructuringProposal,
}))

const { POST } = await import('./route')

function postRequest() {
  return new Request('http://localhost/api/sessions/session-1/review/adaptive/propose', { method: 'POST' })
}

function callRoute() {
  return POST(postRequest(), { params: Promise.resolve({ id: 'session-1' }) })
}

const sourceFile = {
  id: 'file-1',
  originalFilename: '정산목록.xlsx',
  fileType: 'excel' as const,
  storageKey: 'blob-key-1',
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.loadReviewAdaptiveStructuringEligibilityContext.mockReset()
  mocks.blobGet.mockReset()
  mocks.extractDocumentTextChunks.mockReset()
  mocks.generateReviewAdaptiveStructuringProposal.mockReset()
  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'user-1' }, tenantId: 'tenant-1' })
})

describe('POST /api/sessions/[id]/review/adaptive/propose', () => {
  it('returns 404 when the session cannot be found for this tenant', async () => {
    mocks.loadReviewAdaptiveStructuringEligibilityContext.mockResolvedValue(null)

    const response = await callRoute()
    expect(response.status).toBe(404)
    expect(mocks.blobGet).not.toHaveBeenCalled()
  })

  it('returns not_eligible without touching blob storage or AI when the server recomputes ineligible', async () => {
    mocks.loadReviewAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: { eligible: false, reason: '구조화 후보 없음', candidateFiles: [], blockedFiles: [] },
    })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.proposal.status).toBe('not_eligible')
    expect(body.proposal.reason).toBe('구조화 후보 없음')
    expect(body.enginePreview).toBeUndefined()
    expect(mocks.blobGet).not.toHaveBeenCalled()
    expect(mocks.generateReviewAdaptiveStructuringProposal).not.toHaveBeenCalled()
  })

  it('fetches blobs, extracts text, and generates a proposal when eligible', async () => {
    mocks.loadReviewAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: {
        eligible: true,
        reason: '기존 자료검토에서 자동 연결되지 않은 표 형태 후보가 있습니다.',
        candidateFiles: [{ id: 'file-1', originalFilename: '정산목록.xlsx', fileType: 'excel', detectedRole: 'business_data_candidate', reason: '' }],
        blockedFiles: [],
      },
    })
    mocks.blobGet.mockResolvedValue({
      statusCode: 200,
      stream: new Response('binary').body,
    })
    mocks.extractDocumentTextChunks.mockResolvedValue([
      { text: '1: 거래일자 | 금액\n2: 2026-06-05 | 320000', summary: null, sheetName: 'Sheet1' },
    ])
    mocks.generateReviewAdaptiveStructuringProposal.mockResolvedValue({
      provider: 'claude',
      data: { status: 'proposal_ready', reason: '제안 가능', candidateSheets: [], proposedMappings: [], sampleRows: [], ignoredRegions: [], missingRequiredFields: [], warnings: [] },
    })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.provider).toBe('claude')
    expect(body.proposal.status).toBe('proposal_ready')
    expect(mocks.generateReviewAdaptiveStructuringProposal).toHaveBeenCalledTimes(1)
    const [readableFileTexts] = mocks.generateReviewAdaptiveStructuringProposal.mock.calls[0]
    expect(readableFileTexts).toEqual([
      expect.objectContaining({ filename: '정산목록.xlsx', sheetName: 'Sheet1' }),
    ])
    // 매핑이 없는 제안이라 엔진으로 변환할 contract가 없다 — null이어야 한다.
    expect(body.enginePreview).toBeNull()
  })

  it('re-runs the proposed mapping through the deterministic engine and includes enginePreview', async () => {
    mocks.loadReviewAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: {
        eligible: true,
        reason: '기존 자료검토에서 자동 연결되지 않은 표 형태 후보가 있습니다.',
        candidateFiles: [{ id: 'file-1', originalFilename: '정산목록.xlsx', fileType: 'excel', detectedRole: 'business_data_candidate', reason: '' }],
        blockedFiles: [],
      },
    })
    mocks.blobGet.mockResolvedValue({ statusCode: 200, stream: new Response('binary').body })
    mocks.extractDocumentTextChunks.mockResolvedValue([
      { text: '1: 거래일자 | 거래처 | 금액\n2: 2026-06-05 | 거래처A | 320,000', summary: null, sheetName: 'Sheet1' },
    ])
    mocks.generateReviewAdaptiveStructuringProposal.mockResolvedValue({
      provider: 'claude',
      data: {
        status: 'proposal_ready',
        reason: '제안 가능',
        candidateSheets: [{ sheetName: 'Sheet1', role: 'transaction_detail', confidence: 0.8 }],
        proposedMappings: [
          { sheetName: 'Sheet1', sourceColumn: '거래일자', targetField: 'transactionDate', required: true, confidence: 'high' },
          { sheetName: 'Sheet1', sourceColumn: '거래처', targetField: 'counterparty', required: false, confidence: 'high' },
          { sheetName: 'Sheet1', sourceColumn: '금액', targetField: 'amountKrw', required: false, confidence: 'medium' },
        ],
        sampleRows: [],
        ignoredRegions: [],
        missingRequiredFields: [],
        warnings: [],
      },
    })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.enginePreview).not.toBeNull()
    expect(body.enginePreview.matched).toBe(true)
    expect(body.enginePreview.standardRows).toHaveLength(1)
    expect(body.enginePreview.standardRows[0].values.counterparty).toBe('거래처A')
  })

  it('reports enginePreview.matched=false separately from a proposal_ready AI status when the workbook signature does not match', async () => {
    mocks.loadReviewAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: {
        eligible: true,
        reason: '기존 자료검토에서 자동 연결되지 않은 표 형태 후보가 있습니다.',
        candidateFiles: [{ id: 'file-1', originalFilename: '정산목록.xlsx', fileType: 'excel', detectedRole: 'business_data_candidate', reason: '' }],
        blockedFiles: [],
      },
    })
    mocks.blobGet.mockResolvedValue({ statusCode: 200, stream: new Response('binary').body })
    // 시트명이 제안과 다르게 추출됨 — 엔진 signature match가 실패해야 한다.
    mocks.extractDocumentTextChunks.mockResolvedValue([
      { text: '1: 거래일자 | 거래처 | 금액\n2: 2026-06-05 | 거래처A | 320,000', summary: null, sheetName: 'Sheet9' },
    ])
    mocks.generateReviewAdaptiveStructuringProposal.mockResolvedValue({
      provider: 'claude',
      data: {
        status: 'proposal_ready',
        reason: '제안 가능',
        candidateSheets: [{ sheetName: 'Sheet1', role: 'transaction_detail', confidence: 0.8 }],
        proposedMappings: [
          { sheetName: 'Sheet1', sourceColumn: '거래일자', targetField: 'transactionDate', required: true, confidence: 'high' },
          { sheetName: 'Sheet1', sourceColumn: '금액', targetField: 'amountKrw', required: false, confidence: 'medium' },
        ],
        sampleRows: [],
        ignoredRegions: [],
        missingRequiredFields: [],
        warnings: [],
      },
    })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.proposal.status).toBe('proposal_ready')
    expect(body.enginePreview).not.toBeNull()
    expect(body.enginePreview.matched).toBe(false)
    expect(body.enginePreview.standardRows).toEqual([])
  })

  it('returns needs_more_information without calling AI when no file text could be read', async () => {
    mocks.loadReviewAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: {
        eligible: true,
        reason: '기존 자료검토에서 자동 연결되지 않은 표 형태 후보가 있습니다.',
        candidateFiles: [{ id: 'file-1', originalFilename: '정산목록.xlsx', fileType: 'excel', detectedRole: 'business_data_candidate', reason: '' }],
        blockedFiles: [],
      },
    })
    mocks.blobGet.mockResolvedValue({ statusCode: 404, stream: null })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.proposal.status).toBe('needs_more_information')
    expect(mocks.generateReviewAdaptiveStructuringProposal).not.toHaveBeenCalled()
  })
})
