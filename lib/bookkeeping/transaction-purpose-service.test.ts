import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// classification-service → classification-ai → lib/env 가 모듈 로드 시 env 검증하므로,
// 정적 import보다 먼저 env를 셋업한다(vitest가 vi.hoisted를 최상단으로 끌어올림).
vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = 'libsql://test.local'
  process.env.TURSO_AUTH_TOKEN = 'test-token'
  process.env.BETTER_AUTH_SECRET = '12345678901234567890123456789012'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  process.env.PUBLIC_UPLOAD_BASE_URL = 'https://company.jaaryo.online'
})

import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq } from 'drizzle-orm'
import * as appSchema from '@/lib/db/schema'
import {
  bookkeepingTransactionPurposeRequest,
  bookkeepingTransactionPurposeRequestRow,
} from '@/lib/db/schema'
import {
  createPurposeRequestDraft,
  updatePurposeRequestDraft,
} from './transaction-purpose-service'

let client: Client
let testDb: ReturnType<typeof drizzle>
let testDir: string

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

const TENANT = 'tenant-1'
const STAFF_ID = 'staff-1'
const SESSION_GENERAL = 'session-general'
const SESSION_PAYROLL = 'session-payroll'
const SESSION_COMPLETED = 'session-completed'
const CLIENT_ID = 'client-1'
const ROW_NEEDS_DECISION = 'row-needs-decision'
const ROW_EXCLUDED = 'row-excluded'

const staffRecord = { id: STAFF_ID, role: 'TENANT_ADMIN' as const }

beforeAll(async () => {
  // db.transaction()이 연결을 나눠 쓰므로 file 기반 sqlite를 쓴다(:memory:는 매번 빈 DB).
  testDir = mkdtempSync(join(tmpdir(), 'jaryo-purpose-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })

  await client.execute(`
    CREATE TABLE client (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      name text NOT NULL,
      email text
    )
  `)
  await client.execute(`CREATE TABLE tenant (id text PRIMARY KEY, name text NOT NULL)`)
  await client.execute(`CREATE TABLE staff (id text PRIMARY KEY, name text NOT NULL)`)
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
      created_at text NOT NULL DEFAULT '2026-05-01'
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_transaction_classification (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      classification_run_id text NOT NULL,
      upload_session_id text NOT NULL,
      upload_file_id text,
      source_type text NOT NULL DEFAULT 'other',
      transaction_date text,
      merchant_name text,
      description text,
      amount_krw integer,
      direction text NOT NULL DEFAULT 'unknown',
      recommended_account text,
      recommendation_confidence text NOT NULL DEFAULT 'low',
      recommendation_reason text,
      evidence_json text,
      final_account text,
      staff_memo text,
      status text NOT NULL DEFAULT 'suggested',
      confirmed_by_staff_id text,
      confirmed_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_transaction_purpose_request (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      classification_run_id text,
      client_id text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      subject_snapshot text NOT NULL,
      body_snapshot text NOT NULL,
      due_at text,
      sent_email_id text,
      created_by_staff_id text NOT NULL,
      sent_by_staff_id text,
      sent_at text,
      submitted_at text,
      closed_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_transaction_purpose_request_row (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      purpose_request_id text NOT NULL,
      classification_row_id text,
      source_display_date text,
      source_display_counterparty text,
      source_display_amount_krw integer,
      source_display_memo text,
      staff_question text NOT NULL,
      ai_recommended_account text,
      ambiguity_reason text,
      client_purpose_code text,
      client_purpose_memo text,
      client_answered_at text,
      staff_final_account text,
      staff_memo text,
      status text NOT NULL DEFAULT 'pending',
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
})

afterAll(() => {
  if (testDir) rmSync(testDir, { recursive: true, force: true })
})

async function seedSession(id: string, overrides: Partial<{ requestKind: string; status: string; uploadUrl: string }> = {}) {
  await client.execute({
    sql: `INSERT INTO upload_session (id, tenant_id, client_id, created_by_staff_id, accounting_period, token_hash, upload_url, expires_at, status, request_kind, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'customer_upload')`,
    args: [id, TENANT, CLIENT_ID, STAFF_ID, '2026-05', `hash-${id}`, overrides.uploadUrl ?? `https://example.com/upload/token-${id}`, '2026-12-31T23:59:59+09:00', overrides.status ?? 'submitted', overrides.requestKind ?? 'general'],
  })
}

async function seedClassificationRow(id: string, status: string) {
  await client.execute({
    sql: `INSERT INTO bookkeeping_transaction_classification
          (id, tenant_id, classification_run_id, upload_session_id, source_type, transaction_date, merchant_name, description, amount_krw, direction, recommended_account, recommendation_confidence, recommendation_reason, status, created_at, updated_at)
          VALUES (?, ?, 'run-1', ?, 'bank', '2026-05-10', '카페골목', '커피 구매', 15000, 'expense', '복리후생비', 'low', '용도 불명확', ?, '2026-05-11', '2026-05-11')`,
    args: [id, TENANT, SESSION_GENERAL, status],
  })
}

beforeEach(async () => {
  await client.execute('DELETE FROM bookkeeping_transaction_purpose_request_row')
  await client.execute('DELETE FROM bookkeeping_transaction_purpose_request')
  await client.execute('DELETE FROM bookkeeping_transaction_classification')
  await client.execute('DELETE FROM upload_session')
  await client.execute('DELETE FROM client')
  await client.execute('DELETE FROM tenant')
  await client.execute('DELETE FROM staff')
  await client.execute({ sql: 'INSERT INTO client (id, tenant_id, name, email) VALUES (?, ?, ?, ?)', args: [CLIENT_ID, TENANT, '디와이_01', 'qa@example.com'] })
  await client.execute({ sql: 'INSERT INTO tenant (id, name) VALUES (?, ?)', args: [TENANT, '춘심회계법인'] })
  await client.execute({ sql: 'INSERT INTO staff (id, name) VALUES (?, ?)', args: [STAFF_ID, '춘심이'] })
  await seedSession(SESSION_GENERAL)
  await seedSession(SESSION_PAYROLL, { requestKind: 'payroll' })
  await seedSession(SESSION_COMPLETED, { status: 'completed' })
  await seedClassificationRow(ROW_NEEDS_DECISION, 'needs_decision')
  await seedClassificationRow(ROW_EXCLUDED, 'excluded')
})

describe('createPurposeRequestDraft', () => {
  it('선택 row로 draft를 만들고 pending row를 생성한다', async () => {
    const result = await createPurposeRequestDraft({
      sessionId: SESSION_GENERAL,
      tenantId: TENANT,
      staffRecord,
      input: { selectedClassificationRowIds: [ROW_NEEDS_DECISION] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('draft')
    expect(result.rowCount).toBe(1)

    const [request] = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequest)
      .where(eq(bookkeepingTransactionPurposeRequest.id, result.id))
    expect(request.classificationRunId).toBe('run-1')

    const rows = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequestRow)
      .where(eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, result.id))
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('pending')
    expect(rows[0].classificationRowId).toBe(ROW_NEEDS_DECISION)
  })

  it('제외(excluded) row는 요청에 포함할 수 없다', async () => {
    const result = await createPurposeRequestDraft({
      sessionId: SESSION_GENERAL,
      tenantId: TENANT,
      staffRecord,
      input: { selectedClassificationRowIds: [ROW_EXCLUDED] },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(400)
    expect(result.error).toContain('제외')
  })

  it('세션에 속하지 않는 row id가 섞이면 거부한다(cross-session/tenant)', async () => {
    const result = await createPurposeRequestDraft({
      sessionId: SESSION_GENERAL,
      tenantId: TENANT,
      staffRecord,
      input: { selectedClassificationRowIds: [ROW_NEEDS_DECISION, 'row-from-other-session'] },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(400)
  })

  it('급여(payroll) 세션은 거부한다', async () => {
    const result = await createPurposeRequestDraft({
      sessionId: SESSION_PAYROLL,
      tenantId: TENANT,
      staffRecord,
      input: { selectedClassificationRowIds: [ROW_NEEDS_DECISION] },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(409)
  })

  it('완료된 세션은 거부한다', async () => {
    const result = await createPurposeRequestDraft({
      sessionId: SESSION_COMPLETED,
      tenantId: TENANT,
      staffRecord,
      input: { selectedClassificationRowIds: [ROW_NEEDS_DECISION] },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(409)
  })
})

describe('updatePurposeRequestDraft', () => {
  async function createDraft() {
    const r = await createPurposeRequestDraft({
      sessionId: SESSION_GENERAL,
      tenantId: TENANT,
      staffRecord,
      input: { selectedClassificationRowIds: [ROW_NEEDS_DECISION] },
    })
    if (!r.ok) throw new Error('create failed in fixture')
    return r.id
  }

  it('draft 상태에서 제목 스냅샷을 수정한다', async () => {
    const id = await createDraft()
    const result = await updatePurposeRequestDraft({
      requestId: id,
      tenantId: TENANT,
      staffRecord,
      input: { subjectSnapshot: '수정된 제목' },
    })
    expect(result.ok).toBe(true)
    const [row] = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequest)
      .where(eq(bookkeepingTransactionPurposeRequest.id, id))
    expect(row.subjectSnapshot).toBe('수정된 제목')
  })

  it('발송 전(draft) 상태가 아니면 수정을 거부한다', async () => {
    const id = await createDraft()
    await testDb
      .update(bookkeepingTransactionPurposeRequest)
      .set({ status: 'sent' })
      .where(eq(bookkeepingTransactionPurposeRequest.id, id))

    const result = await updatePurposeRequestDraft({
      requestId: id,
      tenantId: TENANT,
      staffRecord,
      input: { subjectSnapshot: '바꾸면 안 됨' },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(409)
  })

  it('추가 row 중 세션에 속하지 않는 id가 섞이면 거부한다', async () => {
    const id = await createDraft()
    const result = await updatePurposeRequestDraft({
      requestId: id,
      tenantId: TENANT,
      staffRecord,
      input: { addClassificationRowIds: [ROW_NEEDS_DECISION, 'row-from-other-session'] },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(400)
  })

  it('추가 row 중 제외(excluded) row가 섞이면 거부한다', async () => {
    const id = await createDraft()
    const result = await updatePurposeRequestDraft({
      requestId: id,
      tenantId: TENANT,
      staffRecord,
      input: { addClassificationRowIds: [ROW_EXCLUDED] },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(400)
    expect(result.error).toContain('제외')
  })

  it('cancel=true면 draft를 취소한다', async () => {
    const id = await createDraft()
    const result = await updatePurposeRequestDraft({
      requestId: id,
      tenantId: TENANT,
      staffRecord,
      input: { cancel: true },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('cancelled')
    const [row] = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequest)
      .where(eq(bookkeepingTransactionPurposeRequest.id, id))
    expect(row.status).toBe('cancelled')
  })
})
