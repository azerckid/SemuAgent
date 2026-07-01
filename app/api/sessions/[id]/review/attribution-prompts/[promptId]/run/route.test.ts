import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  getActiveStaffForPeriodAttribution: vi.fn(),
  runAttributionSavedPrompt: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireTenantSession: mocks.requireTenantSession }))
vi.mock('@/lib/bookkeeping/period-attribution-service', () => ({
  getActiveStaffForPeriodAttribution: mocks.getActiveStaffForPeriodAttribution,
}))
vi.mock('@/lib/reviews/attribution-saved-prompt-run', () => ({
  runAttributionSavedPrompt: mocks.runAttributionSavedPrompt,
}))

const { POST } = await import('./route')

const request = new Request('http://localhost/api/sessions/session-1/review/attribution-prompts/prompt-1/run', {
  method: 'POST',
})

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.getActiveStaffForPeriodAttribution.mockReset()
  mocks.runAttributionSavedPrompt.mockReset()

  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'user-1' }, tenantId: 'tenant-1' })
  mocks.getActiveStaffForPeriodAttribution.mockResolvedValue({ id: 'staff-1' })
  mocks.runAttributionSavedPrompt.mockResolvedValue({
    ok: true,
    status: 'ok',
    prompt: { id: 'prompt-1', name: '큰 금액', explanationKo: '큰 금액만 표시합니다.' },
    summary: { totalRows: 1, matchedRows: 1, amountSumKrw: 2_000_000, needsReviewRows: 1 },
    rows: [],
  })
})

describe('POST /api/sessions/[id]/review/attribution-prompts/[promptId]/run', () => {
  it('rejects invalid route params before calling the service', async () => {
    const response = await POST(request, {
      params: Promise.resolve({ id: '', promptId: 'prompt-1' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.runAttributionSavedPrompt).not.toHaveBeenCalled()
  })

  it('runs prompts with the authenticated tenant, session, prompt, and staff record', async () => {
    const response = await POST(request, {
      params: Promise.resolve({ id: 'session-1', promptId: 'prompt-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.matchedRows).toBe(1)
    expect(mocks.runAttributionSavedPrompt).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      promptId: 'prompt-1',
      staffRecord: { id: 'staff-1' },
    })
  })
})
