export function dedupeApprovalEmailRowsBySession<T extends { sessionId: string }>(
  rows: T[],
  sortRows: (input: T[]) => T[],
): T[] {
  const bySession = new Map<string, T>()
  for (const row of sortRows(rows)) {
    if (!bySession.has(row.sessionId)) {
      bySession.set(row.sessionId, row)
    }
  }
  return sortRows([...bySession.values()])
}
