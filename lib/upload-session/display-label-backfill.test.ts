import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient, type Client } from '@libsql/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('0046_backfill_upload_session_display_labels.sql', () => {
  let client: Client

  beforeEach(async () => {
    client = createClient({ url: ':memory:' })
    await client.executeMultiple(`
      CREATE TABLE client (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        name text NOT NULL
      );

      CREATE TABLE upload_session (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        client_id text NOT NULL,
        source text NOT NULL DEFAULT 'customer_upload',
        staff_direct_label text,
        created_at text NOT NULL
      );
    `)
  })

  afterEach(async () => {
    await client.close()
  })

  async function labelsById() {
    const result = await client.execute(`
      SELECT id, staff_direct_label
      FROM upload_session
      ORDER BY id
    `)
    return new Map(result.rows.map((row) => [String(row.id), row.staff_direct_label]))
  }

  it('numbers all customer-upload sessions by tenant and client without touching staff-direct labels', async () => {
    await client.batch([
      {
        sql: 'INSERT INTO client (id, tenant_id, name) VALUES (?, ?, ?)',
        args: ['client-a', 'tenant-1', '솔메이트'],
      },
      {
        sql: 'INSERT INTO client (id, tenant_id, name) VALUES (?, ?, ?)',
        args: ['client-b', 'tenant-1', '다른회사'],
      },
      {
        sql: 'INSERT INTO client (id, tenant_id, name) VALUES (?, ?, ?)',
        args: ['client-c', 'tenant-2', '솔메이트'],
      },
      {
        sql: `INSERT INTO upload_session
          (id, tenant_id, client_id, source, staff_direct_label, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: ['s1', 'tenant-1', 'client-a', 'customer_upload', null, '2026-01-01 00:00:00'],
      },
      {
        sql: `INSERT INTO upload_session
          (id, tenant_id, client_id, source, staff_direct_label, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: ['s2', 'tenant-1', 'client-a', 'customer_upload', '솔메이트_01', '2026-03-01 00:00:00'],
      },
      {
        sql: `INSERT INTO upload_session
          (id, tenant_id, client_id, source, staff_direct_label, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: ['s3', 'tenant-1', 'client-a', 'customer_upload', null, '2026-06-01 00:00:00'],
      },
      {
        sql: `INSERT INTO upload_session
          (id, tenant_id, client_id, source, staff_direct_label, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: ['s4', 'tenant-1', 'client-b', 'customer_upload', null, '2026-02-01 00:00:00'],
      },
      {
        sql: `INSERT INTO upload_session
          (id, tenant_id, client_id, source, staff_direct_label, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: ['s5', 'tenant-2', 'client-c', 'customer_upload', null, '2026-02-01 00:00:00'],
      },
      {
        sql: `INSERT INTO upload_session
          (id, tenant_id, client_id, source, staff_direct_label, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: ['s6', 'tenant-1', 'client-a', 'staff_direct', '담당자 입력명', '2026-04-01 00:00:00'],
      },
    ])

    const migration = readFileSync(resolve('drizzle/0046_backfill_upload_session_display_labels.sql'), 'utf8')
    await client.executeMultiple(migration)

    expect(await labelsById()).toEqual(new Map([
      ['s1', '솔메이트_01'],
      ['s2', '솔메이트_02'],
      ['s3', '솔메이트_03'],
      ['s4', '다른회사_01'],
      ['s5', '솔메이트_01'],
      ['s6', '담당자 입력명'],
    ]))
  })
})
