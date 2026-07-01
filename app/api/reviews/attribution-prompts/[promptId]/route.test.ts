import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  getActiveStaffForPeriodAttribution: vi.fn(),
  updateAttributionSavedPrompt: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireTenantSession: mocks.requireTenantSession }))
vi.mock('@/lib/bookkeeping/period-attribution-service', () => ({
  getActiveStaffForPeriodAttribution: mocks.getActiveStaffForPeriodAttribution,
}))
vi.mock('@/lib/reviews/attribution-saved-prompts', () => ({
  updateAttributionSavedPrompt: mocks.updateAttributionSavedPrompt,
}))

const { PATCH } = await import('./route')

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/reviews/attribution-prompts/prompt-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.getActiveStaffForPeriodAttribution.mockReset()
  mocks.updateAttributionSavedPrompt.mockReset()

  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'user-1' }, tenantId: 'tenant-1' })
  mocks.getActiveStaffForPeriodAttribution.mockResolvedValue({ id: 'staff-1' })
  mocks.updateAttributionSavedPrompt.mockResolvedValue({
    ok: true,
    prompt: { id: 'prompt-1', name: '큰 금액', explanationKo: '큰 금액만 표시합니다.' },
  })
})

describe('PATCH /api/reviews/attribution-prompts/[promptId]', () => {
  it('rejects invalid route params before calling the service', async () => {
    const response = await PATCH(patchRequest({ name: '수정' }), {
      params: Promise.resolve({ promptId: '' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.updateAttributionSavedPrompt).not.toHaveBeenCalled()
  })

  it('rejects invalid update payloads before calling the service', async () => {
    const response = await PATCH(patchRequest({ sortOrder: -1 }), {
      params: Promise.resolve({ promptId: 'prompt-1' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.updateAttributionSavedPrompt).not.toHaveBeenCalled()
  })

  it('updates prompts with the authenticated tenant and staff id', async () => {
    const response = await PATCH(patchRequest({ name: '수정', isActive: false }), {
      params: Promise.resolve({ promptId: 'prompt-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.prompt.id).toBe('prompt-1')
    expect(mocks.updateAttributionSavedPrompt).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      staffId: 'staff-1',
      promptId: 'prompt-1',
      name: '수정',
      isActive: false,
    })
  })
})
