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
    CREATE TABLE upload_file (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      original_filename text
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
})

beforeEach(async () => {
  await client.execute(`DELETE FROM bookkeeping_transaction_classification`)
  await client.execute(`DELETE FROM bookkeeping_classification_run`)
  await client.execute(`DELETE FROM bookkeeping_material_attribution`)
  await client.execute(`DELETE FROM upload_session`)
  await client.execute(`DELETE FROM source_batch`)
  await client.execute(`DELETE FROM bookkeeping_ledger_material_link`)
  await client.execute(`DELETE FROM bookkeeping_fiscal_year_ledger`)
})

const { listAccumulatedClassificationRows } = await import('./fiscal-year-ledger-classification-view')

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

async function seedCompletedRunWithRows(params: {
  tenantId: string
  sessionId: string
  runId?: string
  status?: 'draft' | 'running' | 'completed' | 'failed' | 'superseded'
  createdAt?: string
  rows: Array<{ transactionDate: string | null; merchantName?: string; amountKrw?: number; uploadFileId?: string }>
}) {
  const runId = params.runId ?? randomUUID()
  await testDb.insert(appSchema.bookkeepingClassificationRun).values({
    id: runId,
    tenantId: params.tenantId,
    uploadSessionId: params.sessionId,
    status: params.status ?? 'completed',
    appliedCategoryNotes: 'notes',
    createdAt: params.createdAt ?? '2026-01-01T00:00:00.000+09:00',
    updatedAt: params.createdAt ?? '2026-01-01T00:00:00.000+09:00',
  })

  for (const row of params.rows) {
    await testDb.insert(appSchema.bookkeepingTransactionClassification).values({
      id: randomUUID(),
      tenantId: params.tenantId,
      classificationRunId: runId,
      uploadSessionId: params.sessionId,
      uploadFileId: row.uploadFileId,
      sourceType: 'bank',
      transactionDate: row.transactionDate,
      merchantName: row.merchantName ?? '거래처A',
      amountKrw: row.amountKrw ?? 10000,
      direction: 'expense',
      status: 'suggested',
      createdAt: '2026-01-01T00:00:00.000+09:00',
      updatedAt: '2026-01-01T00:00:00.000+09:00',
    })
  }

  return runId
}

describe('listAccumulatedClassificationRows', () => {
  it('returns 404 when the ledger does not belong to the tenant', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })

    const result = await listAccumulatedClassificationRows({ tenantId: TENANT_B, ledgerId: 'ledger-1' })

    expect(result).toEqual({ ok: false, status: 404, error: '회계연도 장부를 찾을 수 없습니다.' })
  })

  it('returns 400 when the period year does not match the ledger fiscal year', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })

    const result = await listAccumulatedClassificationRows({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2025-05' })

    expect(result).toEqual({ ok: false, status: 400, error: '기간 형식이 올바르지 않거나 장부의 회계연도와 다릅니다.' })
  })

  it('returns an empty result for a period with no included material', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })

    const result = await listAccumulatedClassificationRows({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-03' })

    expect(result).toMatchObject({ ok: true, sessionCount: 0, rows: [] })
  })

  it('aggregates rows from multiple included sessions across the default full-year range', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-01', uploadSessionId: 'session-jan' })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-02', uploadSessionId: 'session-feb' })
    await seedCompletedRunWithRows({
      tenantId: TENANT_A,
      sessionId: 'session-jan',
      rows: [{ transactionDate: '2026-01-15' }],
    })
    await seedCompletedRunWithRows({
      tenantId: TENANT_A,
      sessionId: 'session-feb',
      rows: [{ transactionDate: '2026-02-10' }],
    })

    const result = await listAccumulatedClassificationRows({ tenantId: TENANT_A, ledgerId: 'ledger-1' })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.period).toEqual({ type: 'year', start: '2026-01', end: '2026-12', label: '2026' })
    expect(result.sessionCount).toBe(2)
    expect(result.rows.map((row) => row.periodMonth)).toEqual(['2026-01', '2026-02'])
  })

  it('cuts a session that spans multiple months down to the requested month using each row transactionDate', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    // 7월에 1년치 통장을 한 번에 올린 상황: 같은 세션이 여러 달의 ledger_month에 링크된다.
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-01', uploadSessionId: 'session-fullyear' })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-07', uploadSessionId: 'session-fullyear' })
    await seedCompletedRunWithRows({
      tenantId: TENANT_A,
      sessionId: 'session-fullyear',
      rows: [
        { transactionDate: '2026-01-05', merchantName: '1월거래' },
        { transactionDate: '2026-07-20', merchantName: '7월거래' },
      ],
    })

    const julyOnly = await listAccumulatedClassificationRows({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-07' })
    if (!julyOnly.ok) throw new Error('expected ok')
    expect(julyOnly.rows).toHaveLength(1)
    expect(julyOnly.rows[0].merchantName).toBe('7월거래')

    const janOnly = await listAccumulatedClassificationRows({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-01' })
    if (!janOnly.ok) throw new Error('expected ok')
    expect(janOnly.rows).toHaveLength(1)
    expect(janOnly.rows[0].merchantName).toBe('1월거래')
  })

  it('excludes classification rows from a file that is not currently included in the ledger', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    // 같은 세션 안에 included 파일 하나, attribution에서 제외/재실행으로 더 이상
    // included가 아닌 파일이 하나 있는 상황. classification run은 두 파일의 거래를
    // 모두 가지고 있을 수 있다(생성 시점 또는 이후 재머지로 stale해진 경우).
    await seedLink({
      tenantId: TENANT_A,
      ledgerId: 'ledger-1',
      periodMonth: '2026-05',
      uploadSessionId: 'session-1',
      uploadFileId: 'file-included',
    })
    await seedCompletedRunWithRows({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      rows: [
        { transactionDate: '2026-05-05', merchantName: '포함된파일거래', uploadFileId: 'file-included' },
        { transactionDate: '2026-05-06', merchantName: '제외된파일거래', uploadFileId: 'file-excluded' },
      ],
    })

    const result = await listAccumulatedClassificationRows({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].merchantName).toBe('포함된파일거래')
    expect(result.excludedNotAcceptedFileCount).toBe(1)
  })

  it('does not file-filter when included links have no uploadFileId recorded', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-05', uploadSessionId: 'session-1' })
    await seedCompletedRunWithRows({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      rows: [{ transactionDate: '2026-05-05', merchantName: '거래', uploadFileId: 'file-x' }],
    })

    const result = await listAccumulatedClassificationRows({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.rows).toHaveLength(1)
    expect(result.excludedNotAcceptedFileCount).toBe(0)
  })

  it('only uses the latest completed run per session and ignores draft/running/failed runs', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLink({ tenantId: TENANT_A, ledgerId: 'ledger-1', periodMonth: '2026-05', uploadSessionId: 'session-1' })

    await seedCompletedRunWithRows({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      status: 'completed',
      createdAt: '2026-05-01T00:00:00.000+09:00',
      rows: [{ transactionDate: '2026-05-01', merchantName: '구버전' }],
    })
    await seedCompletedRunWithRows({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      status: 'completed',
      createdAt: '2026-05-10T00:00:00.000+09:00',
      rows: [{ transactionDate: '2026-05-10', merchantName: '최신완료' }],
    })
    await seedCompletedRunWithRows({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      status: 'running',
      createdAt: '2026-05-15T00:00:00.000+09:00',
      rows: [{ transactionDate: '2026-05-15', merchantName: '진행중' }],
    })

    const result = await listAccumulatedClassificationRows({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].merchantName).toBe('최신완료')
  })

  it('does not return another tenant material even with the same session id', async () => {
    await seedLedger({ tenantId: TENANT_A, ledgerId: 'ledger-1', fiscalYear: 2026 })
    await seedLedger({ tenantId: TENANT_B, ledgerId: 'ledger-2', fiscalYear: 2026, clientId: 'client-b' })
    await seedLink({ tenantId: TENANT_B, ledgerId: 'ledger-2', periodMonth: '2026-05', uploadSessionId: 'session-1' })
    await seedCompletedRunWithRows({
      tenantId: TENANT_B,
      sessionId: 'session-1',
      rows: [{ transactionDate: '2026-05-01' }],
    })

    const result = await listAccumulatedClassificationRows({ tenantId: TENANT_A, ledgerId: 'ledger-1', period: '2026-05' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.rows).toHaveLength(0)
  })
})
