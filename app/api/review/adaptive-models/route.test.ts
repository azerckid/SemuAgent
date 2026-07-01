import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  dbSelect: vi.fn(),
  createProposedReviewAdaptiveModel: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireTenantSession: mocks.requireTenantSession }))
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mocks.dbSelect,
        }),
      }),
    }),
  },
}))
vi.mock('@/lib/reviews/adaptive-structuring-registry', () => ({
  createProposedReviewAdaptiveModel: mocks.createProposedReviewAdaptiveModel,
}))

const { POST } = await import('./route')

function postRequest(body: unknown) {
  return new Request('http://localhost/api/review/adaptive-models', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.dbSelect.mockReset()
  mocks.createProposedReviewAdaptiveModel.mockReset()
  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'user-1' }, tenantId: 'tenant-1' })
  mocks.dbSelect.mockResolvedValue([{ id: 'staff-1' }])
})

describe('POST /api/review/adaptive-models', () => {
  it('rejects a request without sessionId', async () => {
    const response = await POST(postRequest({}))
    expect(response.status).toBe(400)
    expect(mocks.createProposedReviewAdaptiveModel).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller has no staff record for this tenant', async () => {
    mocks.dbSelect.mockResolvedValue([])
    const response = await POST(postRequest({ sessionId: 'session-1' }))
    expect(response.status).toBe(403)
  })

  it('creates a proposed model and returns its id', async () => {
    mocks.createProposedReviewAdaptiveModel.mockResolvedValue({ success: true, modelId: 'model-1' })

    const response = await POST(postRequest({ sessionId: 'session-1' }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.modelId).toBe('model-1')
    expect(mocks.createProposedReviewAdaptiveModel).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      createdByStaffId: 'staff-1',
    })
  })

  it('propagates the registry service status/error on failure', async () => {
    mocks.createProposedReviewAdaptiveModel.mockResolvedValue({
      success: false,
      status: 400,
      error: '제안이 같은 워크북에서 검증되지 않아 등록할 수 없습니다',
    })

    const response = await POST(postRequest({ sessionId: 'session-1' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('제안이 같은 워크북에서 검증되지 않아 등록할 수 없습니다')
  })
})
