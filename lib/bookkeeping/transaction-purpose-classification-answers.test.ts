import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = 'libsql://test.local'
  process.env.TURSO_AUTH_TOKEN = 'test-token'
})

import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'
import { attachPurposeAnswersToClassificationRows } from './transaction-purpose-classification-answers'

let client: Client
let testDb: ReturnType<typeof drizzle>
let testDir: string

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

const TENANT = 'tenant-1'

beforeAll(async () => {
  testDir = mkdtempSync(join(tmpdir(), 'jaryo-purpose-answers-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })

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
})

async function seedRequest(id: string, status: string, classificationRunId: string | null, updatedAt: string) {
  await client.execute({
    sql: `INSERT INTO bookkeeping_transaction_purpose_request
          (id, tenant_id, upload_session_id, classification_run_id, client_id, status, subject_snapshot, body_snapshot, created_by_staff_id, created_at, updated_at)
          VALUES (?, ?, 'session-1', ?, 'client-1', ?, 'subject', 'body', 'staff-1', ?, ?)`,
    args: [id, TENANT, classificationRunId, status, updatedAt, updatedAt],
  })
}

async function seedRequestRow(params: {
  id: string
  requestId: string
  classificationRowId?: string | null
  sourceDisplayDate?: string | null
  sourceDisplayCounterparty?: string | null
  sourceDisplayAmountKrw?: number | null
  sourceDisplayMemo?: string | null
  status: string
  purposeCode?: string | null
  memo?: string | null
  updatedAt: string
}) {
  await client.execute({
    sql: `INSERT INTO bookkeeping_transaction_purpose_request_row
          (id, tenant_id, purpose_request_id, classification_row_id, source_display_date, source_display_counterparty, source_display_amount_krw, source_display_memo, staff_question, client_purpose_code, client_purpose_memo, client_answered_at, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, '이 거래는 어떤 목적으로 사용하셨나요?', ?, ?, ?, ?, ?, ?)`,
    args: [
      params.id,
      TENANT,
      params.requestId,
      params.classificationRowId ?? null,
      params.sourceDisplayDate ?? null,
      params.sourceDisplayCounterparty ?? null,
      params.sourceDisplayAmountKrw ?? null,
      params.sourceDisplayMemo ?? null,
      params.purposeCode ?? null,
      params.memo ?? null,
      params.purposeCode ? params.updatedAt : null,
      params.status,
      params.updatedAt,
      params.updatedAt,
    ],
  })
}

describe('attachPurposeAnswersToClassificationRows', () => {
  it('draft 요청은 숨기고 최신 staff-visible 답변만 row에 붙인다', async () => {
    await seedRequest('draft-request', 'draft', 'run-1', '2026-06-01T09:00:00+09:00')
    await seedRequest('sent-request', 'submitted', 'run-1', '2026-06-02T09:00:00+09:00')
    await seedRequestRow({
      id: 'draft-row',
      requestId: 'draft-request',
      classificationRowId: 'classification-row-1',
      status: 'answered',
      purposeCode: 'other',
      memo: 'draft should be hidden',
      updatedAt: '2026-06-01T09:10:00+09:00',
    })
    await seedRequestRow({
      id: 'sent-row',
      requestId: 'sent-request',
      classificationRowId: 'classification-row-1',
      status: 'answered',
      purposeCode: 'employee_welfare_meal',
      memo: '직원 식대입니다.',
      updatedAt: '2026-06-02T09:10:00+09:00',
    })

    const [row] = await attachPurposeAnswersToClassificationRows({
      tenantId: TENANT,
      uploadSessionId: 'session-1',
      currentClassificationRunId: 'run-1',
      rows: [{ id: 'classification-row-1', amountKrw: 15000 }],
    })

    expect(row.purposeAnswer).toMatchObject({
      id: 'sent-row',
      purposeCode: 'employee_welfare_meal',
      purposeLabel: '직원 식대/복리후생',
      purposeMemo: '직원 식대입니다.',
      isStale: false,
    })
  })

  it('요청이 다른 classification run 기준이면 stale로 표시한다', async () => {
    await seedRequest('old-request', 'submitted', 'old-run', '2026-06-01T09:00:00+09:00')
    await seedRequestRow({
      id: 'old-row',
      requestId: 'old-request',
      classificationRowId: 'classification-row-1',
      status: 'answered',
      purposeCode: 'shipping_delivery',
      memo: null,
      updatedAt: '2026-06-01T09:10:00+09:00',
    })

    const [row] = await attachPurposeAnswersToClassificationRows({
      tenantId: TENANT,
      uploadSessionId: 'session-1',
      currentClassificationRunId: 'current-run',
      rows: [{ id: 'classification-row-1' }],
    })

    expect(row.purposeAnswer?.isStale).toBe(true)
  })

  it('재정리로 row id가 바뀌어도 같은 거래 스냅샷이면 고객 답변을 붙인다', async () => {
    await seedRequest('old-request', 'submitted', 'old-run', '2026-06-16T09:00:00+09:00')
    await seedRequestRow({
      id: 'old-row',
      requestId: 'old-request',
      classificationRowId: 'old-classification-row',
      sourceDisplayDate: '2026-06-16',
      sourceDisplayCounterparty: '유치회관(주)유치',
      sourceDisplayAmountKrw: 11000,
      sourceDisplayMemo: '체크카드 점심 결제',
      status: 'answered',
      memo: '점심식대',
      updatedAt: '2026-06-16T09:10:00+09:00',
    })

    const [row] = await attachPurposeAnswersToClassificationRows({
      tenantId: TENANT,
      uploadSessionId: 'session-1',
      currentClassificationRunId: 'current-run',
      rows: [{
        id: 'new-classification-row',
        transactionDate: '2026-06-16',
        merchantName: '유치회관(주)유치',
        description: '체크카드 점심 결제',
        amountKrw: 11000,
      }],
    })

    expect(row.purposeAnswer).toMatchObject({
      id: 'old-row',
      purposeMemo: '점심식대',
      isStale: true,
    })
  })

  it('같은 스냅샷의 현재 거래가 여러 개면 오답 연결을 피한다', async () => {
    await seedRequest('old-request', 'submitted', 'old-run', '2026-06-16T09:00:00+09:00')
    await seedRequestRow({
      id: 'old-row',
      requestId: 'old-request',
      classificationRowId: 'old-classification-row',
      sourceDisplayDate: '2026-06-16',
      sourceDisplayCounterparty: '유치회관(주)유치',
      sourceDisplayAmountKrw: 11000,
      sourceDisplayMemo: '체크카드 점심 결제',
      status: 'answered',
      memo: '점심식대',
      updatedAt: '2026-06-16T09:10:00+09:00',
    })

    const rows = await attachPurposeAnswersToClassificationRows({
      tenantId: TENANT,
      uploadSessionId: 'session-1',
      currentClassificationRunId: 'current-run',
      rows: [
        {
          id: 'new-classification-row-1',
          transactionDate: '2026-06-16',
          merchantName: '유치회관(주)유치',
          description: '체크카드 점심 결제',
          amountKrw: 11000,
        },
        {
          id: 'new-classification-row-2',
          transactionDate: '2026-06-16',
          merchantName: '유치회관(주)유치',
          description: '체크카드 점심 결제',
          amountKrw: 11000,
        },
      ],
    })

    expect(rows.map((row) => row.purposeAnswer)).toEqual([null, null])
  })
})
