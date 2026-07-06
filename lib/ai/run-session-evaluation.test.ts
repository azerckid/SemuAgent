import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  evaluateSessionAgainstCriteria: vi.fn(),
}))

vi.mock('./session-eval', () => ({
  evaluateSessionAgainstCriteria: mocks.evaluateSessionAgainstCriteria,
}))

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  uploadSession: {
    id: 'upload_session.id',
    tenantId: 'upload_session.tenant_id',
    status: 'upload_session.status',
  },
}))

const { runSessionEvaluationPipeline } = await import('./run-session-evaluation')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runSessionEvaluationPipeline', () => {
  it('returns needs_resubmission outcomes from evaluation', async () => {
    mocks.evaluateSessionAgainstCriteria.mockResolvedValue({
      ok: true,
      status: 'needs_resubmission',
    })

    const result = await runSessionEvaluationPipeline('session-1', 'tenant-1')

    expect(result).toEqual({ ok: true, status: 'needs_resubmission' })
  })
})
