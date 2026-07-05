import { randomUUID } from 'crypto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
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
    CREATE TABLE upload_session (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      deleted_at text
    )
  `)
  await client.execute(`
    CREATE TABLE source_batch (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      source_kind text NOT NULL DEFAULT 'staff_direct',
      accounting_period text NOT NULL,
      bookkeeping_period_type text,
      bookkeeping_period_start text,
      bookkeeping_period_end text,
      legacy_upload_session_id text,
      deleted_at text,
      created_at text NOT NULL DEFAULT ''
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_material_attribution (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      upload_file_id text,
      status text NOT NULL DEFAULT 'active',
      evidence_date text,
      attributed_period text,
      recommendation text NOT NULL DEFAULT 'include',
      staff_decision text
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_fiscal_year_ledger (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      client_id text NOT NULL,
      fiscal_year integer NOT NULL,
      status text NOT NULL DEFAULT 'open',
      created_at text NOT NULL,
      updated_at text NOT NULL,
      UNIQUE(tenant_id, client_id, fiscal_year)
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_ledger_material_link (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      ledger_id text NOT NULL,
      period_month text NOT NULL,
      upload_session_id text NOT NULL,
      upload_file_id text,
      material_attribution_id text,
      source_fingerprint text NOT NULL,
      status text NOT NULL DEFAULT 'included',
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_classification_run (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
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
    CREATE TABLE bookkeeping_journal_entry_run (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      classification_run_id text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      row_count integer NOT NULL DEFAULT 0,
      unresolved_row_count integer NOT NULL DEFAULT 0,
      applied_rules_snapshot text NOT NULL,
      error_message text,
      created_by_staff_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_journal_entry_row (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      journal_entry_run_id text NOT NULL,
      upload_session_id text NOT NULL,
      classification_row_id text NOT NULL,
      entry_date text,
      requested_period text NOT NULL,
      attributed_period text,
      close_period text NOT NULL,
      debit_account text,
      debit_amount_krw integer,
      credit_account text,
      credit_amount_krw integer,
      counterparty text,
      memo text,
      status text NOT NULL DEFAULT 'draft',
      reason text,
      staff_memo text,
      confirmed_by_staff_id text,
      confirmed_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_journal_entry_voucher (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      journal_entry_run_id text NOT NULL,
      upload_session_id text NOT NULL,
      classification_row_id text NOT NULL,
      source_classification_row_ids text,
      voucher_number text NOT NULL,
      entry_date text,
      requested_period text NOT NULL,
      attributed_period text,
      close_period text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      reason text,
      staff_memo text,
      confirmed_by_staff_id text,
      confirmed_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE bookkeeping_journal_entry_voucher_line (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      voucher_id text NOT NULL,
      line_sequence integer NOT NULL,
      side text NOT NULL,
      account_name text,
      account_code text,
      amount_krw integer NOT NULL DEFAULT 0,
      counterparty text,
      counterparty_code text,
      memo text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `)
})

beforeEach(async () => {
  await client.execute(`DELETE FROM bookkeeping_journal_entry_voucher_line`)
  await client.execute(`DELETE FROM bookkeeping_journal_entry_voucher`)
  await client.execute(`DELETE FROM bookkeeping_journal_entry_row`)
  await client.execute(`DELETE FROM bookkeeping_journal_entry_run`)
  await client.execute(`DELETE FROM bookkeeping_transaction_classification`)
  await client.execute(`DELETE FROM bookkeeping_classification_run`)
  await client.execute(`DELETE FROM bookkeeping_material_attribution`)
  await client.execute(`DELETE FROM upload_session`)
  await client.execute(`DELETE FROM source_batch`)
  await client.execute(`DELETE FROM bookkeeping_ledger_material_link`)
  await client.execute(`DELETE FROM bookkeeping_fiscal_year_ledger`)
})

const { listAccumulatedJournalVouchers } = await import('./fiscal-year-ledger-journal-view')

const TENANT_A = 'tenant-a'
const TENANT_B = 'tenant-b'

async function seedLedger(params: { tenantId: string; ledgerId: string; fiscalYear: number; clientId?: string }) {
  await testDb.insert(appSchema.bookkeepingFiscalYearLedger).values({
    id: params.ledgerId,
    tenantId: params.tenantId,
    clientId: params.clientId ?? 'client-1',
    fiscalYear: params.fiscalYear,
    createdAt: '2026-01-01T00:00:00.000+09:00',
    updatedAt: '2026-01-01T00:00:00.000+09:00',
  })
}

async function seedLink(params: {
  tenantId: string
  ledgerId: string
  periodMonth: string
  uploadSessionId: string
  uploadFileId?: string
}) {
  await testDb.insert(appSchema.bookkeepingLedgerMaterialLink).values({
    id: randomUUID(),
    tenantId: params.tenantId,
    ledgerId: params.ledgerId,
    periodMonth: params.periodMonth,
    uploadSessionId: params.uploadSessionId,
    uploadFileId: params.uploadFileId,
    sourceFingerprint: randomUUID(),
    status: 'included',
    createdAt: '2026-01-01T00:00:00.000+09:00',
    updatedAt: '2026-01-01T00:00:00.000+09:00',
  })
}

async function seedCompletedClassificationRun(params: { tenantId: string; sessionId: string; runId?: string; createdAt?: string }) {
  const runId = params.runId ?? randomUUID()
  await testDb.insert(appSchema.bookkeepingClassificationRun).values({
    id: runId,
    tenantId: params.tenantId,
    uploadSessionId: params.sessionId,
    status: 'completed',
    appliedCategoryNotes: 'notes',
    createdAt: params.createdAt ?? '2026-01-01T00:00:00.000+09:00',
    updatedAt: params.createdAt ?? '2026-01-01T00:00:00.000+09:00',
  })
  return runId
}

async function seedClassificationRow(params: { tenantId: string; sessionId: string; runId: string; rowId?: string; uploadFileId?: string }) {
  const rowId = params.rowId ?? randomUUID()
  await testDb.insert(appSchema.bookkeepingTransactionClassification).values({
    id: rowId,
    tenantId: params.tenantId,
    classificationRunId: params.runId,
    uploadSessionId: params.sessionId,
    uploadFileId: params.uploadFileId,
    sourceType: 'bank',
    direction: 'expense',
    status: 'confirmed',
    createdAt: '2026-01-01T00:00:00.000+09:00',
    updatedAt: '2026-01-01T00:00:00.000+09:00',
  })
  return rowId
}

async function seedJournalRunWithVouchers(params: {
  tenantId: string
  sessionId: string
  classificationRunId: string
  runId?: string
  createdAt?: string
  vouchers: Array<{
    voucherId?: string
    classificationRowId: string
    sourceClassificationRowIds?: string[]
    attributedPeriod: string | null
    voucherNumber?: string
  }>
}) {
  const runId = params.runId ?? randomUUID()
  await testDb.insert(appSchema.bookkeepingJournalEntryRun).values({
    id: runId,
    tenantId: params.tenantId,
    uploadSessionId: params.sessionId,
    classificationRunId: params.classificationRunId,
    status: 'completed',
    appliedRulesSnapshot: 'snapshot',
    createdAt: params.createdAt ?? '2026-01-01T00:00:00.000+09:00',
    updatedAt: params.createdAt ?? '2026-01-01T00:00:00.000+09:00',
  })

  for (const [index, voucher] of params.vouchers.entries()) {
    const voucherId = voucher.voucherId ?? randomUUID()
    await testDb.insert(appSchema.bookkeepingJournalEntryVoucher).values({
      id: voucherId,
      tenantId: params.tenantId,
      journalEntryRunId: runId,
      uploadSessionId: params.sessionId,
      classificationRowId: voucher.classificationRowId,
      sourceClassificationRowIds: voucher.sourceClassificationRowIds ? JSON.stringify(voucher.sourceClassificationRowIds) : null,
      voucherNumber: voucher.voucherNumber ?? String(index + 1).padStart(5, '0'),
      requestedPeriod: '2026-05',
      attributedPeriod: voucher.attributedPeriod,
      closePeriod: '2026-05~2026-05',
      status: 'draft',
      createdAt: '2026-01-01T00:00:00.000+09:00',
      updatedAt: '2026-01-01T00:00:00.000+09:00',
    })
    await testDb.insert(appSchema.bookkeepingJournalEntryVoucherLine).values([
      {
        id: randomUUID(),
        tenantId: params.tenantId,
        voucherId,
        lineSequence: 1,
        side: 'debit',
        accountName: '복리후생비',
        amountKrw: 10000,
        createdAt: '2026-01-01T00:00:00.000+09:00',
        updatedAt: '2026-01-01T00:00:00.000+09:00',
      },
      {
        id: randomUUID(),
        tenantId: params.tenantId,
        voucherId,
        lineSequence: 2,
        side: 'credit',
        accountName: '보통예금',
        amountKrw: 10000,
        createdAt: '2026-01-01T00:00:00.000+09:00',
        updatedAt: '2026-01-01T00:00:00.000+09:00',
      },
    ])
  }

  return runId
}

async function seedJournalRunWithLegacyRows(params: {
  tenantId: string
  sessionId: string
  classificationRunId: string
  runId?: string
  rows: Array<{ rowId?: string; classificationRowId: string; attributedPeriod: string | null; entryDate?: string }>
}) {
  const runId = params.runId ?? randomUUID()
  await testDb.insert(appSchema.bookkeepingJournalEntryRun).values({
    id: runId,
    tenantId: params.tenantId,
    uploadSessionId: params.sessionId,
    classificationRunId: params.classificationRunId,
    status: 'draft',
    appliedRulesSnapshot: 'snapshot',
    createdAt: '2026-01-01T00:00:00.000+09:00',
    updatedAt: '2026-01-01T00:00:00.000+09:00',
  })

  for (const [index, row] of params.rows.entries()) {
    await testDb.insert(appSchema.bookkeepingJournalEntryRow).values({
      id: row.rowId ?? randomUUID(),
      tenantId: params.tenantId,
      journalEntryRunId: runId,
      uploadSessionId: params.sessionId,
      classificationRowId: row.classificationRowId,
      entryDate: row.entryDate ?? '2026-05-10',
      requestedPeriod: '2026-05',
      attributedPeriod: row.attributedPeriod,
      closePeriod: '2026-05~2026-05',
      debitAccount: '복리후생비',
      debitAmountKrw: 10000 + index,
      creditAccount: '보통예금',
      creditAmountKrw: 10000 + index,
      counterparty: '테스트 거래처',
      memo: 'legacy row',
      status: 'draft',
      createdAt: '2026-01-01T00:00:00.000+09:00',
      updatedAt: '2026-01-01T00:00:00.000+09:00',
    })
  }

  return runId
}

describe('listAccumulatedJournalVouchers', () => {
  it('returns 404 when the ledger does not belong to the tenant', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_B, ledgerId: 'ledger-1' })

    expect(result).toEqual({ ok: false, status: 404, error: '회계연도 장부를 찾을 수 없습니다.' })
  })

  it('returns 400 when the period year does not match the ledger fiscal year', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2025-05' })

    expect(result).toEqual({ ok: false, status: 400, error: '기간 형식이 올바르지 않거나 장부의 회계연도와 다릅니다.' })
  })

  it('returns an empty result when nothing is included for the period', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })

    expect(result).toMatchObject({ ok: true, sessionCount: 0, vouchers: [] })
  })

  it('returns vouchers with lines for an included session and period', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-05', uploadSessionId: 'session-1', uploadFileId: 'file-1' })
    const classificationRunId = await seedCompletedClassificationRun({ tenantId: TENANT_A, sessionId: 'session-1' })
    const rowId = await seedClassificationRow({ tenantId: TENANT_A, sessionId: 'session-1', runId: classificationRunId, uploadFileId: 'file-1' })
    await seedJournalRunWithVouchers({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      classificationRunId,
      vouchers: [{ classificationRowId: rowId, attributedPeriod: '2026-05' }],
    })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.sessionCount).toBe(1)
    expect(result.vouchers).toHaveLength(1)
    expect(result.vouchers[0].lines).toHaveLength(2)
    expect(result.vouchers[0].stale).toBe(false)
    expect(result.vouchers[0].periodMonth).toBe('2026-05')
  })

  it('falls back to legacy journal rows when voucher rows are not stored yet', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-05', uploadSessionId: 'session-1', uploadFileId: 'file-1' })
    const classificationRunId = await seedCompletedClassificationRun({ tenantId: TENANT_A, sessionId: 'session-1' })
    const rowId = await seedClassificationRow({ tenantId: TENANT_A, sessionId: 'session-1', runId: classificationRunId, uploadFileId: 'file-1' })
    await seedJournalRunWithLegacyRows({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      classificationRunId,
      rows: [
        { classificationRowId: rowId, attributedPeriod: '2026-05' },
        { classificationRowId: rowId, attributedPeriod: '2026-05' },
      ],
    })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.sessionCount).toBe(1)
    expect(result.vouchers).toHaveLength(2)
    expect(result.vouchers[0].lines).toHaveLength(2)
    expect(result.vouchers[0].voucher.voucherNumber).toBe('00001')
    expect(result.vouchers[1].voucher.voucherNumber).toBe('00002')
    expect(result.vouchers[0].lines.map((line) => line.side)).toEqual(['debit', 'credit'])
  })

  it('orders legacy journal rows like the session-level fallback before assigning voucher numbers', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-05', uploadSessionId: 'session-1', uploadFileId: 'file-1' })
    const classificationRunId = await seedCompletedClassificationRun({ tenantId: TENANT_A, sessionId: 'session-1' })
    const rowId = await seedClassificationRow({ tenantId: TENANT_A, sessionId: 'session-1', runId: classificationRunId, uploadFileId: 'file-1' })
    await seedJournalRunWithLegacyRows({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      classificationRunId,
      rows: [
        { classificationRowId: rowId, attributedPeriod: '2026-05', entryDate: '2026-05-20' },
        { classificationRowId: rowId, attributedPeriod: '2026-05', entryDate: '2026-05-01' },
      ],
    })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.vouchers.map((item) => [item.voucher.voucherNumber, item.voucher.entryDate])).toEqual([
      ['00001', '2026-05-01'],
      ['00002', '2026-05-20'],
    ])
  })

  it('marks a voucher stale when classification was re-run after the journal run', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-05', uploadSessionId: 'session-1', uploadFileId: 'file-1' })
    const firstClassificationRunId = await seedCompletedClassificationRun({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      createdAt: '2026-05-01T00:00:00.000+09:00',
    })
    const rowId = await seedClassificationRow({ tenantId: TENANT_A, sessionId: 'session-1', runId: firstClassificationRunId, uploadFileId: 'file-1' })
    await seedJournalRunWithVouchers({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      classificationRunId: firstClassificationRunId,
      vouchers: [{ classificationRowId: rowId, attributedPeriod: '2026-05' }],
    })

    // 계정항목 정리가 재실행되어 더 최신 completed run이 생겼다.
    await seedCompletedClassificationRun({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      createdAt: '2026-05-10T00:00:00.000+09:00',
    })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.staleVoucherCount).toBe(1)
    expect(result.vouchers[0].stale).toBe(true)
    expect(result.vouchers[0].staleReason).toBe('계정항목 정리가 업데이트되어 전표 분개표 초안을 다시 생성해야 합니다.')
  })

  it('marks a voucher stale when its source file is no longer included', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    // material_link에 file-included만 있고 file-excluded는 없다 (attribution에서 빠짐).
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-05', uploadSessionId: 'session-1', uploadFileId: 'file-included' })
    const classificationRunId = await seedCompletedClassificationRun({ tenantId: TENANT_A, sessionId: 'session-1' })
    const rowId = await seedClassificationRow({ tenantId: TENANT_A, sessionId: 'session-1', runId: classificationRunId, uploadFileId: 'file-excluded' })
    await seedJournalRunWithVouchers({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      classificationRunId,
      vouchers: [{ classificationRowId: rowId, attributedPeriod: '2026-05' }],
    })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.staleVoucherCount).toBe(1)
    expect(result.vouchers[0].stale).toBe(true)
    expect(result.vouchers[0].staleReason).toBe('귀속 자료가 더 이상 회계연도 장부에 포함되어 있지 않습니다.')
  })

  it('checks all source classification rows when a voucher has multiple source rows', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-05', uploadSessionId: 'session-1', uploadFileId: 'file-included' })
    const classificationRunId = await seedCompletedClassificationRun({ tenantId: TENANT_A, sessionId: 'session-1' })
    const includedRowId = await seedClassificationRow({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      runId: classificationRunId,
      uploadFileId: 'file-included',
    })
    const excludedRowId = await seedClassificationRow({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      runId: classificationRunId,
      uploadFileId: 'file-excluded',
    })
    await seedJournalRunWithVouchers({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      classificationRunId,
      vouchers: [{
        classificationRowId: includedRowId,
        sourceClassificationRowIds: [includedRowId, excludedRowId],
        attributedPeriod: '2026-05',
      }],
    })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.staleVoucherCount).toBe(1)
    expect(result.vouchers[0].stale).toBe(true)
    expect(result.vouchers[0].staleReason).toBe('귀속 자료가 더 이상 회계연도 장부에 포함되어 있지 않습니다.')
  })

  it('excludes a voucher with no attributedPeriod and counts it separately', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-05', uploadSessionId: 'session-1', uploadFileId: 'file-1' })
    const classificationRunId = await seedCompletedClassificationRun({ tenantId: TENANT_A, sessionId: 'session-1' })
    const rowId = await seedClassificationRow({ tenantId: TENANT_A, sessionId: 'session-1', runId: classificationRunId, uploadFileId: 'file-1' })
    await seedJournalRunWithVouchers({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      classificationRunId,
      vouchers: [{ classificationRowId: rowId, attributedPeriod: null }],
    })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.vouchers).toHaveLength(0)
    expect(result.excludedUnknownPeriodCount).toBe(1)
  })

  it('does not return another tenant material even with the same session id', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLedger({ tenantId: TENANT_B, ledgerId: 'ledger-2', fiscalYear: 2026, clientId: 'client-b' })
    await seedLink({ tenantId: TENANT_B, ledgerId: 'ledger-2', periodMonth: '2026-05', uploadSessionId: 'session-1', uploadFileId: 'file-1' })
    const classificationRunId = await seedCompletedClassificationRun({ tenantId: TENANT_B, sessionId: 'session-1' })
    const rowId = await seedClassificationRow({ tenantId: TENANT_B, sessionId: 'session-1', runId: classificationRunId, uploadFileId: 'file-1' })
    await seedJournalRunWithVouchers({
      tenantId: TENANT_B,
      sessionId: 'session-1',
      classificationRunId,
      vouchers: [{ classificationRowId: rowId, attributedPeriod: '2026-05' }],
    })

    const result = await listAccumulatedJournalVouchers({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.vouchers).toHaveLength(0)
  })
})
