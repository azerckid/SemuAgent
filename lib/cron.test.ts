import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq } from 'drizzle-orm'
import * as appSchema from '@/lib/db/schema'

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
    CREATE TABLE cron_run (
      id text PRIMARY KEY,
      job_name text NOT NULL,
      run_key text NOT NULL,
      status text NOT NULL DEFAULT 'running',
      started_at text NOT NULL,
      completed_at text,
      created_at text NOT NULL
    )
  `)
  await client.execute(
    `CREATE UNIQUE INDEX cron_run_job_key_uidx
       ON cron_run(job_name, run_key)`,
  )
})

beforeEach(async () => {
  await client.execute(`DELETE FROM cron_run`)
})

const { cronRun } = appSchema
const { acquireCronLock, releaseCronLock } = await import('@/lib/cron')

describe('acquireCronLock', () => {
  it('첫 acquire는 lockId 문자열을 반환한다', async () => {
    const id = await acquireCronLock('reminder', '2026-05-22')

    expect(id).toBeTypeOf('string')
    expect(id!.length).toBeGreaterThan(0)
  })

  it('같은 job/runKey가 이미 있으면 null을 반환한다', async () => {
    const first = await acquireCronLock('reminder', '2026-05-22')
    const second = await acquireCronLock('reminder', '2026-05-22')

    expect(first).toBeTypeOf('string')
    expect(second).toBeNull()
  })

  it('다른 runKey는 별도 lock을 허용한다', async () => {
    const a = await acquireCronLock('reminder', '2026-05-22')
    const b = await acquireCronLock('reminder', '2026-05-23')

    expect(a).toBeTypeOf('string')
    expect(b).toBeTypeOf('string')
    expect(a).not.toBe(b)
  })
})

describe('releaseCronLock', () => {
  it('completed 상태와 completedAt을 기록한다', async () => {
    const id = await acquireCronLock('retry_failed', '2026-05-22-00')
    await releaseCronLock(id!, 'completed')

    const rows = await testDb.select().from(cronRun).where(eq(cronRun.id, id!))
    expect(rows[0].status).toBe('completed')
    expect(rows[0].completedAt).toBeTruthy()
  })
})
