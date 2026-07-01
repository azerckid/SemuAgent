import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  staffLimit: vi.fn(),
  getActiveStaffForPeriodAttribution: vi.fn(),
  startBookkeepingMaterialAttribution: vi.fn(),
  runBookkeepingLedgerDraftPipeline: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mocks.staffLimit,
        })),
      })),
    })),
  },
}))

vi.mock('@/lib/bookkeeping/period-attribution-service', () => ({
  getActiveStaffForPeriodAttribution: mocks.getActiveStaffForPeriodAttribution,
  startBookkeepingMaterialAttribution: mocks.startBookkeepingMaterialAttribution,
}))

vi.mock('@/lib/bookkeeping/fiscal-year-ledger-pipeline', () => ({
  runBookkeepingLedgerDraftPipeline: mocks.runBookkeepingLedgerDraftPipeline,
}))

const { runBookkeepingDraftPipelineAfterEvaluation } = await import('./automatic-review-progression')

const STAFF = { id: 'staff-1', role: 'TENANT_ADMIN' as const }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.staffLimit.mockResolvedValue([STAFF])
  mocks.getActiveStaffForPeriodAttribution.mockResolvedValue(STAFF)
  mocks.startBookkeepingMaterialAttribution.mockResolvedValue({ ok: true, rowCount: 3 })
  mocks.runBookkeepingLedgerDraftPipeline.mockResolvedValue({ ok: true, status: 'completed' })
})

describe('runBookkeepingDraftPipelineAfterEvaluation', () => {
  it('uses the authenticated user to run attribution and ledger draft pipeline', async () => {
    await runBookkeepingDraftPipelineAfterEvaluation({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
    })

    expect(mocks.getActiveStaffForPeriodAttribution).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'tenant-1',
    })
    expect(mocks.startBookkeepingMaterialAttribution).toHaveBeenCalledWith({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      staffRecord: STAFF,
    })
    expect(mocks.runBookkeepingLedgerDraftPipeline).toHaveBeenCalledWith({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      staffRecord: STAFF,
    })
  })

  it('uses the session creator staff id for client upload completion', async () => {
    await runBookkeepingDraftPipelineAfterEvaluation({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      staffId: 'staff-1',
    })

    expect(mocks.getActiveStaffForPeriodAttribution).not.toHaveBeenCalled()
    expect(mocks.startBookkeepingMaterialAttribution).toHaveBeenCalledWith({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      staffRecord: STAFF,
    })
  })

  it('does not run attribution when no active staff record exists', async () => {
    mocks.getActiveStaffForPeriodAttribution.mockResolvedValue(null)

    await runBookkeepingDraftPipelineAfterEvaluation({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
    })

    expect(mocks.startBookkeepingMaterialAttribution).not.toHaveBeenCalled()
    expect(mocks.runBookkeepingLedgerDraftPipeline).not.toHaveBeenCalled()
  })

  it('does not run ledger draft pipeline when attribution is not eligible', async () => {
    mocks.startBookkeepingMaterialAttribution.mockResolvedValue({
      ok: false,
      status: 409,
      error: '기장 대상 기간을 확정할 수 없습니다.',
    })

    await runBookkeepingDraftPipelineAfterEvaluation({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
    })

    expect(mocks.runBookkeepingLedgerDraftPipeline).not.toHaveBeenCalled()
  })
})
