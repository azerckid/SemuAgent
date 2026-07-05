import { randomUUID } from 'crypto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { and, eq } from 'drizzle-orm'
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
    CREATE TABLE upload_item_declaration (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      source_batch_id text,
      checklist_item_id text NOT NULL,
      declaration text NOT NULL,
      note text,
      declared_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(
    'CREATE UNIQUE INDEX uid_tenant_session_item_uidx ON upload_item_declaration (tenant_id, upload_session_id, checklist_item_id)',
  )
})

async function seed(rows: Array<{
  tenantId: string
  uploadSessionId: string
  checklistItemId: string
  declaration: 'none' | 'later'
  note?: string | null
}>) {
  const { uploadItemDeclaration } = appSchema
  for (const row of rows) {
    await testDb.insert(uploadItemDeclaration).values({
      id: randomUUID(),
      tenantId: row.tenantId,
      uploadSessionId: row.uploadSessionId,
      checklistItemId: row.checklistItemId,
      declaration: row.declaration,
      note: row.note ?? null,
      declaredAt: '2026-06-24T00:00:00.000+09:00',
      updatedAt: '2026-06-24T00:00:00.000+09:00',
    })
  }
}

async function findDeclarations(tenantId: string, uploadSessionId: string) {
  const { uploadItemDeclaration } = appSchema
  return testDb
    .select({ checklistItemId: uploadItemDeclaration.checklistItemId })
    .from(uploadItemDeclaration)
    .where(and(
      eq(uploadItemDeclaration.tenantId, tenantId),
      eq(uploadItemDeclaration.uploadSessionId, uploadSessionId),
    ))
}

beforeEach(async () => {
  await client.execute('DELETE FROM upload_item_declaration')
})

describe('clearUploadItemDeclaration', () => {
  it('해당 (tenant, session, item) row만 지운다', async () => {
    const { clearUploadItemDeclaration } = await import('./item-declaration')
    await seed([
      { tenantId: 't1', uploadSessionId: 's1', checklistItemId: 'i1', declaration: 'none' },
      { tenantId: 't1', uploadSessionId: 's1', checklistItemId: 'i2', declaration: 'later' },
      { tenantId: 't1', uploadSessionId: 's2', checklistItemId: 'i1', declaration: 'none' },
      { tenantId: 't2', uploadSessionId: 's1', checklistItemId: 'i1', declaration: 'none' },
    ])

    await clearUploadItemDeclaration({ tenantId: 't1', uploadSessionId: 's1', checklistItemId: 'i1' })

    // 같은 세션의 다른 항목은 남는다
    const s1 = await findDeclarations('t1', 's1')
    expect(s1.map((r) => r.checklistItemId)).toEqual(['i2'])
    // 다른 세션/테넌트의 같은 항목은 영향 없음
    expect(await findDeclarations('t1', 's2')).toHaveLength(1)
    expect(await findDeclarations('t2', 's1')).toHaveLength(1)
  })

  it('tenant/session이 뒤섞이면 아무것도 지우지 않는다', async () => {
    const { clearUploadItemDeclaration } = await import('./item-declaration')
    await seed([{ tenantId: 't1', uploadSessionId: 's1', checklistItemId: 'i1', declaration: 'none' }])

    await clearUploadItemDeclaration({ tenantId: 's1', uploadSessionId: 't1', checklistItemId: 'i1' })

    expect(await findDeclarations('t1', 's1')).toHaveLength(1)
  })
})
