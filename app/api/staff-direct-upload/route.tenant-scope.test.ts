import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as appSchema from '@/lib/db/schema'

// QA 12 I-01: tenant A 세션이 tenant B의 clientId로 직접 업로드 세션을 만들지 못한다.
// 실계정 2개 대신 A/B fixture로 검증한다. 교차 테넌트 거부는 db.transaction 이전에
// 일어나므로 client·staff 두 테이블만 있으면 된다.

let client: Client
let testDb: ReturnType<typeof drizzle>
let testDir: string
let sessionTenantId = 'tenant-a'

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

vi.mock('@/lib/auth-helpers', () => ({
  requireTenantSession: async () => ({
    user: { id: 'user-a' },
    session: {},
    tenantId: sessionTenantId,
  }),
}))

beforeAll(async () => {
  // route가 session-service → lib/env를 끌어오므로 core env를 스텁한다(실제 접속 없음 — db는 mock).
  process.env.TURSO_DATABASE_URL ??= 'libsql://test.local'
  process.env.TURSO_AUTH_TOKEN ??= 'test-token'
  process.env.BETTER_AUTH_SECRET ??= 'test-secret-at-least-32-characters-long'

  testDir = mkdtempSync(join(tmpdir(), 'semuagent-staff-direct-upload-tenant-scope-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })

  await client.execute(`
    CREATE TABLE client (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      name text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE staff (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      user_id text NOT NULL
    )
  `)
})

afterAll(() => {
  client.close()
  rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  sessionTenantId = 'tenant-a'
  await client.execute('DELETE FROM client')
  await client.execute('DELETE FROM staff')
})

function request(clientId: string) {
  return new Request('http://localhost:3000/api/staff-direct-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      displayLabel: '2026년 7월 기장 자료',
      workType: 'bookkeeping',
      accountingPeriod: '2026-07',
    }),
  })
}

describe('POST /api/staff-direct-upload tenant scope (QA 12 I-01)', () => {
  it('rejects another tenant clientId with 404 before creating any session', async () => {
    // tenant B의 사업장만 존재. tenant A 세션이 이 clientId를 노린다.
    await client.execute({
      sql: 'INSERT INTO client (id, tenant_id, name) VALUES (?, ?, ?)',
      args: ['client-b', 'tenant-b', '사업장 B'],
    })
    await client.execute({
      sql: 'INSERT INTO staff (id, tenant_id, user_id) VALUES (?, ?, ?)',
      args: ['staff-a', 'tenant-a', 'user-a'],
    })

    const { POST } = await import('./route')
    const response = await POST(request('client-b'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: '고객사를 찾을 수 없습니다' })
  })

  it('control: same-tenant clientId passes the client scope check (fails later on staff, not 404)', async () => {
    // 같은 tenant의 사업장이면 client 검사를 통과해야 한다(담당자 없어 403).
    // 이 대조군이 있어야 위 404가 "항상 404"가 아님이 증명된다.
    await client.execute({
      sql: 'INSERT INTO client (id, tenant_id, name) VALUES (?, ?, ?)',
      args: ['client-a', 'tenant-a', '사업장 A'],
    })

    const { POST } = await import('./route')
    const response = await POST(request('client-a'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: '담당자 정보를 찾을 수 없습니다' })
  })
})
