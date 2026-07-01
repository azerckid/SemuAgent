type RequestEventWithKind = {
  requestKind?: string | null
  createdAt: string
}

export type GroupedRequestEvents<T extends RequestEventWithKind> = {
  requestKind: string
  primary: T
  duplicates: T[]
}

export function normalizeRequestKind(kind?: string | null): string {
  return kind?.trim() || 'general'
}

export function groupRequestEventsByKind<T extends RequestEventWithKind>(
  events: T[],
): Array<GroupedRequestEvents<T>> {
  const sorted = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const groups = new Map<string, T[]>()

  for (const event of sorted) {
    const key = normalizeRequestKind(event.requestKind)
    const list = groups.get(key) ?? []
    list.push(event)
    groups.set(key, list)
  }

  return Array.from(groups.entries()).map(([requestKind, list]) => ({
    requestKind,
    primary: list[0],
    duplicates: list.slice(1),
  }))
}
