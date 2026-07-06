import { beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  getActiveStaffForPeriodAttribution: vi.fn(),
  startBookkeepingMaterialAttribution: vi.fn(),
  runBookkeepingLedgerDraftPipeline: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireTenantSession: mocks.requireTenantSession }))
vi.mock('@/lib/bookkeeping/period-attribution-service', () => ({
  getActiveStaffForPeriodAttribution: mocks.getActiveStaffForPeriodAttribution,
  startBookkeepingMaterialAttribution: mocks.startBookkeepingMaterialAttribution,
}))
vi.mock('@/lib/bookkeeping/fiscal-year-ledger-pipeline', () => ({
  runBookkeepingLedgerDraftPipeline: mocks.runBookkeepingLedgerDraftPipeline,
}))

const { POST } = await import('./route')

const STAFF = { id: 'staff-1', role: 'TENANT_ADMIN' as const }

function postRequest() {
  return new Request('http://localhost/api/sessions/session-1/material-attribution/start', { method: 'POST' })
}

function callRoute() {
  return POST(postRequest(), { params: Promise.resolve({ id: 'session-1' }) })
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.getActiveStaffForPeriodAttribution.mockReset()
  mocks.startBookkeepingMaterialAttribution.mockReset()
  mocks.runBookkeepingLedgerDraftPipeline.mockReset()
  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'user-1' }, tenantId: 'tenant-1' })
  mocks.getActiveStaffForPeriodAttribution.mockResolvedValue(STAFF)
})

describe('POST /api/sessions/[id]/material-attribution/start', () => {
  it('runs the draft pipeline automatically after attribution succeeds and includes the result', async () => {
    mocks.startBookkeepingMaterialAttribution.mockResolvedValue({ ok: true, rowCount: 3 })
    mocks.runBookkeepingLedgerDraftPipeline.mockResolvedValue({
      ok: true,
      status: 'completed',
      steps: [],
      classificationRunId: 'run-1',
      journalEntryRunId: 'run-2',
    })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.rowCount).toBe(3)
    expect(body.pipeline).toMatchObject({ ok: true, status: 'completed' })
    expect(mocks.runBookkeepingLedgerDraftPipeline).toHaveBeenCalledWith({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      staffRecord: STAFF,
    })
  })

  it('does not run the pipeline when attribution itself fails', async () => {
    mocks.startBookkeepingMaterialAttribution.mockResolvedValue({
      ok: false,
      status: 409,
      error: '기장 대상 기간을 확정할 수 없습니다.',
    })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('기장 대상 기간을 확정할 수 없습니다.')
    expect(mocks.runBookkeepingLedgerDraftPipeline).not.toHaveBeenCalled()
  })

  it('still returns the attribution result when the pipeline throws unexpectedly', async () => {
    mocks.startBookkeepingMaterialAttribution.mockResolvedValue({ ok: true, rowCount: 2 })
    mocks.runBookkeepingLedgerDraftPipeline.mockRejectedValue(new Error('AI provider down'))

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.rowCount).toBe(2)
    expect(body.pipeline).toBeNull()
  })
})
