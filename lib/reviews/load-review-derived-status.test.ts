import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'

let client: Client
let testDb: ReturnType<typeof drizzle>
let testDir: string

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

beforeAll(async () => {
  testDir = mkdtempSync(join(tmpdir(), 'jaryo-review-derived-status-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })

  await client.execute(`
    CREATE TABLE upload_session (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      created_by_staff_id text NOT NULL,
      accounting_period text NOT NULL,
      bookkeeping_period_type text,
      bookkeeping_period_start text,
      bookkeeping_period_end text,
      token_hash text NOT NULL UNIQUE,
      upload_url text,
      expires_at text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      analysis_notes text,
      session_evaluation text,
      request_email_subject text,
      request_email_body text,
      request_email_cc text,
      extracted_criteria text,
      additional_criteria text,
      last_accessed_at text,
      request_event_id text,
      request_kind text NOT NULL DEFAULT 'general',
      source text NOT NULL DEFAULT 'customer_upload',
      staff_direct_label text,
      deleted_at text,
      deleted_by_staff_id text,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE upload_file (
      id text PRIMARY KEY,
      upload_session_id text NOT NULL,
      tenant_id text NOT NULL,
      original_filename text NOT NULL,
      storage_key text NOT NULL,
      file_type text NOT NULL,
      file_size integer NOT NULL,
      content_hash text NOT NULL,
      status text NOT NULL DEFAULT 'uploaded',
      password_status text NOT NULL DEFAULT 'none',
      password_last_submitted_at text,
      password_attempt_count integer NOT NULL DEFAULT 0,
      uploaded_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE request_item_validation (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      request_event_id text,
      item_name text NOT NULL,
      item_group text,
      criterion_type text,
      requiredness text NOT NULL DEFAULT 'required',
      condition_text text,
      period_start text,
      period_end text,
      validation_status text NOT NULL DEFAULT 'uncertain',
      review_status text NOT NULL DEFAULT 'ai_suggested',
      ai_reasoning text,
      requested_action text,
      staff_note text,
      reviewed_by_staff_id text,
      reviewed_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE request_item_validation_file (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      validation_id text NOT NULL,
      upload_file_id text NOT NULL,
      contribution text,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE analysis_run (
      id text PRIMARY KEY,
      upload_file_id text NOT NULL,
      tenant_id text NOT NULL,
      provider text NOT NULL,
      model text NOT NULL,
      raw_output text,
      parsed_output text,
      confidence text NOT NULL DEFAULT 'unknown',
      consensus_group text,
      status text NOT NULL DEFAULT 'pending',
      error_message text,
      applied_analysis_notes text,
      criteria_summary text,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_material_attribution (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      source_batch_id text,
      upload_file_id text,
      status text NOT NULL DEFAULT 'active',
      source_kind text NOT NULL DEFAULT 'file_summary',
      source_label text NOT NULL,
      evidence_date text,
      attributed_period text,
      requested_period text NOT NULL,
      close_period text NOT NULL,
      period_relation text NOT NULL DEFAULT 'unknown',
      amount_krw integer,
      counterparty text,
      description text,
      duplicate_status text NOT NULL DEFAULT 'none',
      duplicate_basis text,
      recommendation text NOT NULL DEFAULT 'include',
      staff_decision text,
      staff_note text,
      decided_by_staff_id text,
      decided_at text,
      created_by_staff_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await client.execute('DELETE FROM upload_session')
  await client.execute('DELETE FROM upload_file')
  await client.execute('DELETE FROM request_item_validation')
  await client.execute('DELETE FROM request_item_validation_file')
  await client.execute('DELETE FROM analysis_run')
  await client.execute('DELETE FROM bookkeeping_material_attribution')
})

async function seedSession(params: { id: string; tenantId: string; status: string; createdAt: string; sessionEvaluation?: string | null }) {
  await client.execute({
    sql: `INSERT INTO upload_session
      (id, tenant_id, client_id, created_by_staff_id, accounting_period, token_hash, expires_at, status, session_evaluation, request_kind, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.tenantId,
      'client-1',
      'staff-1',
      '2026-06',
      `${params.id}-token`,
      '2026-06-30T23:59:59+09:00',
      params.status,
      params.sessionEvaluation ?? null,
      'general',
      params.createdAt,
    ],
  })
}

async function seedFile(params: { id: string; uploadSessionId: string; tenantId: string; status: string }) {
  await client.execute({
    sql: `INSERT INTO upload_file
      (id, upload_session_id, tenant_id, original_filename, storage_key, file_type, file_size, content_hash, status, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [params.id, params.uploadSessionId, params.tenantId, 'bank.pdf', `key-${params.id}`, 'pdf', 1000, `hash-${params.id}`, params.status, '2026-06-10T00:00:00+09:00'],
  })
}

describe('loadReviewDerivedStatusBySessionId', () => {
  it('returns an empty map when there are no session ids', async () => {
    const { loadReviewDerivedStatusBySessionId } = await import('./load-review-derived-status')
    const result = await loadReviewDerivedStatusBySessionId({
      tenantId: 'tenant-1',
      sessionIds: [],
      clientId: 'client-1',
      clientName: '테스트',
      clientEmail: '',
      staffName: null,
    })

    expect(result.size).toBe(0)
  })

  it('derives "평가 필요" for a submitted session with files but no session evaluation yet — matching /dashboard/reviews exactly', async () => {
    await seedSession({ id: 'session-1', tenantId: 'tenant-1', status: 'submitted', createdAt: '2026-06-10T00:00:00+09:00', sessionEvaluation: null })
    await seedFile({ id: 'file-1', uploadSessionId: 'session-1', tenantId: 'tenant-1', status: 'matched' })

    const { loadReviewDerivedStatusBySessionId } = await import('./load-review-derived-status')
    const result = await loadReviewDerivedStatusBySessionId({
      tenantId: 'tenant-1',
      sessionIds: ['session-1'],
      clientId: 'client-1',
      clientName: '테스트',
      clientEmail: '',
      staffName: null,
    })

    expect(result.get('session-1')?.label).toBe('평가 필요')
  })

  it('derives "제출 없음" for a session with no uploaded files', async () => {
    await seedSession({ id: 'session-2', tenantId: 'tenant-1', status: 'requested', createdAt: '2026-06-10T00:00:00+09:00' })

    const { loadReviewDerivedStatusBySessionId } = await import('./load-review-derived-status')
    const result = await loadReviewDerivedStatusBySessionId({
      tenantId: 'tenant-1',
      sessionIds: ['session-2'],
      clientId: 'client-1',
      clientName: '테스트',
      clientEmail: '',
      staffName: null,
    })

    expect(result.get('session-2')?.label).toBe('제출 없음')
  })

  it('only returns sessions scoped to the given tenantId, never leaking another tenant\'s session', async () => {
    await seedSession({ id: 'session-other-tenant', tenantId: 'tenant-2', status: 'requested', createdAt: '2026-06-10T00:00:00+09:00' })

    const { loadReviewDerivedStatusBySessionId } = await import('./load-review-derived-status')
    const result = await loadReviewDerivedStatusBySessionId({
      tenantId: 'tenant-1',
      sessionIds: ['session-other-tenant'],
      clientId: 'client-1',
      clientName: '테스트',
      clientEmail: '',
      staffName: null,
    })

    expect(result.size).toBe(0)
  })
})
