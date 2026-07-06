import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'
import { fromISO, toDBString } from '@/lib/time'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
}))

vi.mock('@/lib/ai/extract', () => ({
  extractDocumentTextChunks: vi.fn(),
}))

vi.mock('@/lib/ai/payroll-extract', () => ({
  extractPayrollWithProviderFallbackInBatches: vi.fn(),
  getPayrollAiModelChainLabel: () => 'gemini -> gpt-5.4-mini -> claude-sonnet-4-6',
}))

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: appSchema })
  await client.execute(`
    CREATE TABLE payroll_extraction_batch (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      upload_session_id text NOT NULL,
      source_batch_id text,
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
    CREATE UNIQUE INDEX payroll_batch_running_uidx
    ON payroll_extraction_batch (upload_session_id)
    WHERE status = 'running'
  `)
})

beforeEach(async () => {
  await client.execute(`DELETE FROM payroll_extraction_batch`)
})

const { payrollExtractionBatch } = appSchema
const {
  cleanupStalePayrollExtractionBatches,
  cancelRunningPayrollExtractionBatch,
} = await import('./payroll-extraction-service')

describe('cleanupStalePayrollExtractionBatches', () => {
  it('marks stale running payroll batches as failed', async () => {
    await testDb.insert(payrollExtractionBatch).values([
      {
        id: 'old-running',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-1',
        status: 'running',
        sourceUploadFileIds: '[]',
        createdAt: '2026-06-06T19:00:00.000+09:00',
      },
      {
        id: 'fresh-running',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-2',
        status: 'running',
        sourceUploadFileIds: '[]',
        createdAt: '2026-06-06T19:25:01.000+09:00',
      },
      {
        id: 'old-completed',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-3',
        status: 'completed',
        sourceUploadFileIds: '[]',
        createdAt: '2026-06-06T19:00:00.000+09:00',
        completedAt: '2026-06-06T19:01:00.000+09:00',
      },
    ])

    const referenceTime = fromISO('2026-06-06T19:30:00.000+09:00')
    const count = await cleanupStalePayrollExtractionBatches({
      tenantId: 'tenant-1',
      referenceTime,
    })

    expect(count).toBe(1)
    const rows = await testDb.select().from(payrollExtractionBatch)
    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get('old-running')?.status).toBe('failed')
    expect(byId.get('old-running')?.completedAt).toBe(toDBString(referenceTime))
    expect(byId.get('old-running')?.errorMessage).toContain('10분 이상 완료되지 않아')
    expect(byId.get('fresh-running')?.status).toBe('running')
    expect(byId.get('old-completed')?.status).toBe('completed')
  })

  it('can scope stale cleanup to a single session', async () => {
    await testDb.insert(payrollExtractionBatch).values([
      {
        id: 'session-target',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-1',
        status: 'running',
        sourceUploadFileIds: '[]',
        createdAt: '2026-06-06T19:00:00.000+09:00',
      },
      {
        id: 'session-other',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-2',
        status: 'running',
        sourceUploadFileIds: '[]',
        createdAt: '2026-06-06T19:00:00.000+09:00',
      },
    ])

    const count = await cleanupStalePayrollExtractionBatches({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      referenceTime: fromISO('2026-06-06T19:30:00.000+09:00'),
    })

    expect(count).toBe(1)
    const rows = await testDb.select().from(payrollExtractionBatch)
    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get('session-target')?.status).toBe('failed')
    expect(byId.get('session-other')?.status).toBe('running')
  })
})

describe('cancelRunningPayrollExtractionBatch', () => {
  it('marks the running batch for a session as failed', async () => {
    await testDb.insert(payrollExtractionBatch).values([
      {
        id: 'target-running',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-1',
        status: 'running',
        sourceUploadFileIds: '[]',
        createdAt: '2026-06-06T19:05:00.000+09:00',
      },
      {
        id: 'other-running',
        tenantId: 'tenant-1',
        uploadSessionId: 'session-2',
        status: 'running',
        sourceUploadFileIds: '[]',
        createdAt: '2026-06-06T19:10:00.000+09:00',
      },
    ])

    const referenceTime = fromISO('2026-06-06T19:30:00.000+09:00')
    const result = await cancelRunningPayrollExtractionBatch({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      referenceTime,
    })

    expect(result).toEqual({ cancelled: true, batchId: 'target-running' })
    const rows = await testDb.select().from(payrollExtractionBatch)
    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get('target-running')?.status).toBe('failed')
    expect(byId.get('target-running')?.completedAt).toBe(toDBString(referenceTime))
    expect(byId.get('target-running')?.errorMessage).toContain('담당자가 급여 추출을 중단했습니다')
    expect(byId.get('other-running')?.status).toBe('running')
  })

  it('returns cancelled false when no running batch exists', async () => {
    await testDb.insert(payrollExtractionBatch).values({
      id: 'completed',
      tenantId: 'tenant-1',
      uploadSessionId: 'session-1',
      status: 'completed',
      sourceUploadFileIds: '[]',
      createdAt: '2026-06-06T19:00:00.000+09:00',
      completedAt: '2026-06-06T19:01:00.000+09:00',
    })

    await expect(cancelRunningPayrollExtractionBatch({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
    })).resolves.toEqual({ cancelled: false, batchId: null })
  })
})
