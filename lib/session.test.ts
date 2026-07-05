import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq } from 'drizzle-orm'
import * as appSchema from '@/lib/db/schema'
import { hashToken } from '@/lib/token'

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
})

beforeEach(async () => {
  await client.execute('DELETE FROM upload_session')
})

async function seedUploadSession(params: {
  id: string
  rawToken: string
  status?: 'requested' | 'active' | 'expired' | 'revoked' | 'completed'
  expiresAt?: string
}) {
  await testDb.insert(appSchema.uploadSession).values({
    id: params.id,
    tenantId: 'tenant-1',
    clientId: 'client-1',
    createdByStaffId: 'staff-1',
    accountingPeriod: '2026-06',
    bookkeepingPeriodType: 'monthly',
    bookkeepingPeriodStart: '2026-06',
    bookkeepingPeriodEnd: '2026-06',
    tokenHash: hashToken(params.rawToken),
    uploadUrl: null,
    expiresAt: params.expiresAt ?? '2099-12-31T23:59:59.000+09:00',
    status: params.status ?? 'active',
    analysisNotes: null,
    sessionEvaluation: null,
    requestEmailSubject: null,
    requestEmailBody: null,
    requestEmailCc: null,
    extractedCriteria: null,
    additionalCriteria: null,
    lastAccessedAt: null,
    requestEventId: null,
    requestKind: 'general',
    source: 'customer_upload',
    staffDirectLabel: null,
    deletedAt: null,
    deletedByStaffId: null,
    createdAt: '2026-06-26T00:00:00.000+09:00',
  })
}

describe('verifyToken', () => {
  it('유효한 requested 세션을 active로 전환하고 마지막 접근 시각을 기록한다', async () => {
    const { verifyToken } = await import('./session')
    await seedUploadSession({ id: 'session-1', rawToken: 'raw-token', status: 'requested' })

    const session = await verifyToken('raw-token')

    expect(session?.id).toBe('session-1')
    const storedRows = await testDb
      .select({ status: appSchema.uploadSession.status, lastAccessedAt: appSchema.uploadSession.lastAccessedAt })
      .from(appSchema.uploadSession)
      .where(eq(appSchema.uploadSession.id, 'session-1'))
    expect(storedRows[0].status).toBe('active')
    expect(storedRows[0].lastAccessedAt).toEqual(expect.any(String))
  })

  it('만료·취소·기한 경과 세션은 null을 반환한다', async () => {
    const { verifyToken } = await import('./session')
    await seedUploadSession({ id: 'expired-status', rawToken: 'expired-status', status: 'expired' })
    await seedUploadSession({ id: 'revoked-status', rawToken: 'revoked-status', status: 'revoked' })
    await seedUploadSession({
      id: 'past-expiry',
      rawToken: 'past-expiry',
      status: 'active',
      expiresAt: '2000-01-01T00:00:00.000+09:00',
    })

    await expect(verifyToken('expired-status')).resolves.toBeNull()
    await expect(verifyToken('revoked-status')).resolves.toBeNull()
    await expect(verifyToken('past-expiry')).resolves.toBeNull()
  })
})
