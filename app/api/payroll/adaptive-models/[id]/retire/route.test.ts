import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  dbSelect: vi.fn(),
  retirePayrollAdaptiveModel: vi.fn(),
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
  retirePayrollAdaptiveModel: mocks.retirePayrollAdaptiveModel,
}))

const { POST } = await import('./route')

function callRoute() {
  return POST(
    new Request('http://localhost/api/payroll/adaptive-models/model-1/retire', { method: 'POST' }),
    { params: Promise.resolve({ id: 'model-1' }) },
  )
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.dbSelect.mockReset()
  mocks.retirePayrollAdaptiveModel.mockReset()
  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'admin-1' }, tenantId: 'tenant-1' })
})

describe('POST /api/payroll/adaptive-models/[id]/retire', () => {
  it('returns 403 when the caller is not TENANT_ADMIN', async () => {
    mocks.dbSelect.mockResolvedValue([{ role: 'STAFF' }])

    const response = await callRoute()

    expect(response.status).toBe(403)
    expect(mocks.retirePayrollAdaptiveModel).not.toHaveBeenCalled()
  })

  it('retires the model when the caller is TENANT_ADMIN', async () => {
    mocks.dbSelect.mockResolvedValue([{ role: 'TENANT_ADMIN' }])
    mocks.retirePayrollAdaptiveModel.mockResolvedValue({ success: true })

    const response = await callRoute()

    expect(response.status).toBe(200)
    expect(mocks.retirePayrollAdaptiveModel).toHaveBeenCalledWith({ tenantId: 'tenant-1', modelId: 'model-1' })
  })
})
