import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = 'libsql://test.local'
  process.env.TURSO_AUTH_TOKEN = 'test-token'
  process.env.BETTER_AUTH_SECRET = '12345678901234567890123456789012'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq } from 'drizzle-orm'
import * as appSchema from '@/lib/db/schema'
import {
  bookkeepingClassificationRun,
  bookkeepingTransactionClassification,
  bookkeepingTransactionPurposeRequest,
  bookkeepingTransactionPurposeRequestRow,
} from '@/lib/db/schema'
import { updateBookkeepingClassificationRow } from './classification-service'

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
const CLIENT_ID = 'client-1'
const SESSION_ID = 'session-1'
const RUN_ID = 'run-1'
const CLASSIFICATION_ROW_ID = 'classification-row-1'
const PURPOSE_REQUEST_ID = 'purpose-request-1'
const PURPOSE_ROW_ID = 'purpose-row-1'
const staffRecord = { id: STAFF_ID, role: 'TENANT_ADMIN' as const }

beforeAll(async () => {
  testDir = mkdtempSync(join(tmpdir(), 'jaryo-purpose-apply-'))
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
      status text NOT NULL DEFAULT 'submitted',
      analysis_notes text,
      session_evaluation text,
      request_email_subject text,
      request_email_body text,
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
    CREATE TABLE bookkeeping_classification_run (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      source_batch_id text,
      status text NOT NULL,
      source_file_count integer NOT NULL DEFAULT 0,
      extracted_row_count integer NOT NULL DEFAULT 0,
      confirmed_row_count integer NOT NULL DEFAULT 0,
      unclassified_row_count integer NOT NULL DEFAULT 0,
      model_provider text,
      model_name text,
      applied_category_notes text NOT NULL,
      error_message text,
      created_by_staff_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_transaction_classification (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      classification_run_id text NOT NULL,
      upload_session_id text NOT NULL,
      source_batch_id text,
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
      vat_direction text,
      vat_tax_type text,
      vat_supply_amount_krw integer,
      vat_tax_amount_krw integer,
      vat_gross_amount_krw integer,
      vat_fact_source text,
      vat_fact_source_ref text,
      vat_fact_status text,
      linked_evidence_row_id text,
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
  await client.execute('DELETE FROM bookkeeping_transaction_classification')
  await client.execute('DELETE FROM bookkeeping_classification_run')
  await client.execute('DELETE FROM upload_session')
  await client.execute('DELETE FROM client')

  await client.execute({
    sql: 'INSERT INTO client (id, tenant_id, name, email) VALUES (?, ?, ?, ?)',
    args: [CLIENT_ID, TENANT, '디와이_01', 'client@example.com'],
  })
  await client.execute({
    sql: `INSERT INTO upload_session (id, tenant_id, client_id, created_by_staff_id, accounting_period, token_hash, expires_at, status, request_kind, source)
          VALUES (?, ?, ?, ?, '2026-06', 'hash-1', '2026-12-31T23:59:59+09:00', 'submitted', 'general', 'customer_upload')`,
    args: [SESSION_ID, TENANT, CLIENT_ID, STAFF_ID],
  })
  await client.execute({
    sql: `INSERT INTO bookkeeping_classification_run (id, tenant_id, upload_session_id, status, source_file_count, extracted_row_count, confirmed_row_count, unclassified_row_count, applied_category_notes, created_by_staff_id, created_at, updated_at)
          VALUES (?, ?, ?, 'completed', 1, 1, 0, 0, 'test categories', ?, '2026-06-01', '2026-06-01')`,
    args: [RUN_ID, TENANT, SESSION_ID, STAFF_ID],
  })
  await client.execute({
    sql: `INSERT INTO bookkeeping_transaction_classification
          (id, tenant_id, classification_run_id, upload_session_id, source_type, transaction_date, merchant_name, description, amount_krw, direction, recommended_account, recommendation_confidence, recommendation_reason, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'bank', '2026-06-10', '카페골목', '커피 구매', 15000, 'expense', 'unclassified', 'low', '용도 확인 필요', 'needs_decision', '2026-06-01', '2026-06-01')`,
    args: [CLASSIFICATION_ROW_ID, TENANT, RUN_ID, SESSION_ID],
  })
  await client.execute({
    sql: `INSERT INTO bookkeeping_transaction_purpose_request
          (id, tenant_id, upload_session_id, classification_run_id, client_id, status, subject_snapshot, body_snapshot, created_by_staff_id, sent_at, submitted_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'submitted', 'subject', 'body', ?, '2026-06-01', '2026-06-02', '2026-06-01', '2026-06-02')`,
    args: [PURPOSE_REQUEST_ID, TENANT, SESSION_ID, RUN_ID, CLIENT_ID, STAFF_ID],
  })
  await client.execute({
    sql: `INSERT INTO bookkeeping_transaction_purpose_request_row
          (id, tenant_id, purpose_request_id, classification_row_id, source_display_date, source_display_counterparty, source_display_amount_krw, staff_question, client_purpose_code, client_purpose_memo, client_answered_at, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, '2026-06-10', '카페골목', 15000, '이 거래는 어떤 목적으로 사용하셨나요?', 'employee_welfare_meal', '직원 식대입니다.', '2026-06-02', 'answered', '2026-06-01', '2026-06-02')`,
    args: [PURPOSE_ROW_ID, TENANT, PURPOSE_REQUEST_ID, CLASSIFICATION_ROW_ID],
  })
})

describe('updateBookkeepingClassificationRow purpose answer apply', () => {
  it('담당자 확정 시 classification row와 purpose row를 함께 확정한다', async () => {
    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      finalAccount: 'employee_welfare',
      staffMemo: '고객 답변 반영',
      status: 'confirmed',
      purposeRequestRowId: PURPOSE_ROW_ID,
    })

    expect(result.ok).toBe(true)

    const [classificationRow] = await testDb
      .select()
      .from(bookkeepingTransactionClassification)
      .where(eq(bookkeepingTransactionClassification.id, CLASSIFICATION_ROW_ID))
    expect(classificationRow).toMatchObject({
      status: 'confirmed',
      finalAccount: 'employee_welfare',
      staffMemo: '고객 답변 반영',
      confirmedByStaffId: STAFF_ID,
    })

    const [purposeRow] = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequestRow)
      .where(eq(bookkeepingTransactionPurposeRequestRow.id, PURPOSE_ROW_ID))
    expect(purposeRow).toMatchObject({
      status: 'staff_confirmed',
      staffFinalAccount: 'employee_welfare',
      staffMemo: '고객 답변 반영',
    })

    const [request] = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequest)
      .where(eq(bookkeepingTransactionPurposeRequest.id, PURPOSE_REQUEST_ID))
    expect(request.status).toBe('closed')

    const [run] = await testDb
      .select()
      .from(bookkeepingClassificationRun)
      .where(eq(bookkeepingClassificationRun.id, RUN_ID))
    expect(run.confirmedRowCount).toBe(1)
  })

  it('답변이 아직 pending이면 고객 답변 확정으로 처리하지 않는다', async () => {
    await testDb
      .update(bookkeepingTransactionPurposeRequestRow)
      .set({ status: 'pending', clientPurposeCode: null, clientPurposeMemo: null, clientAnsweredAt: null })
      .where(eq(bookkeepingTransactionPurposeRequestRow.id, PURPOSE_ROW_ID))

    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      finalAccount: 'employee_welfare',
      status: 'confirmed',
      purposeRequestRowId: PURPOSE_ROW_ID,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
    }
  })

  it('다른 거래 row에 연결된 고객 답변은 확정에 사용할 수 없다', async () => {
    await client.execute({
      sql: `INSERT INTO bookkeeping_transaction_classification
            (id, tenant_id, classification_run_id, upload_session_id, source_type, transaction_date, merchant_name, description, amount_krw, direction, recommended_account, recommendation_confidence, recommendation_reason, status, created_at, updated_at)
            VALUES ('classification-row-2', ?, ?, ?, 'bank', '2026-06-11', '택배사', '배송비', 30000, 'expense', 'unclassified', 'low', '용도 확인 필요', 'needs_decision', '2026-06-01', '2026-06-01')`,
      args: [TENANT, RUN_ID, SESSION_ID],
    })
    await client.execute({
      sql: `INSERT INTO bookkeeping_transaction_purpose_request_row
            (id, tenant_id, purpose_request_id, classification_row_id, source_display_date, source_display_counterparty, source_display_amount_krw, staff_question, client_purpose_code, client_purpose_memo, client_answered_at, status, created_at, updated_at)
            VALUES ('purpose-row-2', ?, ?, 'classification-row-2', '2026-06-11', '택배사', 30000, '이 거래는 어떤 목적으로 사용하셨나요?', 'shipping_delivery', '배송비입니다.', '2026-06-02', 'answered', '2026-06-01', '2026-06-02')`,
      args: [TENANT, PURPOSE_REQUEST_ID],
    })

    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      finalAccount: 'employee_welfare',
      status: 'confirmed',
      purposeRequestRowId: 'purpose-row-2',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)

    const [classificationRow] = await testDb
      .select()
      .from(bookkeepingTransactionClassification)
      .where(eq(bookkeepingTransactionClassification.id, CLASSIFICATION_ROW_ID))
    expect(classificationRow.status).toBe('needs_decision')
  })

  it('stale 답변은 서버에서 자동 차단하지 않고 담당자 확정 정책을 따른다', async () => {
    await testDb
      .update(bookkeepingTransactionPurposeRequest)
      .set({ classificationRunId: 'old-run' })
      .where(eq(bookkeepingTransactionPurposeRequest.id, PURPOSE_REQUEST_ID))

    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      finalAccount: 'employee_welfare',
      staffMemo: 'stale 경고 확인 후 반영',
      status: 'confirmed',
      purposeRequestRowId: PURPOSE_ROW_ID,
    })

    expect(result.ok).toBe(true)

    const [purposeRow] = await testDb
      .select()
      .from(bookkeepingTransactionPurposeRequestRow)
      .where(eq(bookkeepingTransactionPurposeRequestRow.id, PURPOSE_ROW_ID))
    expect(purposeRow).toMatchObject({
      status: 'staff_confirmed',
      staffFinalAccount: 'employee_welfare',
      staffMemo: 'stale 경고 확인 후 반영',
    })
  })
})

describe('updateBookkeepingClassificationRow shallow undo snapshot (Brief 41 §0.4)', () => {
  it('returns the pre-update finalAccount/staffMemo/status so the caller can revert', async () => {
    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      finalAccount: 'employee_welfare',
      staffMemo: '확정 메모',
      status: 'confirmed',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      // beforeEach seeds this row with finalAccount/staffMemo unset and
      // status: 'needs_decision' — the snapshot must reflect that pre-update
      // state, not the values just written.
      expect(result.previous).toEqual({
        finalAccount: null,
        staffMemo: null,
        status: 'needs_decision',
        linkedEvidenceRowId: null,
      })
    }
  })

  it('captures the immediately-prior state across two sequential updates, not the original seed', async () => {
    await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      finalAccount: 'employee_welfare',
      status: 'confirmed',
    })

    const second = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      staffMemo: '제외 사유: 업무무관',
      status: 'excluded',
    })

    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.previous).toEqual({
        finalAccount: 'employee_welfare',
        staffMemo: null,
        status: 'confirmed',
        linkedEvidenceRowId: null,
      })
    }
  })
})

describe('updateBookkeepingClassificationRow evidence link (JC-010 2b-2)', () => {
  const EVIDENCE_ROW_ID = 'classification-row-evidence'

  async function seedEvidenceRow(sourceType: string, amountKrw = 15000) {
    await client.execute({
      sql: `INSERT INTO bookkeeping_transaction_classification
            (id, tenant_id, classification_run_id, upload_session_id, source_type, transaction_date, merchant_name, description, amount_krw, direction, recommended_account, recommendation_confidence, recommendation_reason, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, '2026-06-10', '카페골목', '커피 구매', ?, 'expense', 'employee_welfare', 'high', '커피', 'suggested', '2026-06-01', '2026-06-01')`,
      args: [EVIDENCE_ROW_ID, TENANT, RUN_ID, SESSION_ID, sourceType, amountKrw],
    })
  }

  it('saves a link to a tax_invoice/receipt/card row in the same session', async () => {
    await seedEvidenceRow('tax_invoice')

    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      linkedEvidenceRowId: EVIDENCE_ROW_ID,
    })

    expect(result.ok).toBe(true)
    const [row] = await testDb
      .select()
      .from(bookkeepingTransactionClassification)
      .where(eq(bookkeepingTransactionClassification.id, CLASSIFICATION_ROW_ID))
    expect(row.linkedEvidenceRowId).toBe(EVIDENCE_ROW_ID)
  })

  it('rejects linking evidence with a different amount so it cannot become 증빙있음', async () => {
    await seedEvidenceRow('tax_invoice', 16000)

    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      linkedEvidenceRowId: EVIDENCE_ROW_ID,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
    const [row] = await testDb
      .select()
      .from(bookkeepingTransactionClassification)
      .where(eq(bookkeepingTransactionClassification.id, CLASSIFICATION_ROW_ID))
    expect(row.linkedEvidenceRowId).toBeNull()
  })

  it('rejects linking a bank/other row (not itself evidence)', async () => {
    await seedEvidenceRow('bank')

    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      linkedEvidenceRowId: EVIDENCE_ROW_ID,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('rejects a non-bank row (card/receipt/tax_invoice) initiating a link — only bank rows link to evidence (review P1)', async () => {
    // CLASSIFICATION_ROW_ID is seeded as sourceType 'bank' by beforeEach.
    // Here the row TRYING to save a link is the card/tax_invoice row
    // instead — the UI never offers this (evidence finder only opens for
    // bank rows), but the API must reject it too, not just trust the client.
    await seedEvidenceRow('tax_invoice')
    const otherEvidenceRowId = 'classification-row-second-evidence'
    await client.execute({
      sql: `INSERT INTO bookkeeping_transaction_classification
            (id, tenant_id, classification_run_id, upload_session_id, source_type, transaction_date, merchant_name, description, amount_krw, direction, recommended_account, recommendation_confidence, recommendation_reason, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'card', '2026-06-11', '문구점', '문구 구매', 8000, 'expense', 'supplies', 'high', '문구', 'suggested', '2026-06-01', '2026-06-01')`,
      args: [otherEvidenceRowId, TENANT, RUN_ID, SESSION_ID],
    })

    const result = await updateBookkeepingClassificationRow({
      rowId: EVIDENCE_ROW_ID, // sourceType: 'tax_invoice', not 'bank'
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      linkedEvidenceRowId: otherEvidenceRowId,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)

    const [row] = await testDb
      .select()
      .from(bookkeepingTransactionClassification)
      .where(eq(bookkeepingTransactionClassification.id, EVIDENCE_ROW_ID))
    expect(row.linkedEvidenceRowId).toBeNull()
  })

  it('rejects linking a nonexistent row', async () => {
    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      linkedEvidenceRowId: 'no-such-row',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('rejects linking a row to itself', async () => {
    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      linkedEvidenceRowId: CLASSIFICATION_ROW_ID,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('clears the link when linkedEvidenceRowId is explicitly set to null', async () => {
    await seedEvidenceRow('card')
    await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      linkedEvidenceRowId: EVIDENCE_ROW_ID,
    })

    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      linkedEvidenceRowId: null,
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.previous.linkedEvidenceRowId).toBe(EVIDENCE_ROW_ID)
    const [row] = await testDb
      .select()
      .from(bookkeepingTransactionClassification)
      .where(eq(bookkeepingTransactionClassification.id, CLASSIFICATION_ROW_ID))
    expect(row.linkedEvidenceRowId).toBeNull()
  })

  it('leaves the link untouched when linkedEvidenceRowId is omitted', async () => {
    await seedEvidenceRow('receipt')
    await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      linkedEvidenceRowId: EVIDENCE_ROW_ID,
    })

    await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      staffMemo: '무관한 업데이트',
    })

    const [row] = await testDb
      .select()
      .from(bookkeepingTransactionClassification)
      .where(eq(bookkeepingTransactionClassification.id, CLASSIFICATION_ROW_ID))
    expect(row.linkedEvidenceRowId).toBe(EVIDENCE_ROW_ID)
  })
})

describe('updateBookkeepingClassificationRow VAT fact writer (Slice 2d-3b)', () => {
  const VAT_ROW_ID = 'classification-row-vat-fact'

  beforeEach(async () => {
    await client.execute({
      sql: `INSERT INTO bookkeeping_transaction_classification
            (id, tenant_id, classification_run_id, upload_session_id, source_type, transaction_date, merchant_name, description, amount_krw, direction, recommended_account, recommendation_confidence, recommendation_reason, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'tax_invoice', '2026-06-10', '주식회사 테스트', '매입 세금계산서', 110000, 'expense', 'supplies', 'high', '세금계산서', 'suggested', '2026-06-01', '2026-06-01')`,
      args: [VAT_ROW_ID, TENANT, RUN_ID, SESSION_ID],
    })
  })

  it('stores exact staff-confirmed VAT values with source identity', async () => {
    const result = await updateBookkeepingClassificationRow({
      rowId: VAT_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      vatFact: {
        direction: 'purchase',
        taxType: 'taxable',
        supplyAmountKrw: 100000,
        taxAmountKrw: 10000,
        grossAmountKrw: 110000,
      },
    })

    expect(result.ok).toBe(true)
    const [row] = await testDb
      .select()
      .from(bookkeepingTransactionClassification)
      .where(eq(bookkeepingTransactionClassification.id, VAT_ROW_ID))
    expect(row).toMatchObject({
      vatDirection: 'purchase',
      vatTaxType: 'taxable',
      vatSupplyAmountKrw: 100000,
      vatTaxAmountKrw: 10000,
      vatGrossAmountKrw: 110000,
      vatFactSource: 'manual',
      vatFactSourceRef: `staff:${staffRecord.id}:${VAT_ROW_ID}`,
      vatFactStatus: 'confirmed',
    })
  })

  it('rejects a VAT gross amount that does not match the classification row', async () => {
    const result = await updateBookkeepingClassificationRow({
      rowId: VAT_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      vatFact: {
        direction: 'purchase',
        taxType: 'taxable',
        supplyAmountKrw: 90000,
        taxAmountKrw: 9000,
        grossAmountKrw: 99000,
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('rejects manual VAT facts on bank settlement rows', async () => {
    const result = await updateBookkeepingClassificationRow({
      rowId: CLASSIFICATION_ROW_ID,
      sessionId: SESSION_ID,
      tenantId: TENANT,
      staffRecord,
      vatFact: {
        direction: 'purchase',
        taxType: 'taxable',
        supplyAmountKrw: 13636,
        taxAmountKrw: 1364,
        grossAmountKrw: 15000,
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })
})
