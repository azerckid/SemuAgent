import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
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

const getMock = vi.fn()
vi.mock('@vercel/blob', () => ({
  get: (...args: unknown[]) => getMock(...args),
}))

const tryDecryptExcelMock = vi.fn()
vi.mock('@/lib/ai/excel-decrypt', () => ({
  tryDecryptExcel: (...args: unknown[]) => tryDecryptExcelMock(...args),
}))

const STORAGE_URL = 'https://example.blob.vercel-storage.com/uploads/test.xlsx'

function validBlobResponse() {
  return {
    statusCode: 200,
    stream: new Blob([Buffer.from('encrypted-bytes')]).stream(),
    blob: { contentType: 'application/octet-stream' },
  }
}

async function seedFile(overrides: Partial<{
  id: string
  sessionId: string
  tenantId: string
  status: string
  passwordStatus: string
  attemptCount: number
}> = {}) {
  const row = {
    id: overrides.id ?? 'file-1',
    sessionId: overrides.sessionId ?? 'session-1',
    tenantId: overrides.tenantId ?? 'tenant-1',
    status: overrides.status ?? 'needs_review',
    passwordStatus: overrides.passwordStatus ?? 'required',
    attemptCount: overrides.attemptCount ?? 0,
  }
  await client.execute({
    sql: `INSERT INTO upload_file
      (id, upload_session_id, tenant_id, storage_key, status, password_status, password_last_submitted_at, password_attempt_count)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    args: [row.id, row.sessionId, row.tenantId, STORAGE_URL, row.status, row.passwordStatus, row.attemptCount],
  })
  return row
}

async function seedSession(id: string, tenantId: string, status: string) {
  await client.execute({
    sql: `INSERT INTO upload_session (id, tenant_id, status) VALUES (?, ?, ?)`,
    args: [id, tenantId, status],
  })
}

async function readFile(id: string) {
  const res = await client.execute({
    sql: `SELECT status, password_status, password_attempt_count, password_last_submitted_at
          FROM upload_file WHERE id = ?`,
    args: [id],
  })
  return res.rows[0]
}

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: appSchema })
  await client.execute(`
    CREATE TABLE upload_file (
      id text PRIMARY KEY,
      upload_session_id text NOT NULL,
      tenant_id text NOT NULL,
      storage_key text NOT NULL,
      status text NOT NULL DEFAULT 'uploaded',
      password_status text NOT NULL DEFAULT 'none',
      password_last_submitted_at text,
      password_attempt_count integer NOT NULL DEFAULT 0
    )
  `)
  await client.execute(`
    CREATE TABLE upload_session (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      status text NOT NULL
    )
  `)
})

beforeEach(async () => {
  await client.execute(`DELETE FROM upload_file`)
  await client.execute(`DELETE FROM upload_session`)
  getMock.mockReset()
  tryDecryptExcelMock.mockReset()
  getMock.mockResolvedValue(validBlobResponse())
})

const { submitFilePassword } = await import('@/lib/upload/file-password')

describe('submitFilePassword - 성공(consumed)', () => {
  it('복호화 성공 시 consumed 상태로 전환하고 overrideBuffer를 반환한다', async () => {
    await seedFile({ passwordStatus: 'required', status: 'needs_review', attemptCount: 0 })
    const decrypted = Buffer.from('plain-xlsx')
    tryDecryptExcelMock.mockResolvedValue({ ok: true, buffer: decrypted })

    const result = await submitFilePassword({
      fileId: 'file-1',
      tenantId: 'tenant-1',
      password: 'correct-pass',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.status).toBe('consumed')
      expect(result.overrideBuffer.byteLength).toBe(decrypted.byteLength)
    }

    const row = await readFile('file-1')
    expect(row.status).toBe('uploaded')
    expect(row.password_status).toBe('consumed')
    expect(Number(row.password_attempt_count)).toBe(1)
    expect(row.password_last_submitted_at).not.toBeNull()
  })
})

describe('submitFilePassword - 실패(invalid)', () => {
  it('복호화 실패 시 invalid로 기록하고 시도 횟수를 증가시킨다', async () => {
    await seedFile({ passwordStatus: 'required', status: 'needs_review', attemptCount: 2 })
    tryDecryptExcelMock.mockResolvedValue({ ok: false, reason: 'password_invalid' })

    const result = await submitFilePassword({
      fileId: 'file-1',
      tenantId: 'tenant-1',
      password: 'wrong',
    })

    expect(result).toMatchObject({ ok: false, status: 'invalid', reason: 'password_invalid', attemptCount: 3 })

    const row = await readFile('file-1')
    expect(row.password_status).toBe('invalid')
    // 실패는 분석 재실행 대상이 아니므로 status는 그대로 둔다.
    expect(row.status).toBe('needs_review')
    expect(Number(row.password_attempt_count)).toBe(3)
  })

  it('직전 invalid 상태에서 재시도(올바른 비밀번호)도 받아들인다', async () => {
    await seedFile({ passwordStatus: 'invalid', status: 'needs_review', attemptCount: 1 })
    tryDecryptExcelMock.mockResolvedValue({ ok: true, buffer: Buffer.from('plain') })

    const result = await submitFilePassword({ fileId: 'file-1', tenantId: 'tenant-1', password: 'ok' })

    expect(result.ok).toBe(true)
    const row = await readFile('file-1')
    expect(row.password_status).toBe('consumed')
  })
})

describe('submitFilePassword - 거부(rejected)', () => {
  it('비밀번호 대상이 아닌 파일(none)은 복호화 시도 없이 거부한다', async () => {
    await seedFile({ passwordStatus: 'none', status: 'matched' })

    const result = await submitFilePassword({ fileId: 'file-1', tenantId: 'tenant-1', password: 'x' })

    expect(result).toMatchObject({ ok: false, status: 'rejected', reason: 'not_password_protected' })
    expect(tryDecryptExcelMock).not.toHaveBeenCalled()
    expect(getMock).not.toHaveBeenCalled()
  })

  it('이미 consumed된 파일은 거부한다', async () => {
    await seedFile({ passwordStatus: 'consumed', status: 'matched' })

    const result = await submitFilePassword({ fileId: 'file-1', tenantId: 'tenant-1', password: 'x' })

    expect(result).toMatchObject({ ok: false, status: 'rejected', reason: 'not_password_protected' })
  })

  it('다른 테넌트의 파일은 file_not_found로 처리한다', async () => {
    await seedFile({ tenantId: 'tenant-1', passwordStatus: 'required' })

    const result = await submitFilePassword({ fileId: 'file-1', tenantId: 'tenant-OTHER', password: 'x' })

    expect(result).toMatchObject({ ok: false, status: 'rejected', reason: 'file_not_found' })
  })

  it('expectedSessionId가 다르면 file_not_found로 처리한다(존재 노출 차단)', async () => {
    await seedFile({ sessionId: 'session-1', passwordStatus: 'required' })

    const result = await submitFilePassword({
      fileId: 'file-1',
      tenantId: 'tenant-1',
      password: 'x',
      expectedSessionId: 'session-OTHER',
    })

    expect(result).toMatchObject({ ok: false, status: 'rejected', reason: 'file_not_found' })
    expect(tryDecryptExcelMock).not.toHaveBeenCalled()
  })

  it('requireMutableSession에서 세션이 잠겨 있으면 session_locked로 처리한다', async () => {
    await seedFile({ sessionId: 'session-1', passwordStatus: 'required' })
    await seedSession('session-1', 'tenant-1', 'completed')

    const result = await submitFilePassword({
      fileId: 'file-1',
      tenantId: 'tenant-1',
      password: 'x',
      expectedSessionId: 'session-1',
      requireMutableSession: true,
    })

    expect(result).toMatchObject({ ok: false, status: 'rejected', reason: 'session_locked' })
    expect(tryDecryptExcelMock).not.toHaveBeenCalled()
  })
})

describe('submitFilePassword - 비밀번호 비노출', () => {
  it('어떤 반환 결과에도 비밀번호 값이 포함되지 않는다', async () => {
    await seedFile({ passwordStatus: 'required' })
    tryDecryptExcelMock.mockResolvedValue({ ok: false, reason: 'password_invalid' })

    const secret = 'top-secret-password'
    const result = await submitFilePassword({ fileId: 'file-1', tenantId: 'tenant-1', password: secret })

    expect(JSON.stringify(result)).not.toContain(secret)
    const row = await readFile('file-1')
    expect(JSON.stringify(row)).not.toContain(secret)
  })
})
