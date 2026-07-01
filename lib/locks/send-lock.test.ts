import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq } from 'drizzle-orm'
import * as appSchema from '@/lib/db/schema'
import { fromISO, toDBString } from '@/lib/time'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: appSchema })
  await client.execute(`
    CREATE TABLE outbound_send_lock (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      request_event_id text NOT NULL,
      status text NOT NULL DEFAULT 'running',
      started_at text NOT NULL,
      completed_at text,
      created_at text NOT NULL
    )
  `)
  // partial unique: status = 'running' row만 unique 적용
  await client.execute(
    `CREATE UNIQUE INDEX outbound_send_lock_running_uidx
       ON outbound_send_lock(request_event_id)
       WHERE status = 'running'`,
  )
})

beforeEach(async () => {
  await client.execute(`DELETE FROM outbound_send_lock`)
})

const { outboundSendLock } = appSchema
const {
  acquireSendLock,
  cleanupStaleSendLocks,
  isUniqueConstraintError,
  releaseSendLock,
} = await import('@/lib/locks/send-lock')

describe('acquireSendLock', () => {
  it('첫 acquire는 lockId 문자열을 반환한다', async () => {
    const id = await acquireSendLock('tenant-1', 'event-1')
    expect(id).toBeTypeOf('string')
    expect(id!.length).toBeGreaterThan(0)
  })

  it("동일 event의 'running' 락이 살아 있으면 두 번째 acquire는 null", async () => {
    const first = await acquireSendLock('tenant-1', 'event-1')
    const second = await acquireSendLock('tenant-1', 'event-1')
    expect(first).toBeTypeOf('string')
    expect(second).toBeNull()
  })

  it('다른 event는 서로 독립적으로 acquire 가능하다', async () => {
    const a = await acquireSendLock('tenant-1', 'event-A')
    const b = await acquireSendLock('tenant-1', 'event-B')
    expect(a).toBeTypeOf('string')
    expect(b).toBeTypeOf('string')
    expect(a).not.toBe(b)
  })

  it('다른 tenant도 같은 event id면 차단된다 (event id가 전역 unique 가정)', async () => {
    const a = await acquireSendLock('tenant-1', 'event-X')
    const b = await acquireSendLock('tenant-2', 'event-X')
    expect(a).toBeTypeOf('string')
    expect(b).toBeNull()
  })

  it('acquire 성공 시 status는 running, startedAt이 채워진다', async () => {
    const id = await acquireSendLock('tenant-1', 'event-1')
    const rows = await testDb.select().from(outboundSendLock).where(eq(outboundSendLock.id, id!))
    expect(rows[0].status).toBe('running')
    expect(rows[0].startedAt).toBeTruthy()
    expect(rows[0].completedAt).toBeNull()
  })
})

describe('releaseSendLock', () => {
  it('completed 상태로 release하면 status와 completedAt이 업데이트된다', async () => {
    const id = await acquireSendLock('tenant-1', 'event-1')
    await releaseSendLock(id!, 'completed')
    const rows = await testDb.select().from(outboundSendLock).where(eq(outboundSendLock.id, id!))
    expect(rows[0].status).toBe('completed')
    expect(rows[0].completedAt).toBeTruthy()
  })

  it('failed 상태로 release하면 status가 failed로 기록된다', async () => {
    const id = await acquireSendLock('tenant-1', 'event-1')
    await releaseSendLock(id!, 'failed')
    const rows = await testDb.select().from(outboundSendLock).where(eq(outboundSendLock.id, id!))
    expect(rows[0].status).toBe('failed')
    expect(rows[0].completedAt).toBeTruthy()
  })
})

describe('cleanupStaleSendLocks', () => {
  it('1시간 이상 running인 lock만 failed로 전환한다', async () => {
    await testDb.insert(outboundSendLock).values([
      {
        id: 'old-running',
        tenantId: 'tenant-1',
        requestEventId: 'event-old',
        status: 'running',
        startedAt: '2026-05-22T00:00:00.000+09:00',
        createdAt: '2026-05-22T00:00:00.000+09:00',
      },
      {
        id: 'fresh-running',
        tenantId: 'tenant-1',
        requestEventId: 'event-fresh',
        status: 'running',
        startedAt: '2026-05-22T00:30:01.000+09:00',
        createdAt: '2026-05-22T00:30:01.000+09:00',
      },
      {
        id: 'old-completed',
        tenantId: 'tenant-1',
        requestEventId: 'event-completed',
        status: 'completed',
        startedAt: '2026-05-22T00:00:00.000+09:00',
        completedAt: '2026-05-22T00:10:00.000+09:00',
        createdAt: '2026-05-22T00:00:00.000+09:00',
      },
    ])

    const referenceTime = fromISO('2026-05-22T01:30:00.000+09:00')
    const count = await cleanupStaleSendLocks(referenceTime)

    expect(count).toBe(1)
    const rows = await testDb.select().from(outboundSendLock)
    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get('old-running')?.status).toBe('failed')
    expect(byId.get('old-running')?.completedAt).toBe(toDBString(referenceTime))
    expect(byId.get('fresh-running')?.status).toBe('running')
    expect(byId.get('old-completed')?.status).toBe('completed')
  })

  it('stale running lock이 없으면 0을 반환한다', async () => {
    await testDb.insert(outboundSendLock).values({
      id: 'fresh-running',
      tenantId: 'tenant-1',
      requestEventId: 'event-fresh',
      status: 'running',
      startedAt: '2026-05-22T00:45:01.000+09:00',
      createdAt: '2026-05-22T00:45:01.000+09:00',
    })

    const count = await cleanupStaleSendLocks(fromISO('2026-05-22T01:30:00.000+09:00'))

    expect(count).toBe(0)
  })
})

describe('isUniqueConstraintError', () => {
  it('Drizzle가 원본 DB 에러를 cause로 감싼 경우에도 unique constraint로 인식한다', () => {
    const wrapped = new Error('Failed query', {
      cause: { code: 'SQLITE_CONSTRAINT_UNIQUE' },
    })

    expect(isUniqueConstraintError(wrapped)).toBe(true)
  })

  it('unique constraint가 아닌 에러는 false를 반환한다', () => {
    expect(isUniqueConstraintError(new Error('network unavailable'))).toBe(false)
  })
})

describe('재acquire 동작 (partial unique의 효과)', () => {
  it("release('failed') 후 동일 event 재acquire는 새 lockId를 반환한다", async () => {
    const first = await acquireSendLock('tenant-1', 'event-1')
    await releaseSendLock(first!, 'failed')
    const second = await acquireSendLock('tenant-1', 'event-1')
    expect(second).toBeTypeOf('string')
    expect(second).not.toBe(first)
  })

  it("release('completed') 후에도 락 레이어는 재acquire를 허용한다 (라우트가 event.uploadSessionId로 차단)", async () => {
    const first = await acquireSendLock('tenant-1', 'event-1')
    await releaseSendLock(first!, 'completed')
    const second = await acquireSendLock('tenant-1', 'event-1')
    expect(second).toBeTypeOf('string')
    expect(second).not.toBe(first)
  })

  it('release 후 락 row는 감사용으로 보존된다 (행이 누적된다)', async () => {
    const a = await acquireSendLock('tenant-1', 'event-1')
    await releaseSendLock(a!, 'failed')
    const b = await acquireSendLock('tenant-1', 'event-1')
    await releaseSendLock(b!, 'completed')

    const rows = await testDb.select().from(outboundSendLock)
    expect(rows.length).toBe(2)
    expect(rows.map((r) => r.status).sort()).toEqual(['completed', 'failed'])
  })
})
