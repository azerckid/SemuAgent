import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = 'libsql://test.local'
  process.env.TURSO_AUTH_TOKEN = 'test-token'
  process.env.BETTER_AUTH_SECRET = '12345678901234567890123456789012'
})

import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq } from 'drizzle-orm'
import * as appSchema from '@/lib/db/schema'
import {
  bookkeepingTransactionPurposeRequest,
  bookkeepingTransactionPurposeRequestRow,
} from '@/lib/db/schema'
import { hashToken } from '@/lib/token'
import {
  getClientPurposeRequest,
  submitClientPurposeAnswers,
} from './transaction-purpose-public-service'

let client: Client
let testDb: ReturnType<typeof drizzle>
let testDir: string

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

const TENANT = 'tenant-1'
const CLIENT_ID = 'client-1'
const STAFF_ID = 'staff-1'
const SESSION_ID = 'session-1'
const OTHER_SESSION_ID = 'session-2'
const RAW_TOKEN = 'raw-token-purpose'
const OTHER_RAW_TOKEN = 'other-raw-token-purpose'
const REQUEST_ID = 'purpose-request-1'
const DRAFT_REQUEST_ID = 'purpose-request-draft'
const ROW_1 = 'purpose-row-1'
const ROW_2 = 'purpose-row-2'

beforeAll(async () => {
  testDir = mkdtempSync(join(tmpdir(), 'jaryo-purpose-public-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })

  await client.execute(`CREATE TABLE tenant (id text PRIMARY KEY, name text NOT NULL)`)
  await client.execute(`
    CREATE TABLE client (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      name text NOT NULL,
      email text
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
      created_at text NOT NULL DEFAULT '2026-05-01'
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

beforeEach(async () => {
  await client.execute('DELETE FROM bookkeeping_transaction_purpose_request_row')
  await client.execute('DELETE FROM bookkeeping_transaction_purpose_request')
  await client.execute('DELETE FROM upload_session')
  await client.execute('DELETE FROM client')
  await client.execute('DELETE FROM tenant')
  await client.execute('DELETE FROM staff')
  await client.execute({ sql: 'INSERT INTO tenant (id, name) VALUES (?, ?)', args: [TENANT, '춘심회계법인'] })
  await client.execute({
    sql: 'INSERT INTO client (id, tenant_id, name, email) VALUES (?, ?, ?, ?)',
    args: [CLIENT_ID, TENANT, '디와이_01', 'client@example.com'],
  })
  await client.execute({
    sql: `INSERT INTO staff (id, tenant_id, user_id, email, name, role, active, created_at)
          VALUES (?, ?, ?, ?, ?, 'STAFF', 1, '2026-05-01')`,
    args: [STAFF_ID, TENANT, 'user-1', 'staff@example.com', '춘심이'],
  })
  await seedSession(SESSION_ID, RAW_TOKEN)
  await seedSession(OTHER_SESSION_ID, OTHER_RAW_TOKEN)
  await seedPurposeRequest(REQUEST_ID, SESSION_ID, 'sent')
  await seedPurposeRows(REQUEST_ID)
  await seedPurposeRequest(DRAFT_REQUEST_ID, SESSION_ID, 'draft')
})

async function seedSession(id: string, rawToken: string) {
  await client.execute({
    sql: `INSERT INTO upload_session (id, tenant_id, client_id, created_by_staff_id, accounting_period, token_hash, upload_url, expires_at, status, request_kind, source)
          VALUES (?, ?, ?, ?, '2026-06', ?, ?, '2999-12-31T23:59:59+09:00', 'submitted', 'general', 'customer_upload')`,
    args: [id, TENANT, CLIENT_ID, STAFF_ID, hashToken(rawToken), `https://example.test/upload/${rawToken}`],
  })
}

async function seedPurposeRequest(id: string, sessionId: string, status: string) {
  await client.execute({
    sql: `INSERT INTO bookkeeping_transaction_purpose_request
          (id, tenant_id, upload_session_id, client_id, status, subject_snapshot, body_snapshot, due_at, created_by_staff_id, sent_by_staff_id, sent_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, '거래 용도 확인', '본문', '2026-07-31T23:59:59+09:00', ?, ?, '2026-06-20T10:00:00+09:00', '2026-06-20T10:00:00+09:00', '2026-06-20T10:00:00+09:00')`,
    args: [id, TENANT, sessionId, CLIENT_ID, status, STAFF_ID, STAFF_ID],
  })
}

async function seedPurposeRows(requestId: string) {
  const rows = [
    [ROW_1, '2026-06-05', '카페골목', 15000, '커피 구매'],
    [ROW_2, '2026-06-08', '개인이체', 50000, '용도 불명 이체'],
  ]
  for (const row of rows) {
    await client.execute({
      sql: `INSERT INTO bookkeeping_transaction_purpose_request_row
            (id, tenant_id, purpose_request_id, source_display_date, source_display_counterparty, source_display_amount_krw, source_display_memo, staff_question, ai_recommended_account, ambiguity_reason, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, '이 거래는 어떤 목적으로 사용하셨나요?', '복리후생비', '용도 불명확', 'pending', '2026-06-20T10:00:00+09:00', '2026-06-20T10:00:00+09:00')`,
      args: [row[0], TENANT, requestId, row[1], row[2], row[3], row[4]],
    })
  }
}

describe('getClientPurposeRequest', () => {
  it('토큰과 요청이 일치하면 고객-safe 필드만 반환한다', async () => {
    const result = await getClientPurposeRequest({ rawToken: RAW_TOKEN, purposeRequestId: REQUEST_ID })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.header).toMatchObject({
      tenantName: '춘심회계법인',
      clientName: '디와이_01',
      staffName: '춘심이',
      accountingPeriod: '2026-06',
    })
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      id: ROW_1,
      counterparty: '카페골목',
      amountKrw: 15000,
      status: 'pending',
    })
    expect('aiRecommendedAccount' in result.rows[0]).toBe(false)
    expect('ambiguityReason' in result.rows[0]).toBe(false)
  })

  it('토큰 세션과 목적 요청 세션이 다르면 차단한다', async () => {
    const result = await getClientPurposeRequest({ rawToken: OTHER_RAW_TOKEN, purposeRequestId: REQUEST_ID })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(404)
  })

  it('다른 tenant의 purpose request id는 찾을 수 없음으로 처리한다', async () => {
    await client.execute({
      sql: `INSERT INTO bookkeeping_transaction_purpose_request
            (id, tenant_id, upload_session_id, client_id, status, subject_snapshot, body_snapshot, created_by_staff_id, created_at, updated_at)
            VALUES ('cross-tenant-request', 'tenant-2', ?, 'client-2', 'sent', 'subject', 'body', 'staff-2', '2026-06-20', '2026-06-20')`,
      args: [SESSION_ID],
    })

    const result = await getClientPurposeRequest({ rawToken: RAW_TOKEN, purposeRequestId: 'cross-tenant-request' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(404)
  })

  it('expired/revoked token 세션은 고객 답변 화면을 열 수 없다', async () => {
    await testDb.update(appSchema.uploadSession).set({ status: 'expired' }).where(eq(appSchema.uploadSession.id, SESSION_ID))
    const expiredResult = await getClientPurposeRequest({ rawToken: RAW_TOKEN, purposeRequestId: REQUEST_ID })
    expect(expiredResult.ok).toBe(false)
    if (!expiredResult.ok) expect(expiredResult.status).toBe(401)

    await testDb.update(appSchema.uploadSession).set({ status: 'revoked' }).where(eq(appSchema.uploadSession.id, SESSION_ID))
    const revokedResult = await getClientPurposeRequest({ rawToken: RAW_TOKEN, purposeRequestId: REQUEST_ID })
    expect(revokedResult.ok).toBe(false)
    if (!revokedResult.ok) expect(revokedResult.status).toBe(401)
  })

  it('draft 상태 요청은 고객에게 노출하지 않는다', async () => {
    const result = await getClientPurposeRequest({ rawToken: RAW_TOKEN, purposeRequestId: DRAFT_REQUEST_ID })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(410)
  })

  it('cancelled request는 고객에게 노출하지 않는다', async () => {
    await testDb
      .update(bookkeepingTransactionPurposeRequest)
      .set({ status: 'cancelled' })
      .where(eq(bookkeepingTransactionPurposeRequest.id, REQUEST_ID))

    const result = await getClientPurposeRequest({ rawToken: RAW_TOKEN, purposeRequestId: REQUEST_ID })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(410)
  })
})

describe('submitClientPurposeAnswers', () => {
  it('고객은 선택 코드 없이 사용 용도 설명만 제출할 수 있다', async () => {
    const result = await submitClientPurposeAnswers({
      input: {
        token: RAW_TOKEN,
        purposeRequest: REQUEST_ID,
        submit: true,
        rows: [
          { rowId: ROW_1, memo: '직원 점심 식대' },
          { rowId: ROW_2, memo: '대표 개인 사용' },
        ],
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('submitted')

    const rows = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequestRow)
      .where(eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, REQUEST_ID))
    expect(rows.map((row) => row.clientPurposeCode)).toEqual([null, null])
    expect(rows.map((row) => row.clientPurposeMemo).sort()).toEqual(['대표 개인 사용', '직원 점심 식대'])
  })

  it('고객 답변을 저장하고 전체 답변이면 요청을 submitted로 바꾼다', async () => {
    const result = await submitClientPurposeAnswers({
      input: {
        token: RAW_TOKEN,
        purposeRequest: REQUEST_ID,
        submit: true,
        rows: [
          { rowId: ROW_1, purposeCode: 'employee_welfare_meal', memo: '직원 점심 식대' },
          { rowId: ROW_2, purposeCode: 'personal_not_company', memo: '대표 개인 사용' },
        ],
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('submitted')
    expect(result.answeredRowCount).toBe(2)

    const [request] = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequest)
      .where(eq(bookkeepingTransactionPurposeRequest.id, REQUEST_ID))
    expect(request.status).toBe('submitted')
    expect(request.submittedAt).toBeTruthy()

    const rows = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequestRow)
      .where(eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, REQUEST_ID))
    expect(rows.every((row) => row.status === 'answered')).toBe(true)
    expect(rows.map((row) => row.clientPurposeCode).sort()).toEqual([
      'employee_welfare_meal',
      'personal_not_company',
    ])
  })

  it('제출 완료 후에도 고객이 사용 용도 설명을 수정해 다시 제출할 수 있다', async () => {
    await submitClientPurposeAnswers({
      input: {
        token: RAW_TOKEN,
        purposeRequest: REQUEST_ID,
        submit: true,
        rows: [
          { rowId: ROW_1, memo: '직원 점심 식대' },
          { rowId: ROW_2, memo: '대표 개인 사용' },
        ],
      },
    })

    const result = await submitClientPurposeAnswers({
      input: {
        token: RAW_TOKEN,
        purposeRequest: REQUEST_ID,
        submit: true,
        rows: [
          { rowId: ROW_1, memo: '직원 야근 식대' },
          { rowId: ROW_2, memo: '대표 개인 사용 아님, 거래처 송금' },
        ],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('submitted')

    const rows = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequestRow)
      .where(eq(bookkeepingTransactionPurposeRequestRow.purposeRequestId, REQUEST_ID))
    expect(rows.map((row) => row.clientPurposeMemo).sort()).toEqual([
      '대표 개인 사용 아님, 거래처 송금',
      '직원 야근 식대',
    ])
  })

  it('요청에 포함되지 않은 row 답변은 저장하지 않는다', async () => {
    const result = await submitClientPurposeAnswers({
      input: {
        token: RAW_TOKEN,
        purposeRequest: REQUEST_ID,
        submit: true,
        rows: [{ rowId: 'other-row', memo: '모름' }],
      },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(400)
  })

  it('cancelled request에는 답변을 저장하지 않는다', async () => {
    await testDb
      .update(bookkeepingTransactionPurposeRequest)
      .set({ status: 'cancelled' })
      .where(eq(bookkeepingTransactionPurposeRequest.id, REQUEST_ID))

    const result = await submitClientPurposeAnswers({
      input: {
        token: RAW_TOKEN,
        purposeRequest: REQUEST_ID,
        submit: true,
        rows: [{ rowId: ROW_1, memo: '모름' }],
      },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(410)
  })
})
