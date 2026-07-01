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
  testDir = mkdtempSync(join(tmpdir(), 'jaryo-payroll-derived-status-'))
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
    CREATE TABLE outbound_email (
      id text PRIMARY KEY,
      upload_session_id text NOT NULL,
      tenant_id text NOT NULL,
      type text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      to_email text NOT NULL,
      cc_email text,
      subject text NOT NULL,
      body text NOT NULL,
      applied_analysis_notes text,
      criteria_summary text,
      request_event_id text,
      request_template_id text,
      approved_by_staff_id text,
      sent_at text,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE payroll_extraction_batch (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      request_event_id text,
      status text NOT NULL DEFAULT 'pending',
      source_upload_file_ids text NOT NULL,
      model text,
      error_message text,
      created_by_staff_id text,
      created_at text NOT NULL,
      completed_at text
    )
  `)
  await client.execute(`
    CREATE TABLE payroll_extraction_row (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      batch_id text NOT NULL,
      upload_session_id text NOT NULL,
      payroll_period text NOT NULL,
      employee_code text,
      employee_name text,
      confidence text NOT NULL DEFAULT 'unknown',
      ai_verdict text,
      ai_verdict_reason text,
      review_status text NOT NULL DEFAULT 'needs_review',
      reviewed_by_staff_id text,
      reviewed_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE payroll_excel_draft (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      batch_id text NOT NULL,
      template_id text NOT NULL,
      status text NOT NULL,
      storage_key text,
      filename text NOT NULL,
      confirmed_row_count integer NOT NULL,
      excluded_row_count integer NOT NULL,
      error_message text,
      generated_by_staff_id text NOT NULL,
      generated_at text NOT NULL
    )
  `)
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await client.execute('DELETE FROM upload_session')
  await client.execute('DELETE FROM outbound_email')
  await client.execute('DELETE FROM payroll_extraction_batch')
  await client.execute('DELETE FROM payroll_extraction_row')
  await client.execute('DELETE FROM payroll_excel_draft')
})

async function seedSession(params: { id: string; tenantId: string; clientId?: string; status: string; requestKind?: string }) {
  await client.execute({
    sql: `INSERT INTO upload_session
      (id, tenant_id, client_id, created_by_staff_id, accounting_period, token_hash, expires_at, status, request_kind, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.tenantId,
      params.clientId ?? 'client-1',
      'staff-1',
      '2026-06',
      `${params.id}-token`,
      '2026-06-30T23:59:59+09:00',
      params.status,
      params.requestKind ?? 'payroll',
      '2026-06-01T00:00:00+09:00',
    ],
  })
}

async function seedBatch(params: { id: string; uploadSessionId: string; tenantId: string; status: string; createdAt: string }) {
  await client.execute({
    sql: `INSERT INTO payroll_extraction_batch
      (id, tenant_id, upload_session_id, status, source_upload_file_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [params.id, params.tenantId, params.uploadSessionId, params.status, '[]', params.createdAt],
  })
}

async function seedRow(params: { id: string; tenantId: string; batchId: string; uploadSessionId: string; aiVerdict: 'pass' | 'fail' | null }) {
  await client.execute({
    sql: `INSERT INTO payroll_extraction_row
      (id, tenant_id, batch_id, upload_session_id, payroll_period, ai_verdict, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [params.id, params.tenantId, params.batchId, params.uploadSessionId, '2026-06', params.aiVerdict, '2026-06-05T00:00:00+09:00', '2026-06-05T00:00:00+09:00'],
  })
}

async function seedDraft(params: { id: string; tenantId: string; uploadSessionId: string; batchId: string; status: 'generated' | 'failed'; generatedAt: string }) {
  await client.execute({
    sql: `INSERT INTO payroll_excel_draft
      (id, tenant_id, upload_session_id, batch_id, template_id, status, filename, confirmed_row_count, excluded_row_count, generated_by_staff_id, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [params.id, params.tenantId, params.uploadSessionId, params.batchId, 'template-1', params.status, 'result.xlsx', 0, 0, 'staff-1', params.generatedAt],
  })
}

describe('loadPayrollDerivedStatusBySessionId', () => {
  it('returns an empty map when there are no session ids', async () => {
    const { loadPayrollDerivedStatusBySessionId } = await import('./load-payroll-derived-status')
    const result = await loadPayrollDerivedStatusBySessionId({ tenantId: 'tenant-1', clientId: 'client-1', sessionIds: [] })

    expect(result.size).toBe(0)
  })

  it('falls back to the session status label when there is no batch yet', async () => {
    await seedSession({ id: 'session-1', tenantId: 'tenant-1', status: 'requested' })

    const { loadPayrollDerivedStatusBySessionId } = await import('./load-payroll-derived-status')
    const result = await loadPayrollDerivedStatusBySessionId({ tenantId: 'tenant-1', clientId: 'client-1', sessionIds: ['session-1'] })

    expect(result.get('session-1')?.label).toBe('제출 없음')
  })

  it('derives "작성 가능" when the latest batch has passing rows and no draft yet', async () => {
    await seedSession({ id: 'session-2', tenantId: 'tenant-1', status: 'submitted' })
    await seedBatch({ id: 'batch-1', uploadSessionId: 'session-2', tenantId: 'tenant-1', status: 'completed', createdAt: '2026-06-10T00:00:00+09:00' })
    await seedRow({ id: 'row-1', tenantId: 'tenant-1', batchId: 'batch-1', uploadSessionId: 'session-2', aiVerdict: 'pass' })

    const { loadPayrollDerivedStatusBySessionId } = await import('./load-payroll-derived-status')
    const result = await loadPayrollDerivedStatusBySessionId({ tenantId: 'tenant-1', clientId: 'client-1', sessionIds: ['session-2'] })

    expect(result.get('session-2')?.label).toBe('작성 가능')
  })

  it('derives "부적합" when the latest batch has any failing row, even if other rows pass', async () => {
    await seedSession({ id: 'session-3', tenantId: 'tenant-1', status: 'submitted' })
    await seedBatch({ id: 'batch-2', uploadSessionId: 'session-3', tenantId: 'tenant-1', status: 'completed', createdAt: '2026-06-10T00:00:00+09:00' })
    await seedRow({ id: 'row-2', tenantId: 'tenant-1', batchId: 'batch-2', uploadSessionId: 'session-3', aiVerdict: 'pass' })
    await seedRow({ id: 'row-3', tenantId: 'tenant-1', batchId: 'batch-2', uploadSessionId: 'session-3', aiVerdict: 'fail' })

    const { loadPayrollDerivedStatusBySessionId } = await import('./load-payroll-derived-status')
    const result = await loadPayrollDerivedStatusBySessionId({ tenantId: 'tenant-1', clientId: 'client-1', sessionIds: ['session-3'] })

    expect(result.get('session-3')?.label).toBe('부적합')
  })

  it('derives "엑셀 생성" once a draft has been generated for the latest batch', async () => {
    await seedSession({ id: 'session-4', tenantId: 'tenant-1', status: 'submitted' })
    await seedBatch({ id: 'batch-3', uploadSessionId: 'session-4', tenantId: 'tenant-1', status: 'completed', createdAt: '2026-06-10T00:00:00+09:00' })
    await seedRow({ id: 'row-4', tenantId: 'tenant-1', batchId: 'batch-3', uploadSessionId: 'session-4', aiVerdict: 'pass' })
    await seedDraft({ id: 'draft-1', tenantId: 'tenant-1', uploadSessionId: 'session-4', batchId: 'batch-3', status: 'generated', generatedAt: '2026-06-11T00:00:00+09:00' })

    const { loadPayrollDerivedStatusBySessionId } = await import('./load-payroll-derived-status')
    const result = await loadPayrollDerivedStatusBySessionId({ tenantId: 'tenant-1', clientId: 'client-1', sessionIds: ['session-4'] })

    expect(result.get('session-4')?.label).toBe('엑셀 생성')
  })

  it('only counts rows from the latest batch — an older failed batch must not leak into a newer passing one', async () => {
    await seedSession({ id: 'session-5', tenantId: 'tenant-1', status: 'submitted' })
    await seedBatch({ id: 'batch-old', uploadSessionId: 'session-5', tenantId: 'tenant-1', status: 'completed', createdAt: '2026-06-01T00:00:00+09:00' })
    await seedRow({ id: 'row-old', tenantId: 'tenant-1', batchId: 'batch-old', uploadSessionId: 'session-5', aiVerdict: 'fail' })
    await seedBatch({ id: 'batch-new', uploadSessionId: 'session-5', tenantId: 'tenant-1', status: 'completed', createdAt: '2026-06-15T00:00:00+09:00' })
    await seedRow({ id: 'row-new', tenantId: 'tenant-1', batchId: 'batch-new', uploadSessionId: 'session-5', aiVerdict: 'pass' })

    const { loadPayrollDerivedStatusBySessionId } = await import('./load-payroll-derived-status')
    const result = await loadPayrollDerivedStatusBySessionId({ tenantId: 'tenant-1', clientId: 'client-1', sessionIds: ['session-5'] })

    expect(result.get('session-5')?.label).toBe('작성 가능')
  })

  it('never returns a session belonging to another tenant', async () => {
    await seedSession({ id: 'session-other-tenant', tenantId: 'tenant-2', status: 'requested' })

    const { loadPayrollDerivedStatusBySessionId } = await import('./load-payroll-derived-status')
    const result = await loadPayrollDerivedStatusBySessionId({ tenantId: 'tenant-1', clientId: 'client-1', sessionIds: ['session-other-tenant'] })

    expect(result.size).toBe(0)
  })

  it('never returns a session belonging to another client in the same tenant', async () => {
    await seedSession({ id: 'session-other-client', tenantId: 'tenant-1', clientId: 'client-2', status: 'requested' })

    const { loadPayrollDerivedStatusBySessionId } = await import('./load-payroll-derived-status')
    const result = await loadPayrollDerivedStatusBySessionId({ tenantId: 'tenant-1', clientId: 'client-1', sessionIds: ['session-other-client'] })

    expect(result.size).toBe(0)
  })

  it('never returns a non-payroll session even if its id is passed in', async () => {
    await seedSession({ id: 'session-general', tenantId: 'tenant-1', status: 'requested', requestKind: 'general' })

    const { loadPayrollDerivedStatusBySessionId } = await import('./load-payroll-derived-status')
    const result = await loadPayrollDerivedStatusBySessionId({ tenantId: 'tenant-1', clientId: 'client-1', sessionIds: ['session-general'] })

    expect(result.size).toBe(0)
  })
})
