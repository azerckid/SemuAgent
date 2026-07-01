import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  dbSelect: vi.fn(),
  rejectPayrollAdaptiveModel: vi.fn(),
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
vi.mock('@/lib/payroll/adaptive-structuring-registry', () => ({
  rejectPayrollAdaptiveModel: mocks.rejectPayrollAdaptiveModel,
}))

const { POST } = await import('./route')

function callRoute() {
  return POST(
    new Request('http://localhost/api/payroll/adaptive-models/model-1/reject', { method: 'POST' }),
    { params: Promise.resolve({ id: 'model-1' }) },
  )
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.dbSelect.mockReset()
  mocks.rejectPayrollAdaptiveModel.mockReset()
  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'user-1' }, tenantId: 'tenant-1' })
  mocks.dbSelect.mockResolvedValue([{ id: 'staff-1' }])
})

describe('POST /api/payroll/adaptive-models/[id]/reject', () => {
  it('returns 403 when the caller has no staff record for this tenant', async () => {
    mocks.dbSelect.mockResolvedValue([])

    const response = await callRoute()

    expect(response.status).toBe(403)
    expect(mocks.rejectPayrollAdaptiveModel).not.toHaveBeenCalled()
  })

  it('rejects the proposed model for this tenant', async () => {
    mocks.rejectPayrollAdaptiveModel.mockResolvedValue({ success: true })

    const response = await callRoute()

    expect(response.status).toBe(200)
    expect(mocks.rejectPayrollAdaptiveModel).toHaveBeenCalledWith({ tenantId: 'tenant-1', modelId: 'model-1' })
  })

  it('returns 404 when the model does not belong to this tenant', async () => {
    mocks.rejectPayrollAdaptiveModel.mockResolvedValue({ success: false, status: 404, error: '모델을 찾을 수 없습니다' })

    const response = await callRoute()

    expect(response.status).toBe(404)
  })
})
