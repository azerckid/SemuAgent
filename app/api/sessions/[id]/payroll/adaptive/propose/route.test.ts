import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  loadPayrollAdaptiveStructuringEligibilityContext: vi.fn(),
  blobGet: vi.fn(),
  extractDocumentTextChunks: vi.fn(),
  generatePayrollAdaptiveStructuringProposal: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireTenantSession: mocks.requireTenantSession }))
vi.mock('@/lib/payroll/adaptive-structuring-eligibility-context', () => ({
  loadPayrollAdaptiveStructuringEligibilityContext: mocks.loadPayrollAdaptiveStructuringEligibilityContext,
}))
vi.mock('@vercel/blob', () => ({ get: mocks.blobGet }))
vi.mock('@/lib/ai/extract', () => ({ extractDocumentTextChunks: mocks.extractDocumentTextChunks }))
vi.mock('@/lib/ai/payroll-adaptive-structuring-propose', () => ({
  generatePayrollAdaptiveStructuringProposal: mocks.generatePayrollAdaptiveStructuringProposal,
}))

const { POST } = await import('./route')

function postRequest() {
  return new Request('http://localhost/api/sessions/session-1/payroll/adaptive/propose', { method: 'POST' })
}

function callRoute() {
  return POST(postRequest(), { params: Promise.resolve({ id: 'session-1' }) })
}

const sourceFile = {
  id: 'file-1',
  originalFilename: '급여대장.xlsx',
  fileType: 'excel' as const,
  storageKey: 'blob-key-1',
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.loadPayrollAdaptiveStructuringEligibilityContext.mockReset()
  mocks.blobGet.mockReset()
  mocks.extractDocumentTextChunks.mockReset()
  mocks.generatePayrollAdaptiveStructuringProposal.mockReset()
  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'user-1' }, tenantId: 'tenant-1' })
})

describe('POST /api/sessions/[id]/payroll/adaptive/propose', () => {
  it('returns 404 when the session cannot be found for this tenant', async () => {
    mocks.loadPayrollAdaptiveStructuringEligibilityContext.mockResolvedValue(null)

    const response = await callRoute()
    expect(response.status).toBe(404)
    expect(mocks.blobGet).not.toHaveBeenCalled()
  })

  it('returns not_eligible without touching blob storage or AI when the server recomputes ineligible', async () => {
    mocks.loadPayrollAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: { eligible: false, reason: '검토 완료 후 가능' },
    })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.proposal.status).toBe('not_eligible')
    expect(body.proposal.reason).toBe('검토 완료 후 가능')
    expect(mocks.blobGet).not.toHaveBeenCalled()
    expect(mocks.generatePayrollAdaptiveStructuringProposal).not.toHaveBeenCalled()
  })

  it('fetches blobs, extracts text, and generates a proposal when eligible', async () => {
    mocks.loadPayrollAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: { eligible: true, reason: '급여 지급 데이터로 보이나 기존 추출기가 인식하지 못했습니다.' },
    })
    mocks.blobGet.mockResolvedValue({
      statusCode: 200,
      stream: new Response('binary').body,
    })
    mocks.extractDocumentTextChunks.mockResolvedValue([
      { text: '1: 성명 | 기본급\n2: 홍길동 | 3000000', summary: null, sheetName: 'Sheet1' },
    ])
    mocks.generatePayrollAdaptiveStructuringProposal.mockResolvedValue({
      provider: 'claude',
      data: { status: 'proposal_ready', reason: '제안 가능', candidateSheets: [], proposedMappings: [], sampleRows: [], ignoredRegions: [], missingRequiredFields: [], warnings: [] },
    })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.provider).toBe('claude')
    expect(body.proposal.status).toBe('proposal_ready')
    expect(mocks.generatePayrollAdaptiveStructuringProposal).toHaveBeenCalledTimes(1)
    const [readableFileTexts] = mocks.generatePayrollAdaptiveStructuringProposal.mock.calls[0]
    expect(readableFileTexts).toEqual([
      expect.objectContaining({ filename: '급여대장.xlsx', sheetName: 'Sheet1' }),
    ])
    // 매핑이 없는 제안이라 엔진으로 변환할 contract가 없다 — null이어야 한다.
    expect(body.enginePreview).toBeNull()
  })

  it('re-runs the proposed mapping through the deterministic engine and includes enginePreview', async () => {
    mocks.loadPayrollAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: { eligible: true, reason: '급여 지급 데이터로 보이나 기존 추출기가 인식하지 못했습니다.' },
    })
    mocks.blobGet.mockResolvedValue({ statusCode: 200, stream: new Response('binary').body })
    mocks.extractDocumentTextChunks.mockResolvedValue([
      { text: '1: 성명 | 지급월 | 기본급\n2: 홍길동 | 2026-06 | 3,000,000', summary: null, sheetName: 'Sheet1' },
    ])
    mocks.generatePayrollAdaptiveStructuringProposal.mockResolvedValue({
      provider: 'claude',
      data: {
        status: 'proposal_ready',
        reason: '제안 가능',
        candidateSheets: [{ sheetName: 'Sheet1', role: 'payroll_period_payments', confidence: 0.8 }],
        proposedMappings: [
          { sheetName: 'Sheet1', sourceColumn: '성명', targetField: 'employeeName', required: true, confidence: 'high' },
          { sheetName: 'Sheet1', sourceColumn: '지급월', targetField: 'payrollMonth', required: true, confidence: 'high' },
          { sheetName: 'Sheet1', sourceColumn: '기본급', targetField: 'baseSalary', required: false, confidence: 'medium' },
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
    expect(body.enginePreview.standardRows[0].values.employeeName).toBe('홍길동')
  })

  it('returns needs_more_information without calling AI when no file text could be read', async () => {
    mocks.loadPayrollAdaptiveStructuringEligibilityContext.mockResolvedValue({
      session: { id: 'session-1' },
      sourceFiles: [sourceFile],
      eligibility: { eligible: true, reason: '급여 지급 데이터로 보이나 기존 추출기가 인식하지 못했습니다.' },
    })
    mocks.blobGet.mockResolvedValue({ statusCode: 404, stream: null })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.proposal.status).toBe('needs_more_information')
    expect(mocks.generatePayrollAdaptiveStructuringProposal).not.toHaveBeenCalled()
  })
})
