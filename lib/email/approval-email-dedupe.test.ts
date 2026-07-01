import { describe, expect, it } from 'vitest'
import { dedupeApprovalEmailRowsBySession } from './approval-email-dedupe'

describe('dedupeApprovalEmailRowsBySession', () => {
  it('keeps the newest row per session', () => {
    const rows = [
      { sessionId: 's1', createdAt: '2026-06-26 07:16:00', id: 'old' },
      { sessionId: 's1', createdAt: '2026-06-26 07:17:00', id: 'new' },
      { sessionId: 's2', createdAt: '2026-06-26 07:17:00', id: 'other' },
    ]
    const sort = (input: typeof rows) => [...input].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    expect(dedupeApprovalEmailRowsBySession(rows, sort).map((row) => row.id)).toEqual(['new', 'other'])
  })
})
