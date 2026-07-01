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
  testDir = mkdtempSync(join(tmpdir(), 'jaryo-review-session-by-id-'))
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
      staff_review_status text NOT NULL DEFAULT 'none',
      staff_review_note text,
      staff_reviewed_by_staff_id text,
      staff_reviewed_at text,
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
  await client.execute(`
    CREATE TABLE checklist_item (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      template_id text NOT NULL,
      name text NOT NULL,
      description text,
      required integer NOT NULL DEFAULT 1,
      analysis_rules text,
      sort_order integer NOT NULL DEFAULT 0
    )
  `)
  await client.execute(`
    CREATE TABLE upload_item_declaration (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      checklist_item_id text NOT NULL,
      declaration text NOT NULL,
      note text,
      declared_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await client.execute('DELETE FROM client')
  await client.execute('DELETE FROM staff')
  await client.execute('DELETE FROM upload_session')
  await client.execute('DELETE FROM upload_file')
  await client.execute('DELETE FROM request_item_validation')
  await client.execute('DELETE FROM request_item_validation_file')
  await client.execute('DELETE FROM analysis_run')
  await client.execute('DELETE FROM bookkeeping_material_attribution')
  await client.execute('DELETE FROM checklist_item')
  await client.execute('DELETE FROM upload_item_declaration')
})

async function seedClient(params: { id: string; tenantId: string; name: string }) {
  await client.execute({
    sql: `INSERT INTO client (id, tenant_id, email, name, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [params.id, params.tenantId, `${params.id}@example.com`, params.name, '2026-01-01T00:00:00+09:00'],
  })
}

async function seedSession(params: {
  id: string
  tenantId: string
  clientId: string
  status?: string
  requestKind?: string
  deletedAt?: string | null
  createdAt?: string
}) {
  await client.execute({
    sql: `INSERT INTO upload_session
      (id, tenant_id, client_id, created_by_staff_id, accounting_period, token_hash, expires_at, status, request_kind, deleted_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.tenantId,
      params.clientId,
      'staff-1',
      '2026-06',
      `${params.id}-token`,
      '2026-06-30T23:59:59+09:00',
      params.status ?? 'requested',
      params.requestKind ?? 'general',
      params.deletedAt ?? null,
      params.createdAt ?? '2026-06-01T00:00:00+09:00',
    ],
  })
}

async function seedChecklistItem(params: {
  id: string
  tenantId: string
  name: string
  sortOrder?: number
}) {
  await client.execute({
    sql: `INSERT INTO checklist_item
      (id, tenant_id, template_id, name, required, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [params.id, params.tenantId, `${params.tenantId}-template`, params.name, 1, params.sortOrder ?? 0],
  })
}

async function seedItemDeclaration(params: {
  id: string
  tenantId: string
  uploadSessionId: string
  checklistItemId: string
  declaration: 'none' | 'later'
  note?: string | null
}) {
  await client.execute({
    sql: `INSERT INTO upload_item_declaration
      (id, tenant_id, upload_session_id, checklist_item_id, declaration, note, declared_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      params.tenantId,
      params.uploadSessionId,
      params.checklistItemId,
      params.declaration,
      params.note ?? null,
      '2026-06-24T00:00:00+09:00',
      '2026-06-24T00:00:00+09:00',
    ],
  })
}

describe('loadReviewSessionById', () => {
  it('returns null when no session with that id exists in this tenant', async () => {
    const { loadReviewSessionById } = await import('./load-review-session-by-id')
    const result = await loadReviewSessionById('tenant-1', 'nonexistent-session')

    expect(result).toBeNull()
  })

  it('resolves the exact session by id, even though it is outside any recency window', async () => {
    await seedClient({ id: 'client-1', tenantId: 'tenant-1', name: '솔메이트' })
    await seedSession({ id: 'session-old', tenantId: 'tenant-1', clientId: 'client-1', createdAt: '2020-01-01T00:00:00+09:00' })

    const { loadReviewSessionById } = await import('./load-review-session-by-id')
    const result = await loadReviewSessionById('tenant-1', 'session-old')

    expect(result?.id).toBe('session-old')
    expect(result?.clientName).toBe('솔메이트')
  })

  it('never returns a session belonging to another tenant', async () => {
    await seedClient({ id: 'client-2', tenantId: 'tenant-2', name: '다른테넌트고객사' })
    await seedSession({ id: 'session-other-tenant', tenantId: 'tenant-2', clientId: 'client-2' })

    const { loadReviewSessionById } = await import('./load-review-session-by-id')
    const result = await loadReviewSessionById('tenant-1', 'session-other-tenant')

    expect(result).toBeNull()
  })

  it('never returns a payroll session — this page only resolves general sessions', async () => {
    await seedClient({ id: 'client-3', tenantId: 'tenant-1', name: '급여전용고객사' })
    await seedSession({ id: 'session-payroll', tenantId: 'tenant-1', clientId: 'client-3', requestKind: 'payroll' })

    const { loadReviewSessionById } = await import('./load-review-session-by-id')
    const result = await loadReviewSessionById('tenant-1', 'session-payroll')

    expect(result).toBeNull()
  })

  it('never returns a soft-deleted session', async () => {
    await seedClient({ id: 'client-4', tenantId: 'tenant-1', name: '삭제된세션고객사' })
    await seedSession({ id: 'session-deleted', tenantId: 'tenant-1', clientId: 'client-4', deletedAt: '2026-06-15T00:00:00+09:00' })

    const { loadReviewSessionById } = await import('./load-review-session-by-id')
    const result = await loadReviewSessionById('tenant-1', 'session-deleted')

    expect(result).toBeNull()
  })

  it('attaches client item declarations with checklist item names', async () => {
    await seedClient({ id: 'client-5', tenantId: 'tenant-1', name: '선언고객사' })
    await seedSession({ id: 'session-declared', tenantId: 'tenant-1', clientId: 'client-5' })
    await seedChecklistItem({ id: 'item-bank', tenantId: 'tenant-1', name: '통장 거래내역', sortOrder: 1 })
    await seedChecklistItem({ id: 'item-card', tenantId: 'tenant-1', name: '카드 사용내역', sortOrder: 2 })
    await seedChecklistItem({ id: 'item-cross-tenant', tenantId: 'tenant-2', name: '다른 테넌트 항목', sortOrder: 3 })
    await seedItemDeclaration({
      id: 'decl-bank',
      tenantId: 'tenant-1',
      uploadSessionId: 'session-declared',
      checklistItemId: 'item-bank',
      declaration: 'none',
      note: '이번 기간 거래 없음',
    })
    await seedItemDeclaration({
      id: 'decl-card',
      tenantId: 'tenant-1',
      uploadSessionId: 'session-declared',
      checklistItemId: 'item-card',
      declaration: 'later',
    })
    // 방어적 회귀: 선언 row의 tenant가 맞아도 조인 대상 checklist_item tenant가
    // 다르면 담당자 화면에 노출하지 않는다.
    await seedItemDeclaration({
      id: 'decl-cross',
      tenantId: 'tenant-1',
      uploadSessionId: 'session-declared',
      checklistItemId: 'item-cross-tenant',
      declaration: 'none',
    })

    const { loadReviewSessionById } = await import('./load-review-session-by-id')
    const result = await loadReviewSessionById('tenant-1', 'session-declared')

    expect(result?.itemDeclarations).toEqual([
      {
        checklistItemId: 'item-bank',
        itemName: '통장 거래내역',
        declaration: 'none',
        note: '이번 기간 거래 없음',
      },
      {
        checklistItemId: 'item-card',
        itemName: '카드 사용내역',
        declaration: 'later',
        note: null,
      },
    ])
  })
})
