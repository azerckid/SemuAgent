import { describe, expect, it } from 'vitest'
import {
  buildSebiseoSessionThreadStorageKey,
  readSebiseoSessionThread,
  writeSebiseoSessionThread,
} from './thread-session-storage'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('sebiseo session thread storage', () => {
  it('scopes the same-tab transcript by tenant and business entity', () => {
    expect(buildSebiseoSessionThreadStorageKey('tenant-a', 'business-a'))
      .not.toBe(buildSebiseoSessionThreadStorageKey('tenant-b', 'business-a'))
  })

  it('restores only the newest eight user or assistant messages', () => {
    const storage = memoryStorage()
    const key = buildSebiseoSessionThreadStorageKey('tenant-a', 'business-a')
    const messages = Array.from({ length: 10 }, (_, index) => ({
      id: `message-${index}`,
      kind: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      body: `message ${index}`,
    }))

    writeSebiseoSessionThread(storage, key, messages)

    expect(readSebiseoSessionThread(storage, key).map((item) => item.id))
      .toEqual(['message-2', 'message-3', 'message-4', 'message-5', 'message-6', 'message-7', 'message-8', 'message-9'])
  })

  it('drops malformed browser storage instead of restoring it', () => {
    const storage = memoryStorage()
    const key = buildSebiseoSessionThreadStorageKey('tenant-a', 'business-a')
    storage.setItem(key, 'not-json')

    expect(readSebiseoSessionThread(storage, key)).toEqual([])
    expect(storage.getItem(key)).toBeNull()
  })
})
