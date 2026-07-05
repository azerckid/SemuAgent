import { describe, expect, it } from 'vitest'
import { PATCH as patchEmail } from './emails/[id]/route'
import { POST as postMailConsoleBulkSend } from './mail-console/bulk-send/route'
import { POST as postRequestEventSend } from './request-events/[id]/send/route'
import { POST as postRequestEvent } from './request-events/route'
import { DELETE as deleteRequestSchedule, PATCH as patchRequestSchedule } from './request-schedules/[id]/route'
import { PATCH as patchRequestTemplate } from './request-templates/[id]/route'
import { POST as postSessionCompletion } from './sessions/[id]/completion/route'
import { POST as postSessionDraft } from './sessions/draft/route'

const retiredRoutes = [
  ['POST /api/request-events', postRequestEvent],
  ['POST /api/request-events/[id]/send', postRequestEventSend],
  ['POST /api/mail-console/bulk-send', postMailConsoleBulkSend],
  ['POST /api/sessions/draft', postSessionDraft],
  ['POST /api/sessions/[id]/completion', postSessionCompletion],
  ['PATCH /api/emails/[id]', patchEmail],
  ['PATCH /api/request-schedules/[id]', patchRequestSchedule],
  ['DELETE /api/request-schedules/[id]', deleteRequestSchedule],
  ['PATCH /api/request-templates/[id]', patchRequestTemplate],
] as const

describe('retired legacy request-mail write routes', () => {
  it.each(retiredRoutes)('%s returns 410', async (_label, handler) => {
    const response = await handler()

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('레거시 고객 요청 메일 기능'),
    })
  })
})
