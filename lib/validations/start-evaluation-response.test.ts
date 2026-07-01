import { describe, expect, it } from 'vitest'
import { startEvaluationResponseSchema } from './start-evaluation-response'

describe('startEvaluationResponseSchema', () => {
  it('accepts completed for already-evaluated early return', () => {
    const parsed = startEvaluationResponseSchema.parse({
      ok: true,
      status: 'completed',
    })

    expect(parsed).toEqual({ ok: true, status: 'completed' })
  })
})
