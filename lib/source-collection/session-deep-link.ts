import type { SourceCollectionImportRow } from '@/lib/source-collection/summary'

/**
 * CUI-4 §4.3.3 — invalid sessionId must always strip to period default URL.
 * fileId presence does not waive the redirect.
 */
export function shouldRedirectInvalidSessionId(params: {
  sessionId?: string | null
  resolvedSessionId?: string | null
}): boolean {
  if (!params.sessionId) return false
  if (!params.resolvedSessionId) return true
  return params.resolvedSessionId !== params.sessionId
}

/**
 * CUI-4 §4.3.2 — import status table shows only the resolved session files
 * when a sessionId query is present and valid.
 */
export function scopeImportRowsForSession(
  rows: readonly SourceCollectionImportRow[],
  params: {
    sessionId?: string | null
    resolvedSessionId?: string | null
  },
): SourceCollectionImportRow[] {
  if (!params.sessionId || !params.resolvedSessionId) {
    return [...rows]
  }
  if (params.resolvedSessionId !== params.sessionId) {
    return [...rows]
  }
  return rows.filter((row) => row.uploadSessionId === params.resolvedSessionId)
}

export function periodDefaultDirectUploadHref(periodKey: string) {
  return `/dashboard/direct-upload?period=${periodKey}`
}
