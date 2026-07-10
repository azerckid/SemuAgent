import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'
import { fromISO } from '@/lib/time'

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
    CREATE TABLE bookkeeping_classification_run (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      source_batch_id text,
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
})

beforeEach(async () => {
  await client.execute(`DELETE FROM bookkeeping_transaction_classification`)
  await client.execute(`DELETE FROM bookkeeping_classification_run`)
})

const { bookkeepingClassificationRun, bookkeepingTransactionClassification } = appSchema
const {
  cleanupStaleBookkeepingClassificationRuns,
  restoreSupersededCompletedAfterEmptyFailedRun,
  resolveBookkeepingClassificationView,
} = await import('./classification-run-lifecycle')

describe('cleanupStaleBookkeepingClassificationRuns', () => {
  it('marks stale running runs as failed and keeps fresh running runs', async () => {
    await testDb.insert(bookkeepingClassificationRun).values([
      {
        id: 'stale-running',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-1',
        status: 'running',
        sourceFileCount: 1,
        extractedRowCount: 0,
        appliedCategoryNotes: 'notes',
        createdAt: '2026-06-08T15:58:34.000+09:00',
        updatedAt: '2026-06-08T15:58:34.000+09:00',
      },
      {
        id: 'fresh-running',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-2',
        status: 'running',
        sourceFileCount: 1,
        extractedRowCount: 0,
        appliedCategoryNotes: 'notes',
        createdAt: '2026-06-08T16:20:00.000+09:00',
        updatedAt: '2026-06-08T16:20:00.000+09:00',
      },
    ])

    const referenceTime = fromISO('2026-06-08T16:30:00.000+09:00')
    const count = await cleanupStaleBookkeepingClassificationRuns({
      tenantId: 'tenant-1',
      referenceTime,
    })

    expect(count).toBe(1)
    const rows = await testDb.select().from(bookkeepingClassificationRun)
    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get('stale-running')?.status).toBe('failed')
    expect(byId.get('fresh-running')?.status).toBe('running')
  })
})

describe('restoreSupersededCompletedAfterEmptyFailedRun', () => {
  it('restores the latest superseded run with rows after an empty failed attempt', async () => {
    await testDb.insert(bookkeepingClassificationRun).values([
      {
        id: 'previous-completed',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-1',
        status: 'superseded',
        sourceFileCount: 2,
        extractedRowCount: 310,
        appliedCategoryNotes: 'notes',
        createdAt: '2026-06-05T10:00:00.000+09:00',
        updatedAt: '2026-06-05T10:05:00.000+09:00',
      },
      {
        id: 'empty-failed',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-1',
        status: 'failed',
        sourceFileCount: 2,
        extractedRowCount: 0,
        appliedCategoryNotes: 'notes',
        errorMessage: 'interrupted',
        createdAt: '2026-06-08T15:58:34.000+09:00',
        updatedAt: '2026-06-08T15:58:34.000+09:00',
      },
    ])
    await testDb.insert(bookkeepingTransactionClassification).values({
      id: 'row-1',
      tenantId: 'tenant-1',
      classificationRunId: 'previous-completed',
      uploadSessionId: 'session-1',
      sourceType: 'bank',
      transactionDate: '2024-03-01',
      merchantName: '테스트',
      description: '거래',
      amountKrw: 1000,
      direction: 'expense',
      recommendedAccount: 'fees',
      recommendationConfidence: 'high',
      recommendationReason: '수수료',
      evidenceJson: '{}',
      status: 'suggested',
      createdAt: '2026-06-05T10:05:00.000+09:00',
      updatedAt: '2026-06-05T10:05:00.000+09:00',
    })

    const restoredRunId = await restoreSupersededCompletedAfterEmptyFailedRun({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
    })

    expect(restoredRunId).toBe('previous-completed')
    const rows = await testDb.select().from(bookkeepingClassificationRun)
    expect(rows.find((row) => row.id === 'previous-completed')?.status).toBe('completed')
  })
})

describe('resolveBookkeepingClassificationView', () => {
  it('returns completed rows even when the latest attempt failed empty', async () => {
    await testDb.insert(bookkeepingClassificationRun).values([
      {
        id: 'previous-completed',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-1',
        status: 'superseded',
        sourceFileCount: 2,
        extractedRowCount: 1,
        appliedCategoryNotes: 'notes',
        createdAt: '2026-06-05T10:00:00.000+09:00',
        updatedAt: '2026-06-05T10:05:00.000+09:00',
      },
      {
        id: 'empty-failed',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-1',
        status: 'failed',
        sourceFileCount: 2,
        extractedRowCount: 0,
        appliedCategoryNotes: 'notes',
        errorMessage: 'interrupted',
        createdAt: '2026-06-08T15:58:34.000+09:00',
        updatedAt: '2026-06-08T15:58:34.000+09:00',
      },
    ])
    await testDb.insert(bookkeepingTransactionClassification).values({
      id: 'row-1',
      tenantId: 'tenant-1',
      classificationRunId: 'previous-completed',
      uploadSessionId: 'session-1',
      sourceType: 'bank',
      transactionDate: '2024-03-01',
      merchantName: '테스트',
      description: '거래',
      amountKrw: 1000,
      direction: 'expense',
      recommendedAccount: 'fees',
      recommendationConfidence: 'high',
      recommendationReason: '수수료',
      evidenceJson: '{}',
      status: 'suggested',
      createdAt: '2026-06-05T10:05:00.000+09:00',
      updatedAt: '2026-06-05T10:05:00.000+09:00',
    })

    const view = await resolveBookkeepingClassificationView({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
    })

    expect(view.displayRun?.id).toBe('previous-completed')
    expect(view.rows).toHaveLength(1)
    expect(view.latestAttemptRun?.id).toBe('empty-failed')
    expect(view.progressRun).toBeNull()
  })

  it('clears stale running locks and restores the previous completed result on read', async () => {
    await testDb.insert(bookkeepingClassificationRun).values([
      {
        id: 'previous-completed',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-1',
        status: 'superseded',
        sourceFileCount: 2,
        extractedRowCount: 1,
        appliedCategoryNotes: 'notes',
        createdAt: '2026-06-05T10:00:00.000+09:00',
        updatedAt: '2026-06-05T10:05:00.000+09:00',
      },
      {
        id: 'stale-running',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-1',
        status: 'running',
        sourceFileCount: 2,
        extractedRowCount: 0,
        appliedCategoryNotes: 'notes',
        createdAt: '2026-06-08T15:58:34.000+09:00',
        updatedAt: '2026-06-08T15:58:34.000+09:00',
      },
    ])
    await testDb.insert(bookkeepingTransactionClassification).values({
      id: 'row-1',
      tenantId: 'tenant-1',
      classificationRunId: 'previous-completed',
      uploadSessionId: 'session-1',
      sourceType: 'bank',
      transactionDate: '2024-03-01',
      merchantName: '테스트',
      description: '거래',
      amountKrw: 1000,
      direction: 'expense',
      recommendedAccount: 'fees',
      recommendationConfidence: 'high',
      recommendationReason: '수수료',
      evidenceJson: '{}',
      status: 'suggested',
      createdAt: '2026-06-05T10:05:00.000+09:00',
      updatedAt: '2026-06-05T10:05:00.000+09:00',
    })

    const view = await resolveBookkeepingClassificationView({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      referenceTime: fromISO('2026-06-08T16:30:00.000+09:00'),
    })

    const rows = await testDb.select().from(bookkeepingClassificationRun)
    expect(rows.find((row) => row.id === 'stale-running')?.status).toBe('failed')
    expect(view.displayRun?.id).toBe('previous-completed')
    expect(view.progressRun).toBeNull()
    expect(view.rows).toHaveLength(1)
  })
})
