import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  after: vi.fn((callback: () => void | Promise<void>) => {
    void callback()
  }),
  requireTenantSession: vi.fn(),
  selectLimit: vi.fn(),
  updateWhere: vi.fn(),
  runSessionEvaluationPipeline: vi.fn(),
  runBookkeepingDraftPipelineAfterEvaluation: vi.fn(),
}))

vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('@/lib/auth-helpers', () => ({ requireTenantSession: mocks.requireTenantSession }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mocks.selectLimit,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mocks.updateWhere,
      })),
    })),
  },
}))
vi.mock('@/lib/ai/run-session-evaluation', () => ({
  runSessionEvaluationPipeline: mocks.runSessionEvaluationPipeline,
}))
vi.mock('@/lib/bookkeeping/automatic-review-progression', () => ({
  runBookkeepingDraftPipelineAfterEvaluation: mocks.runBookkeepingDraftPipelineAfterEvaluation,
}))

const { POST } = await import('./route')

function postRequest(body: unknown = { force: true, reanalyzeFiles: false }) {
  return new Request('http://localhost/api/sessions/session-1/start-evaluation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function callRoute(body?: unknown) {
  return POST(postRequest(body), { params: Promise.resolve({ id: 'session-1' }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.after.mockImplementation((callback: () => void | Promise<void>) => {
    void callback()
  })
  mocks.requireTenantSession.mockResolvedValue({ user: { id: 'user-1' }, tenantId: 'tenant-1' })
  mocks.selectLimit.mockResolvedValue([{ status: 'submitted' }])
  mocks.updateWhere.mockResolvedValue(undefined)
  mocks.runSessionEvaluationPipeline.mockResolvedValue({ ok: true, status: 'ready_for_accountant' })
  mocks.runBookkeepingDraftPipelineAfterEvaluation.mockResolvedValue(undefined)
})

describe('POST /api/sessions/[id]/start-evaluation', () => {
  it('runs bookkeeping attribution and draft pipeline after rerun evaluation succeeds', async () => {
    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, status: 'ready_for_accountant' })
    expect(mocks.runBookkeepingDraftPipelineAfterEvaluation).toHaveBeenCalledWith({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      logSource: 'start-evaluation',
    })
  })

  it('keeps evaluation response successful when bookkeeping automation logs and returns', async () => {
    mocks.runBookkeepingDraftPipelineAfterEvaluation.mockResolvedValue(undefined)

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, status: 'ready_for_accountant' })
    expect(mocks.runBookkeepingDraftPipelineAfterEvaluation).toHaveBeenCalledTimes(1)
  })

  it('runs bookkeeping automation after async reanalysis succeeds', async () => {
    const response = await callRoute({ force: true, reanalyzeFiles: true })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, status: 'ai_checking', async: true })
    expect(mocks.runBookkeepingDraftPipelineAfterEvaluation).toHaveBeenCalledWith({
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      logSource: 'start-evaluation',
    })
  })

  it('does not run bookkeeping automation when session evaluation fails', async () => {
    mocks.runSessionEvaluationPipeline.mockResolvedValue({
      ok: false,
      code: 'evaluation_failed',
      message: 'AI failed',
    })

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({ ok: false, code: 'evaluation_failed', error: 'AI failed' })
    expect(mocks.runBookkeepingDraftPipelineAfterEvaluation).not.toHaveBeenCalled()
  })
})
