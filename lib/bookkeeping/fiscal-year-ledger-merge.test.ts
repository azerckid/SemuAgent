import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq } from 'drizzle-orm'
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
  // db.transaction()은 connection을 점유했다가 다음 호출에서 새로 연결한다.
  // ':memory:'는 새 연결마다 빈 DB가 생기므로 파일 기반 sqlite를 사용한다.
  testDir = mkdtempSync(join(tmpdir(), 'jaryo-fiscal-ledger-'))
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
    CREATE TABLE bookkeeping_ledger_month (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      ledger_id text NOT NULL,
      period_month text NOT NULL,
      status text NOT NULL DEFAULT 'not_requested',
      last_upload_session_id text,
      last_material_attribution_run_at text,
      last_classification_run_id text,
      last_journal_entry_run_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      UNIQUE(tenant_id, ledger_id, period_month)
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
    CREATE UNIQUE INDEX bookkeeping_ledger_link_included_fingerprint_uidx
    ON bookkeeping_ledger_material_link (tenant_id, ledger_id, period_month, source_fingerprint)
    WHERE status = 'included'
  `)
})

afterAll(async () => {
  client?.close()
  if (testDir) rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await client.execute(`DELETE FROM bookkeeping_ledger_material_link`)
  await client.execute(`DELETE FROM bookkeeping_ledger_month`)
  await client.execute(`DELETE FROM bookkeeping_fiscal_year_ledger`)
  await client.execute(`DELETE FROM bookkeeping_material_attribution`)
  await client.execute(`DELETE FROM upload_session`)
})

const { mergeIncludedAttributionIntoLedger } = await import('./fiscal-year-ledger')

const TENANT_A = 'tenant-a'
const TENANT_B = 'tenant-b'
const STAFF = { id: 'staff-1', role: 'TENANT_ADMIN' as const }

async function seedSession(params: { tenantId: string; sessionId: string; clientId?: string }) {
  await testDb.insert(appSchema.uploadSession).values({
    id: params.sessionId,
    tenantId: params.tenantId,
    clientId: params.clientId ?? 'client-1',
    createdByStaffId: STAFF.id,
    accountingPeriod: '2026-05',
    tokenHash: `hash-${params.sessionId}`,
    expiresAt: '2026-06-30T00:00:00.000+09:00',
    createdAt: '2026-05-01T00:00:00.000+09:00',
  })
}

async function seedAttributionRow(params: {
  tenantId: string
  sessionId: string
  id?: string
  status?: 'active' | 'superseded'
  recommendation?: 'include' | 'hold' | 'exclude_duplicate' | 'reference_only'
  staffDecision?: 'include' | 'hold' | 'exclude_duplicate' | 'reference_only' | null
  attributedPeriod?: string | null
  evidenceDate?: string | null
  amountKrw?: number
  counterparty?: string
  uploadFileId?: string | null
}) {
  const id = params.id ?? randomUUID()
  await testDb.insert(appSchema.bookkeepingMaterialAttribution).values({
    id,
    tenantId: params.tenantId,
    uploadSessionId: params.sessionId,
    uploadFileId: params.uploadFileId ?? 'file-1',
    status: params.status ?? 'active',
    sourceKind: 'transaction_row',
    sourceLabel: '하나은행 거래내역',
    evidenceDate: params.evidenceDate === undefined ? '2026-05-10' : params.evidenceDate,
    attributedPeriod: params.attributedPeriod === undefined ? '2026-05' : params.attributedPeriod,
    requestedPeriod: '2026-05',
    closePeriod: '2026-05~2026-05',
    periodRelation: 'requested',
    amountKrw: params.amountKrw ?? 50000,
    counterparty: params.counterparty ?? '거래처A',
    recommendation: params.recommendation ?? 'include',
    staffDecision: params.staffDecision ?? null,
    createdAt: '2026-05-10T00:00:00.000+09:00',
    updatedAt: '2026-05-10T00:00:00.000+09:00',
  })
  return id
}

describe('bookkeeping_ledger_link_included_fingerprint_uidx', () => {
  it('rejects a second included link with the same fingerprint at the database level', async () => {
    const common = {
      tenantId: TENANT_A,
      ledgerId: 'ledger-1',
      periodMonth: '2026-05',
      uploadSessionId: 'session-1',
      sourceFingerprint: 'fp-1',
      status: 'included' as const,
      createdAt: '2026-05-10T00:00:00.000+09:00',
      updatedAt: '2026-05-10T00:00:00.000+09:00',
    }

    await testDb.insert(appSchema.bookkeepingLedgerMaterialLink).values({ id: 'link-1', ...common })

    await expect(
      testDb.insert(appSchema.bookkeepingLedgerMaterialLink).values({ id: 'link-2', ...common }),
    ).rejects.toThrow()
  })
})

describe('mergeIncludedAttributionIntoLedger', () => {
  it('returns 404 when the session does not belong to the tenant', async () => {
    await seedSession({ tenantId: TENANT_A, sessionId: 'session-1' })

    const result = await mergeIncludedAttributionIntoLedger({
      tenantId: TENANT_B,
      sessionId: 'session-1',
      staffRecord: STAFF,
    })

    expect(result).toEqual({ ok: false, status: 404, error: '세션을 찾을 수 없습니다.' })

    const links = await testDb.select().from(appSchema.bookkeepingLedgerMaterialLink)
    expect(links).toHaveLength(0)
  })

  it('merges an included attribution row into a new ledger month and link', async () => {
    await seedSession({ tenantId: TENANT_A, sessionId: 'session-1' })
    const attributionId = await seedAttributionRow({ tenantId: TENANT_A, sessionId: 'session-1' })

    const result = await mergeIncludedAttributionIntoLedger({
      tenantId: TENANT_A,
      sessionId: 'session-1',
      staffRecord: STAFF,
    })

    expect(result).toEqual({ ok: true, linkedCount: 1, supersededCount: 0, staleCount: 0, skippedUnknownPeriodCount: 0 })

    const links = await testDb.select().from(appSchema.bookkeepingLedgerMaterialLink)
    expect(links).toHaveLength(1)
    expect(links[0].status).toBe('included')
    expect(links[0].periodMonth).toBe('2026-05')
    expect(links[0].materialAttributionId).toBe(attributionId)

    const ledgers = await testDb.select().from(appSchema.bookkeepingFiscalYearLedger)
    expect(ledgers).toHaveLength(1)
    expect(ledgers[0].fiscalYear).toBe(2026)

    const months = await testDb.select().from(appSchema.bookkeepingLedgerMonth)
    expect(months).toHaveLength(12)
  })

  it('does not duplicate a link when merge runs again with no changes', async () => {
    await seedSession({ tenantId: TENANT_A, sessionId: 'session-1' })
    await seedAttributionRow({ tenantId: TENANT_A, sessionId: 'session-1' })

    await mergeIncludedAttributionIntoLedger({ tenantId: TENANT_A, sessionId: 'session-1', staffRecord: STAFF })
    const second = await mergeIncludedAttributionIntoLedger({ tenantId: TENANT_A, sessionId: 'session-1', staffRecord: STAFF })

    expect(second).toEqual({ ok: true, linkedCount: 0, supersededCount: 0, staleCount: 0, skippedUnknownPeriodCount: 0 })

    const links = await testDb.select().from(appSchema.bookkeepingLedgerMaterialLink)
    expect(links).toHaveLength(1)
    expect(links[0].status).toBe('included')
  })

  it('supersedes the old link when attribution is re-run for the same physical material', async () => {
    await seedSession({ tenantId: TENANT_A, sessionId: 'session-1' })
    const firstAttributionId = await seedAttributionRow({ tenantId: TENANT_A, sessionId: 'session-1' })
    await mergeIncludedAttributionIntoLedger({ tenantId: TENANT_A, sessionId: 'session-1', staffRecord: STAFF })

    // 실제 재실행 경로(period-attribution-service.ts)는 row를 지우지 않고
    // status를 'superseded'로 바꾼 뒤 같은 물리적 자료를 가리키는 새 active row를 추가한다.
    await testDb
      .update(appSchema.bookkeepingMaterialAttribution)
      .set({ status: 'superseded' })
      .where(eq(appSchema.bookkeepingMaterialAttribution.id, firstAttributionId))
    const secondAttributionId = await seedAttributionRow({ tenantId: TENANT_A, sessionId: 'session-1' })

    const result = await mergeIncludedAttributionIntoLedger({ tenantId: TENANT_A, sessionId: 'session-1', staffRecord: STAFF })

    expect(result).toEqual({ ok: true, linkedCount: 1, supersededCount: 1, staleCount: 0, skippedUnknownPeriodCount: 0 })

    const links = await testDb.select().from(appSchema.bookkeepingLedgerMaterialLink)
    expect(links).toHaveLength(2)
    const superseded = links.find((link) => link.materialAttributionId === firstAttributionId)
    const included = links.find((link) => link.materialAttributionId === secondAttributionId)
    expect(superseded?.status).toBe('superseded')
    expect(included?.status).toBe('included')
  })

  it('marks an existing link stale when the staff decision changes away from include', async () => {
    await seedSession({ tenantId: TENANT_A, sessionId: 'session-1' })
    const attributionId = await seedAttributionRow({ tenantId: TENANT_A, sessionId: 'session-1' })
    await mergeIncludedAttributionIntoLedger({ tenantId: TENANT_A, sessionId: 'session-1', staffRecord: STAFF })

    await testDb
      .update(appSchema.bookkeepingMaterialAttribution)
      .set({ staffDecision: 'exclude_duplicate' })
      .where(eq(appSchema.bookkeepingMaterialAttribution.id, attributionId))

    const result = await mergeIncludedAttributionIntoLedger({ tenantId: TENANT_A, sessionId: 'session-1', staffRecord: STAFF })

    expect(result).toEqual({ ok: true, linkedCount: 0, supersededCount: 0, staleCount: 1, skippedUnknownPeriodCount: 0 })

    const links = await testDb.select().from(appSchema.bookkeepingLedgerMaterialLink)
    expect(links).toHaveLength(1)
    expect(links[0].status).toBe('stale')
  })

  it('skips rows with an unresolved period and does not create a link', async () => {
    await seedSession({ tenantId: TENANT_A, sessionId: 'session-1' })
    await seedAttributionRow({ tenantId: TENANT_A, sessionId: 'session-1', attributedPeriod: null, evidenceDate: null })

    const result = await mergeIncludedAttributionIntoLedger({ tenantId: TENANT_A, sessionId: 'session-1', staffRecord: STAFF })

    expect(result).toEqual({ ok: true, linkedCount: 0, supersededCount: 0, staleCount: 0, skippedUnknownPeriodCount: 1 })

    const links = await testDb.select().from(appSchema.bookkeepingLedgerMaterialLink)
    expect(links).toHaveLength(0)
  })
})
