import { describe, expect, it } from 'vitest'
import {
  createClientRequestEventSchema,
  createClientRequestScheduleSchema,
} from './scheduling'

const CLIENT_ID = 'c917d8aa-80d2-4050-a2f1-494ca55bd873'
const COMBINED_CC = 'fan2soft@gmail.com, qa-internal@example.com, qa-manager@example.com'

describe('request scheduling validation', () => {
  it('accepts a single request event with customer and internal CC emails combined', () => {
    const result = createClientRequestEventSchema.safeParse({
      clientId: CLIENT_ID,
      accountingPeriod: '2026-12',
      frequency: 'custom',
      title: '2026-12 자료 요청',
      dueAt: '2026-12-31T23:59:59+09:00',
      ccEmailSnapshot: COMBINED_CC,
    })

    expect(result.success).toBe(true)
  })

  it('accepts a recurring request schedule with customer and internal CC emails combined', () => {
    const result = createClientRequestScheduleSchema.safeParse({
      clientId: CLIENT_ID,
      frequency: 'monthly',
      startsOn: '2026-12-01',
      generationPolicy: 'auto_generate_draft',
      sendPolicy: 'approval_required',
      sendRule: { type: 'day_of_month', dayOfMonth: 10 },
      dueRule: { type: 'day_of_month', dayOfMonth: 25 },
      emailSubjectTemplate: '자료 요청',
      emailBodyTemplate: '자료 요청 본문',
      ccEmailTemplate: COMBINED_CC,
    })

    expect(result.success).toBe(true)
  })
})
