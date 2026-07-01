import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  dbSelect: vi.fn(),
  approveReviewAdaptiveModel: vi.fn(),
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
  approveReviewAdaptiveModel: mocks.approveReviewAdaptiveModel,
}))

const { POST } = await import('./route')

function callRoute() {
  return POST(
    new Request('http://localhost/api/review/adaptive-models/model-1/approve', { method: 'POST' }),
    { params: Promise.resolve({ id: 'model-1' }) },
  )
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.dbSelect.mockReset()
  mocks.approveReviewAdaptiveModel.mockReset()
  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'admin-1' }, tenantId: 'tenant-1' })
})

describe('POST /api/review/adaptive-models/[id]/approve', () => {
  it('returns 403 when the caller is not TENANT_ADMIN', async () => {
    mocks.dbSelect.mockResolvedValue([{ id: 'staff-1', role: 'STAFF' }])

    const response = await callRoute()

    expect(response.status).toBe(403)
    expect(mocks.approveReviewAdaptiveModel).not.toHaveBeenCalled()
  })

  it('approves the model when the caller is TENANT_ADMIN', async () => {
    mocks.dbSelect.mockResolvedValue([{ id: 'admin-staff-1', role: 'TENANT_ADMIN' }])
    mocks.approveReviewAdaptiveModel.mockResolvedValue({ success: true })

    const response = await callRoute()

    expect(response.status).toBe(200)
    expect(mocks.approveReviewAdaptiveModel).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      modelId: 'model-1',
      approvedByStaffId: 'admin-staff-1',
    })
  })

  it('propagates a 409 when the model is not in proposed status', async () => {
    mocks.dbSelect.mockResolvedValue([{ id: 'admin-staff-1', role: 'TENANT_ADMIN' }])
    mocks.approveReviewAdaptiveModel.mockResolvedValue({
      success: false,
      status: 409,
      error: '현재 상태(approved)에서는 이 작업을 할 수 없습니다',
    })

    const response = await callRoute()

    expect(response.status).toBe(409)
  })

  it('propagates a 404 when the model does not belong to this tenant or workflow', async () => {
    mocks.dbSelect.mockResolvedValue([{ id: 'admin-staff-1', role: 'TENANT_ADMIN' }])
    mocks.approveReviewAdaptiveModel.mockResolvedValue({
      success: false,
      status: 404,
      error: '모델을 찾을 수 없습니다',
    })

    const response = await callRoute()

    expect(response.status).toBe(404)
  })
})
