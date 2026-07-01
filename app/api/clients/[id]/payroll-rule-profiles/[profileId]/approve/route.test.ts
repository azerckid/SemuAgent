import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requirePayrollRuleProfileStaffAccess: vi.fn(),
  approveClientPayrollRuleProfile: vi.fn(),
}))

vi.mock('@/lib/payroll/rule-profile-staff-access', () => ({
  requirePayrollRuleProfileStaffAccess: mocks.requirePayrollRuleProfileStaffAccess,
}))
vi.mock('@/lib/payroll/rule-profile-registry', () => ({
  approveClientPayrollRuleProfile: mocks.approveClientPayrollRuleProfile,
}))

const { POST } = await import('./route')

function callRoute(body: Record<string, unknown>) {
  return POST(
    new Request('http://localhost/api/clients/client-1/payroll-rule-profiles/profile-1/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'client-1', profileId: 'profile-1' }) },
  )
}

beforeEach(() => {
  mocks.requirePayrollRuleProfileStaffAccess.mockReset()
  mocks.approveClientPayrollRuleProfile.mockReset()
  mocks.requirePayrollRuleProfileStaffAccess.mockResolvedValue({
    tenantId: 'tenant-1',
    clientId: 'client-1',
    staffId: 'staff-1',
    staffRole: 'STAFF',
  })
})

describe('POST /api/clients/[id]/payroll-rule-profiles/[profileId]/approve', () => {
  it('returns 400 for invalid effective period', async () => {
    const response = await callRoute({ effectiveFrom: '2026-6' })
    expect(response.status).toBe(400)
    expect(mocks.approveClientPayrollRuleProfile).not.toHaveBeenCalled()
  })

  it('approves a draft profile', async () => {
    mocks.approveClientPayrollRuleProfile.mockResolvedValue({
      success: true,
      profile: {
        id: 'profile-1',
        status: 'active',
        version: 2,
        effectiveFrom: '2026-06',
        effectiveTo: null,
        approvedAt: '2026-06-01T00:00:00.000+09:00',
      },
    })

    const response = await callRoute({
      effectiveFrom: '2026-06',
      approvalNotes: '검토 완료',
    })

    expect(response.status).toBe(200)
    expect(mocks.approveClientPayrollRuleProfile).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      profileId: 'profile-1',
      approvedByStaffId: 'staff-1',
      effectiveFrom: '2026-06',
      effectiveTo: null,
      approvalNotes: '검토 완료',
      supersedeConfirmed: undefined,
    })
  })

  it('propagates 422 when conflict rows block approval', async () => {
    mocks.approveClientPayrollRuleProfile.mockResolvedValue({
      success: false,
      status: 422,
      error: '충돌 상태인 규칙 1건이 있어 승인할 수 없습니다',
      code: 'conflict_rows',
    })

    const response = await callRoute({ effectiveFrom: '2026-06' })
    expect(response.status).toBe(422)
  })

  it('propagates 409 when supersede confirmation is required', async () => {
    mocks.approveClientPayrollRuleProfile.mockResolvedValue({
      success: false,
      status: 409,
      error: '동일 유효기간에 승인된 급여기준이 있습니다. 기존 기준을 대체하려면 확인이 필요합니다',
      code: 'overlap_requires_supersede',
    })

    const response = await callRoute({ effectiveFrom: '2026-06' })
    expect(response.status).toBe(409)
  })
})
