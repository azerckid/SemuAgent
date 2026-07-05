import { randomUUID } from 'crypto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

const { listActiveSourceBatchSessions, resolveActiveSourceBatchSessionIds } = await import('./scope')

const TENANT_A = 'tenant-a'
const TENANT_B = 'tenant-b'
const CLIENT_A = 'client-a'

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: appSchema })
  await client.execute(`
    CREATE TABLE source_batch (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      created_by_staff_id text NOT NULL,
      source_kind text NOT NULL DEFAULT 'staff_direct',
      accounting_period text NOT NULL,
      bookkeeping_period_type text,
      bookkeeping_period_start text,
      bookkeeping_period_end text,
      display_label text,
      legacy_upload_session_id text,
      deleted_at text,
      deleted_by_staff_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
})

beforeEach(async () => {
  await client.execute('DELETE FROM source_batch')
})

async function seedBatch(overrides: Partial<{
  id: string
  tenantId: string
  clientId: string
  sourceKind: string
  accountingPeriod: string
  bookkeepingPeriodStart: string | null
  bookkeepingPeriodEnd: string | null
  legacyUploadSessionId: string | null
  deletedAt: string | null
  createdAt: string
}>) {
  const id = overrides.id ?? randomUUID()
  await client.execute({
    sql: `INSERT INTO source_batch (
      id, tenant_id, client_id, created_by_staff_id, source_kind, accounting_period,
      bookkeeping_period_type, bookkeeping_period_start, bookkeeping_period_end,
      display_label, legacy_upload_session_id, deleted_at, deleted_by_staff_id, created_at, updated_at
    ) VALUES (?, ?, ?, 'staff-1', ?, ?, 'monthly', ?, ?, NULL, ?, ?, NULL, ?, ?)`,
    args: [
      id,
      overrides.tenantId ?? TENANT_A,
      overrides.clientId ?? CLIENT_A,
      overrides.sourceKind ?? 'staff_direct',
      overrides.accountingPeriod ?? '2026-06',
      overrides.bookkeepingPeriodStart ?? '2026-06',
      overrides.bookkeepingPeriodEnd ?? '2026-06',
      overrides.legacyUploadSessionId === undefined ? `session-${id}` : overrides.legacyUploadSessionId,
      overrides.deletedAt ?? null,
      overrides.createdAt ?? '2026-06-01T00:00:00.000+09:00',
      overrides.createdAt ?? '2026-06-01T00:00:00.000+09:00',
    ],
  })
  return id
}

describe('listActiveSourceBatchSessions', () => {
  it('scopes to tenant and client (JC-031 3b)', async () => {
    await seedBatch({ id: 'a1', tenantId: TENANT_A, clientId: CLIENT_A, legacyUploadSessionId: 'session-a1' })
    await seedBatch({ id: 'b1', tenantId: TENANT_B, clientId: CLIENT_A, legacyUploadSessionId: 'session-b1' })
    await seedBatch({ id: 'a2', tenantId: TENANT_A, clientId: 'client-other', legacyUploadSessionId: 'session-a2' })

    const rows = await listActiveSourceBatchSessions({ tenantId: TENANT_A, clientId: CLIENT_A })

    expect(rows.map((row) => row.id)).toEqual(['session-a1'])
  })

  it('only returns staff_direct source_kind rows (JC-031 3b)', async () => {
    await seedBatch({ id: 'direct', sourceKind: 'staff_direct', legacyUploadSessionId: 'session-direct' })
    await seedBatch({ id: 'customer', sourceKind: 'customer_upload', legacyUploadSessionId: 'session-customer' })
    await seedBatch({ id: 'legacy', sourceKind: 'legacy_upload_session', legacyUploadSessionId: 'session-legacy' })
    await seedBatch({ id: 'sample', sourceKind: 'sample_data', legacyUploadSessionId: 'session-sample' })

    const rows = await listActiveSourceBatchSessions({ tenantId: TENANT_A, clientId: CLIENT_A })

    expect(rows.map((row) => row.id)).toEqual(['session-direct'])
  })

  it('excludes soft-deleted source_batch rows (JC-031 3b)', async () => {
    await seedBatch({ id: 'active', legacyUploadSessionId: 'session-active', deletedAt: null })
    await seedBatch({ id: 'deleted', legacyUploadSessionId: 'session-deleted', deletedAt: '2026-06-15T00:00:00.000+09:00' })

    const rows = await listActiveSourceBatchSessions({ tenantId: TENANT_A, clientId: CLIENT_A })

    expect(rows.map((row) => row.id)).toEqual(['session-active'])
  })

  it('excludes rows with no legacy_upload_session_id bridge (JC-031 3b)', async () => {
    await seedBatch({ id: 'bridged', legacyUploadSessionId: 'session-bridged' })
    await seedBatch({ id: 'unbridged', legacyUploadSessionId: null })

    const rows = await listActiveSourceBatchSessions({ tenantId: TENANT_A, clientId: CLIENT_A })

    expect(rows.map((row) => row.id)).toEqual(['session-bridged'])
  })
})

describe('resolveActiveSourceBatchSessionIds', () => {
  it('keeps only sessions whose period overlaps the requested range (JC-031 3b)', async () => {
    await seedBatch({
      id: 'in-range',
      legacyUploadSessionId: 'session-in-range',
      bookkeepingPeriodStart: '2026-05',
      bookkeepingPeriodEnd: '2026-06',
    })
    await seedBatch({
      id: 'out-of-range',
      legacyUploadSessionId: 'session-out-of-range',
      bookkeepingPeriodStart: '2025-01',
      bookkeepingPeriodEnd: '2025-03',
    })

    const ids = await resolveActiveSourceBatchSessionIds({
      tenantId: TENANT_A,
      clientId: CLIENT_A,
      period: { startMonth: '2026-01', endMonth: '2026-12' },
    })

    expect(ids).toEqual(['session-in-range'])
  })
})
