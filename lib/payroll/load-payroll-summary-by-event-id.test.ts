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
  testDir = mkdtempSync(join(tmpdir(), 'jaryo-payroll-summary-by-event-id-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })

  await client.execute(`
    CREATE TABLE client (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      staff_id text,
      email text NOT NULL,
      contact_name text,
      name text NOT NULL,
      address text,
      phone text,
      analysis_notes text,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE staff (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      user_id text NOT NULL,
      email text NOT NULL,
      name text NOT NULL,
      role text NOT NULL DEFAULT 'STAFF',
      phone text,
      active integer NOT NULL DEFAULT 1,
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE client_request_event (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      request_schedule_id text,
      request_template_id text,
      upload_session_id text,
      accounting_period text NOT NULL,
      frequency text NOT NULL,
      request_kind text NOT NULL DEFAULT 'general',
      title text NOT NULL,
      due_at text NOT NULL,
      status text NOT NULL DEFAULT 'scheduled',
      request_items_snapshot text,
      email_subject_snapshot text,
      email_body_snapshot text,
      email_greeting_snapshot text,
      sender_phone_snapshot text,
      cc_email_snapshot text,
      analysis_criteria_snapshot text,
      deleted_at text,
      deleted_by_staff_id text,
      created_by_staff_id text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
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
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await client.execute('DELETE FROM client')
  await client.execute('DELETE FROM staff')
  await client.execute('DELETE FROM client_request_event')
  await client.execute('DELETE FROM upload_session')
  await client.execute('DELETE FROM outbound_email')
  await client.execute('DELETE FROM payroll_extraction_batch')
  await client.execute('DELETE FROM payroll_extraction_row')
  await client.execute('DELETE FROM payroll_excel_draft')
  await client.execute('DELETE FROM upload_file')
})

async function seedClient(params: { id: string; tenantId: string; name: string }) {
  await client.execute({
    sql: `INSERT INTO client (id, tenant_id, email, name, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [params.id, params.tenantId, `${params.id}@example.com`, params.name, '2026-01-01T00:00:00+09:00'],
  })
}

async function seedEvent(params: {
  id: string
  tenantId: string
  clientId: string
  requestKind?: string
  deletedAt?: string | null
  createdAt?: string
}) {
  await client.execute({
    sql: `INSERT INTO client_request_event
      (id, tenant_id, client_id, accounting_period, frequency, request_kind, title, due_at, status, deleted_at, created_by_staff_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.tenantId,
      params.clientId,
      '2026-06',
      'monthly',
      params.requestKind ?? 'payroll',
      '2026년 6월 급여정산',
      '2026-06-10T00:00:00+09:00',
      'scheduled',
      params.deletedAt ?? null,
      'staff-1',
      params.createdAt ?? '2026-06-01T00:00:00+09:00',
      params.createdAt ?? '2026-06-01T00:00:00+09:00',
    ],
  })
}

describe('loadPayrollSummaryByEventId', () => {
  it('returns null when no event with that id exists in this tenant', async () => {
    const { loadPayrollSummaryByEventId } = await import('./load-payroll-summary-by-event-id')
    const result = await loadPayrollSummaryByEventId('tenant-1', 'nonexistent-event')

    expect(result).toBeNull()
  })

  it('resolves the exact payroll request by id, even though it is outside any recency window', async () => {
    await seedClient({ id: 'client-1', tenantId: 'tenant-1', name: '솔메이트' })
    await seedEvent({ id: 'event-old', tenantId: 'tenant-1', clientId: 'client-1', createdAt: '2020-01-01T00:00:00+09:00' })

    const { loadPayrollSummaryByEventId } = await import('./load-payroll-summary-by-event-id')
    const result = await loadPayrollSummaryByEventId('tenant-1', 'event-old')

    expect(result?.event.id).toBe('event-old')
    expect(result?.displayClientName).toBe('솔메이트')
  })

  it('never returns an event belonging to another tenant', async () => {
    await seedClient({ id: 'client-2', tenantId: 'tenant-2', name: '다른테넌트고객사' })
    await seedEvent({ id: 'event-other-tenant', tenantId: 'tenant-2', clientId: 'client-2' })

    const { loadPayrollSummaryByEventId } = await import('./load-payroll-summary-by-event-id')
    const result = await loadPayrollSummaryByEventId('tenant-1', 'event-other-tenant')

    expect(result).toBeNull()
  })

  it('never returns a general (non-payroll) event — this page only resolves payroll requests', async () => {
    await seedClient({ id: 'client-3', tenantId: 'tenant-1', name: '일반자료고객사' })
    await seedEvent({ id: 'event-general', tenantId: 'tenant-1', clientId: 'client-3', requestKind: 'general' })

    const { loadPayrollSummaryByEventId } = await import('./load-payroll-summary-by-event-id')
    const result = await loadPayrollSummaryByEventId('tenant-1', 'event-general')

    expect(result).toBeNull()
  })

  it('never returns a soft-deleted event', async () => {
    await seedClient({ id: 'client-4', tenantId: 'tenant-1', name: '삭제된요청고객사' })
    await seedEvent({ id: 'event-deleted', tenantId: 'tenant-1', clientId: 'client-4', deletedAt: '2026-06-15T00:00:00+09:00' })

    const { loadPayrollSummaryByEventId } = await import('./load-payroll-summary-by-event-id')
    const result = await loadPayrollSummaryByEventId('tenant-1', 'event-deleted')

    expect(result).toBeNull()
  })
})
