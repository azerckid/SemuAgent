import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  dbSelect: vi.fn(),
  retireReviewAdaptiveModel: vi.fn(),
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
  retireReviewAdaptiveModel: mocks.retireReviewAdaptiveModel,
}))

const { POST } = await import('./route')

function callRoute() {
  return POST(
    new Request('http://localhost/api/review/adaptive-models/model-1/retire', { method: 'POST' }),
    { params: Promise.resolve({ id: 'model-1' }) },
  )
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.dbSelect.mockReset()
  mocks.retireReviewAdaptiveModel.mockReset()
  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'admin-1' }, tenantId: 'tenant-1' })
})

describe('POST /api/review/adaptive-models/[id]/retire', () => {
  it('returns 403 when the caller is not TENANT_ADMIN', async () => {
    mocks.dbSelect.mockResolvedValue([{ role: 'STAFF' }])

    const response = await callRoute()

    expect(response.status).toBe(403)
    expect(mocks.retireReviewAdaptiveModel).not.toHaveBeenCalled()
  })

  it('retires the model when the caller is TENANT_ADMIN', async () => {
    mocks.dbSelect.mockResolvedValue([{ role: 'TENANT_ADMIN' }])
    mocks.retireReviewAdaptiveModel.mockResolvedValue({ success: true })

    const response = await callRoute()

    expect(response.status).toBe(200)
    expect(mocks.retireReviewAdaptiveModel).toHaveBeenCalledWith({ tenantId: 'tenant-1', modelId: 'model-1' })
  })

  it('returns 404 when the model does not belong to this tenant or workflow', async () => {
    mocks.dbSelect.mockResolvedValue([{ role: 'TENANT_ADMIN' }])
    mocks.retireReviewAdaptiveModel.mockResolvedValue({ success: false, status: 404, error: '모델을 찾을 수 없습니다' })

    const response = await callRoute()

    expect(response.status).toBe(404)
  })
})
