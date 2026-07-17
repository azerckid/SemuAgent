import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as appSchema from '@/lib/db/schema'

// QA 12 U-05: 분석 실패 파일의 재시도 API가 상태를 갱신하고 분석을 다시 돌린다.
// 브라우저 수동검증 대신 라우트를 직접 호출해 tenant 스코프·가드·상태 전이를 고정한다.

let client: Client
let testDb: ReturnType<typeof drizzle>
let testDir: string
let sessionTenantId = 'tenant-a'

const analyzeSpy = vi.fn(async () => {})

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

vi.mock('@/lib/auth-helpers', () => ({
  requireTenantSession: async () => ({
    user: { id: 'user-a' },
    session: {},
    tenantId: sessionTenantId,
  }),
}))

vi.mock('@/lib/ai/process', () => ({
  analyzeFileAndMaybeFinalize: (...args: unknown[]) => analyzeSpy(...(args as [])),
}))

beforeAll(async () => {
  process.env.TURSO_DATABASE_URL ??= 'libsql://test.local'
  process.env.TURSO_AUTH_TOKEN ??= 'test-token'
  process.env.BETTER_AUTH_SECRET ??= 'test-secret-at-least-32-characters-long'

  testDir = mkdtempSync(join(tmpdir(), 'semuagent-upload-retry-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })

  await client.execute(`
    CREATE TABLE upload_session (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      source text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE upload_file (
      id text PRIMARY KEY,
      upload_session_id text NOT NULL,
      tenant_id text NOT NULL,
      status text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE material_match (
      id text PRIMARY KEY,
      upload_file_id text NOT NULL,
      tenant_id text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE analysis_run (
      id text PRIMARY KEY,
      upload_file_id text NOT NULL,
      tenant_id text NOT NULL
    )
  `)
})

afterAll(() => {
  client.close()
  rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  sessionTenantId = 'tenant-a'
  analyzeSpy.mockClear()
  await client.execute('DELETE FROM analysis_run')
  await client.execute('DELETE FROM material_match')
  await client.execute('DELETE FROM upload_file')
  await client.execute('DELETE FROM upload_session')
})

async function seed(params: {
  tenantId: string
  source?: string
  fileStatus?: string
}) {
  await client.execute({
    sql: 'INSERT INTO upload_session (id, tenant_id, source) VALUES (?, ?, ?)',
    args: ['session-1', params.tenantId, params.source ?? 'staff_direct'],
  })
  await client.execute({
    sql: 'INSERT INTO upload_file (id, upload_session_id, tenant_id, status) VALUES (?, ?, ?, ?)',
    args: ['file-1', 'session-1', params.tenantId, params.fileStatus ?? 'failed'],
  })
}

function call(fileId: string) {
  return import('./route').then(({ POST }) =>
    POST(new Request('http://localhost:3000/api/upload/files/' + fileId + '/retry', { method: 'POST' }), {
      params: Promise.resolve({ fileId }),
    }),
  )
}

async function fileStatus(id: string) {
  const rs = await client.execute({ sql: 'SELECT status FROM upload_file WHERE id = ?', args: [id] })
  return rs.rows[0]?.status ?? null
}

describe('POST /api/upload/files/[fileId]/retry (QA 12 U-05)', () => {
  it('resets a failed staff_direct file to uploaded and re-runs analysis', async () => {
    await seed({ tenantId: 'tenant-a', fileStatus: 'failed' })
    await client.execute({
      sql: 'INSERT INTO analysis_run (id, upload_file_id, tenant_id) VALUES (?, ?, ?)',
      args: ['run-1', 'file-1', 'tenant-a'],
    })

    const response = await call('file-1')

    expect(response.status).toBe(200)
    expect(await fileStatus('file-1')).toBe('uploaded')
    expect(analyzeSpy).toHaveBeenCalledWith('file-1', 'tenant-a')
    // 이전 분석 흔적은 재시도 전에 정리된다.
    const runs = await client.execute('SELECT id FROM analysis_run')
    expect(runs.rows).toHaveLength(0)
  })

  it('rejects another tenant file with 404 and does not analyze', async () => {
    await seed({ tenantId: 'tenant-b', fileStatus: 'failed' })

    const response = await call('file-1')

    expect(response.status).toBe(404)
    expect(analyzeSpy).not.toHaveBeenCalled()
    expect(await fileStatus('file-1')).toBe('failed')
  })

  it('rejects a non-failed file with 409', async () => {
    await seed({ tenantId: 'tenant-a', fileStatus: 'matched' })

    const response = await call('file-1')

    expect(response.status).toBe(409)
    expect(analyzeSpy).not.toHaveBeenCalled()
    expect(await fileStatus('file-1')).toBe('matched')
  })

  it('rejects a non staff_direct source with 403', async () => {
    await seed({ tenantId: 'tenant-a', source: 'customer_upload', fileStatus: 'failed' })

    const response = await call('file-1')

    expect(response.status).toBe(403)
    expect(analyzeSpy).not.toHaveBeenCalled()
  })
})
