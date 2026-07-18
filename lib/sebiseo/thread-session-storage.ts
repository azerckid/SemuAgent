import { z } from 'zod'
import { SEBISEO_MESSAGE_MAX_LENGTH, sebiseoSuggestedActionSchema } from '@/lib/sebiseo/chat/schemas'

const STORAGE_PREFIX = 'sebiseo-thread:v1'
export const SEBISEO_SESSION_THREAD_MAX_ITEMS = 8

const sebiseoStoredThreadItemSchema = z.object({
  id: z.string().trim().min(1).max(100),
  kind: z.enum(['user', 'assistant']),
  body: z.string().trim().min(1).max(SEBISEO_MESSAGE_MAX_LENGTH),
  tone: z.enum(['normal', 'refused', 'error']).optional(),
  actions: z.array(sebiseoSuggestedActionSchema).max(2).optional(),
})

const sebiseoStoredThreadSchema = z.array(sebiseoStoredThreadItemSchema).max(SEBISEO_SESSION_THREAD_MAX_ITEMS)

export type SebiseoStoredThreadItem = z.infer<typeof sebiseoStoredThreadItemSchema>

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function buildSebiseoSessionThreadStorageKey(tenantId: string, businessEntityId: string) {
  return `${STORAGE_PREFIX}:${tenantId}:${businessEntityId}`
}

export function readSebiseoSessionThread(storage: SessionStorageLike, key: string): SebiseoStoredThreadItem[] {
  const raw = storage.getItem(key)
  if (!raw) return []

  try {
    const parsed = sebiseoStoredThreadSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  } catch {
    // Invalid browser storage is not a product record. Drop it and start a clean thread.
  }

  storage.removeItem(key)
  return []
}

export function writeSebiseoSessionThread(
  storage: SessionStorageLike,
  key: string,
  items: readonly SebiseoStoredThreadItem[],
) {
  const bounded = items.slice(-SEBISEO_SESSION_THREAD_MAX_ITEMS)
  if (bounded.length === 0) {
    storage.removeItem(key)
    return
  }

  storage.setItem(key, JSON.stringify(sebiseoStoredThreadSchema.parse(bounded)))
}
