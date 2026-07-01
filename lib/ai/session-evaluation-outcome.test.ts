import { describe, expect, it } from 'vitest'
import { sessionEvaluationOutcomeSchema } from './session-evaluation-outcome'

describe('sessionEvaluationOutcomeSchema', () => {
  it('accepts successful evaluation outcomes', () => {
    expect(sessionEvaluationOutcomeSchema.safeParse({
      ok: true,
      status: 'needs_resubmission',
    }).success).toBe(true)
  })

  it('accepts failed evaluation outcomes', () => {
    expect(sessionEvaluationOutcomeSchema.safeParse({
      ok: false,
      code: 'evaluation_failed',
      message: 'Claude 평가 응답에서 JSON을 찾지 못했습니다',
    }).success).toBe(true)
  })
})
