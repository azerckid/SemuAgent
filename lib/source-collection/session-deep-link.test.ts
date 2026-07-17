import { describe, expect, it } from 'vitest'
import type { SourceCollectionImportRow } from '@/lib/source-collection/summary'
import {
  periodDefaultDirectUploadHref,
  scopeImportRowsForSession,
  shouldRedirectInvalidSessionId,
} from './session-deep-link'

function row(id: string, uploadSessionId: string): SourceCollectionImportRow {
  return {
    id,
    uploadSessionId,
    safeTitle: id,
    sourceType: 'bank_statement',
    progressPercent: 100,
    status: 'matched',
    statusLabel: '정규화 완료',
    uploadedAt: '2026-07-17',
    rowCountLabel: '1KB',
    href: '/dashboard/direct-upload',
    canRetry: false,
  }
}

describe('shouldRedirectInvalidSessionId (QA R-09)', () => {
  it('redirects when sessionId alone is unresolved', () => {
    expect(shouldRedirectInvalidSessionId({
      sessionId: 'missing-session',
      resolvedSessionId: null,
    })).toBe(true)
  })

  it('redirects when invalid sessionId is paired with fileId-resolved different session', () => {
    // fileId may resolve a session, but query sessionId must still match.
    expect(shouldRedirectInvalidSessionId({
      sessionId: 'invalid-or-other',
      resolvedSessionId: 'sess-from-file',
    })).toBe(true)
  })

  it('does not redirect when sessionId matches resolved session', () => {
    expect(shouldRedirectInvalidSessionId({
      sessionId: 'sess-s1',
      resolvedSessionId: 'sess-s1',
    })).toBe(false)
  })

  it('does not redirect when sessionId query is absent', () => {
    expect(shouldRedirectInvalidSessionId({
      sessionId: null,
      resolvedSessionId: null,
    })).toBe(false)
  })
})

describe('scopeImportRowsForSession (QA R-04)', () => {
  const s1 = 'sess-s1'
  const s2 = 'sess-s2'
  const rows = [row('file-a', s1), row('file-b', s2)]

  it('shows only S1 files when CTA opens latest S1 session', () => {
    // Fixture: S1.createdAt > S2.createdAt → card points at S1
    const scoped = scopeImportRowsForSession(rows, {
      sessionId: s1,
      resolvedSessionId: s1,
    })
    expect(scoped.map((r) => r.id)).toEqual(['file-a'])
    expect(scoped.every((r) => r.uploadSessionId === s1)).toBe(true)
  })

  it('keeps period-wide rows when sessionId is absent', () => {
    expect(scopeImportRowsForSession(rows, {
      sessionId: null,
      resolvedSessionId: null,
    })).toHaveLength(2)
  })

  it('does not apply session filter when sessionId mismatches resolved id', () => {
    // Page redirects before render; helper stays fail-safe and does not pretend to filter.
    expect(scopeImportRowsForSession(rows, {
      sessionId: 'invalid',
      resolvedSessionId: s1,
    })).toHaveLength(2)
  })
})

describe('periodDefaultDirectUploadHref', () => {
  it('strips to period-only URL', () => {
    expect(periodDefaultDirectUploadHref('2026-H2')).toBe(
      '/dashboard/direct-upload?period=2026-H2',
    )
  })
})
