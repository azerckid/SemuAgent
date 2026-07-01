import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  getActiveStaffForPeriodAttribution: vi.fn(),
  listAttributionSavedPrompts: vi.fn(),
  createAttributionSavedPrompt: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireTenantSession: mocks.requireTenantSession }))
vi.mock('@/lib/bookkeeping/period-attribution-service', () => ({
  getActiveStaffForPeriodAttribution: mocks.getActiveStaffForPeriodAttribution,
}))
vi.mock('@/lib/reviews/attribution-saved-prompts', () => ({
  listAttributionSavedPrompts: mocks.listAttributionSavedPrompts,
  createAttributionSavedPrompt: mocks.createAttributionSavedPrompt,
}))

const { GET, POST } = await import('./route')

function postRequest(body: unknown) {
  return new Request('http://localhost/api/reviews/attribution-prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.requireTenantSession.mockReset()
  mocks.getActiveStaffForPeriodAttribution.mockReset()
  mocks.listAttributionSavedPrompts.mockReset()
  mocks.createAttributionSavedPrompt.mockReset()

  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'user-1' }, tenantId: 'tenant-1' })
  mocks.getActiveStaffForPeriodAttribution.mockResolvedValue({ id: 'staff-1' })
  mocks.listAttributionSavedPrompts.mockResolvedValue([])
  mocks.createAttributionSavedPrompt.mockResolvedValue({
    ok: true,
    prompt: { id: 'prompt-1', name: '큰 금액', explanationKo: '큰 금액만 표시합니다.' },
  })
})

describe('/api/reviews/attribution-prompts', () => {
  it('lists prompts scoped to the current tenant', async () => {
    const response = await GET(new Request('http://localhost/api/reviews/attribution-prompts?includeInactive=true'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.tableReady).toBe(true)
    expect(mocks.listAttributionSavedPrompts).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      includeInactive: true,
    })
  })

  it('rejects invalid create payloads before calling the service', async () => {
    const response = await POST(postRequest({ name: '큰 금액' }))

    expect(response.status).toBe(400)
    expect(mocks.createAttributionSavedPrompt).not.toHaveBeenCalled()
  })

  it('creates prompts with the authenticated tenant and staff id', async () => {
    const response = await POST(postRequest({
      name: '큰 금액',
      promptText: '200만원 이상만 뽑아서 확인해줘',
    }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.prompt.id).toBe('prompt-1')
    expect(mocks.createAttributionSavedPrompt).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      staffId: 'staff-1',
      name: '큰 금액',
      description: undefined,
      promptText: '200만원 이상만 뽑아서 확인해줘',
    })
  })
})
