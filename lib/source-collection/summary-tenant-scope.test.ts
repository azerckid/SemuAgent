import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as appSchema from '@/lib/db/schema'
import { fromISO } from '@/lib/time'
import { loadSourceCollectionSummary } from './summary'

// QA 12 I-02·I-03·I-05: 세비서 첫 화면이 읽는 read model의 tenant·사업장 격리를
// 실계정 없이 fixture로 검증한다. loadSourceCollectionSummary는 sebiseo/page.tsx가
// businessEntity·집계를 얻는 유일한 경로다.

let client: Client
let testDb: ReturnType<typeof drizzle>
let testDir: string

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

const TODAY = '2026-07-17T09:00:00+09:00'

beforeAll(async () => {
  testDir = mkdtempSync(join(tmpdir(), 'semuagent-source-collection-tenant-scope-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })

  // scopedSessionIds가 비면 하위(request_item_validation·upload_file) 조회를 건너뛰므로
  // 격리 검증에는 아래 3개 테이블이면 충분하다.
  await client.execute(`
    CREATE TABLE tenant (
      id text PRIMARY KEY,
      name text NOT NULL,
      timezone text NOT NULL DEFAULT 'Asia/Seoul'
    )
  `)
  await client.execute(`
    CREATE TABLE client (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      name text NOT NULL,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE source_batch (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      legacy_upload_session_id text,
      source_kind text NOT NULL DEFAULT 'staff_direct',
      accounting_period text NOT NULL,
      deleted_at text
    )
  `)
})

afterAll(() => {
  client.close()
  rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await client.execute('DELETE FROM source_batch')
  await client.execute('DELETE FROM client')
  await client.execute('DELETE FROM tenant')
})

async function seedTenant(id: string, name: string) {
  await client.execute({
    sql: 'INSERT INTO tenant (id, name, timezone) VALUES (?, ?, ?)',
    args: [id, name, 'Asia/Seoul'],
  })
}

async function seedClient(id: string, tenantId: string, name: string) {
  await client.execute({
    sql: 'INSERT INTO client (id, tenant_id, name, created_at) VALUES (?, ?, ?, ?)',
    args: [id, tenantId, name, '2026-01-01T00:00:00+09:00'],
  })
}

async function seedSourceBatch(params: {
  id: string
  tenantId: string
  clientId: string
  legacySessionId: string
}) {
  await client.execute({
    sql: `INSERT INTO source_batch
      (id, tenant_id, client_id, legacy_upload_session_id, source_kind, accounting_period, deleted_at)
      VALUES (?, ?, ?, ?, 'staff_direct', '2026-07', NULL)`,
    args: [params.id, params.tenantId, params.clientId, params.legacySessionId],
  })
}

function load(tenantId: string) {
  return loadSourceCollectionSummary({
    tenantId,
    periodKey: '2026-07',
    today: fromISO(TODAY),
  })
}

describe('loadSourceCollectionSummary tenant/사업장 scope (QA 12 I-02·I-03·I-05)', () => {
  it('I-02: returns only the requesting tenant business entity, never another tenant', async () => {
    await seedTenant('tenant-a', '회사 A')
    await seedTenant('tenant-b', '회사 B')
    await seedClient('client-a', 'tenant-a', '사업장 A')
    await seedClient('client-b', 'tenant-b', '사업장 B')

    const summaryA = await load('tenant-a')
    expect(summaryA.tenant.name).toBe('회사 A')
    expect(summaryA.businessEntity).toMatchObject({ id: 'client-a', name: '사업장 A' })

    const summaryB = await load('tenant-b')
    expect(summaryB.tenant.name).toBe('회사 B')
    expect(summaryB.businessEntity).toMatchObject({ id: 'client-b', name: '사업장 B' })
  })

  it('I-03: excludes another tenant source batches from the requesting tenant scope', async () => {
    await seedTenant('tenant-a', '회사 A')
    await seedTenant('tenant-b', '회사 B')
    await seedClient('client-a', 'tenant-a', '사업장 A')
    await seedClient('client-b', 'tenant-b', '사업장 B')
    // tenant B 자료만 존재한다 — tenant A 요약에 절대 섞이면 안 된다.
    await seedSourceBatch({
      id: 'batch-b',
      tenantId: 'tenant-b',
      clientId: 'client-b',
      legacySessionId: 'session-b',
    })

    const summaryA = await load('tenant-a')
    expect(summaryA.businessEntity?.id).toBe('client-a')
    expect(summaryA.importRows).toEqual([])
    expect(summaryA.completeness.collectedCount).toBe(0)
  })

  it('I-03: excludes another 사업장 batches even inside the same tenant', async () => {
    await seedTenant('tenant-a', '회사 A')
    // 같은 tenant의 두 사업장. businessEntity는 createdAt 순 첫 사업장이다.
    await seedClient('client-a1', 'tenant-a', '사업장 A1')
    await client.execute({
      sql: 'INSERT INTO client (id, tenant_id, name, created_at) VALUES (?, ?, ?, ?)',
      args: ['client-a2', 'tenant-a', '사업장 A2', '2026-02-01T00:00:00+09:00'],
    })
    // 두 번째 사업장에만 자료가 있다 → 첫 사업장 요약에 포함되면 안 된다.
    await seedSourceBatch({
      id: 'batch-a2',
      tenantId: 'tenant-a',
      clientId: 'client-a2',
      legacySessionId: 'session-a2',
    })

    const summary = await load('tenant-a')
    expect(summary.businessEntity?.id).toBe('client-a1')
    expect(summary.importRows).toEqual([])
    expect(summary.completeness.collectedCount).toBe(0)
  })

  it('I-05: tenant with no 사업장 gets an empty summary instead of another tenant data', async () => {
    await seedTenant('tenant-empty', '회사 없음')
    await seedTenant('tenant-b', '회사 B')
    await seedClient('client-b', 'tenant-b', '사업장 B')

    const summary = await load('tenant-empty')
    expect(summary.businessEntity).toBeNull()
    expect(summary.importRows).toEqual([])
    expect(summary.completeness).toMatchObject({
      collectedCount: 0,
      requiredCount: 0,
      missingCount: 0,
      progressPercent: 0,
    })
  })
})
