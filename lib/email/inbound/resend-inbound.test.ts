import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'

let client: Client
let testDb: ReturnType<typeof drizzle>
let testDir: string

const verifyMock = vi.hoisted(() => vi.fn())
const receivingGetMock = vi.hoisted(() => vi.fn())
const attachmentGetMock = vi.hoisted(() => vi.fn())
const putMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

vi.mock('@/lib/env', () => ({
  requireEmailEnv: () => ({ RESEND_API_KEY: 'test-resend-key' }),
  requireBlobEnv: () => ({ BLOB_READ_WRITE_TOKEN: 'test-blob-token' }),
}))

vi.mock('@vercel/blob', () => ({
  put: putMock,
}))

vi.mock('resend', () => ({
  Resend: vi.fn(function Resend() {
    return {
      webhooks: { verify: verifyMock },
      emails: {
        receiving: {
          get: receivingGetMock,
          attachments: { get: attachmentGetMock },
        },
      },
    }
  }),
}))

const { handleResendInboundWebhook, ResendInboundVerificationError } = await import('./resend-inbound')

function receivedEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'email.received',
    data: {
      email_id: 'evt_123',
      created_at: '2026-06-18T07:00:00.000Z',
      from: 'client@example.com',
      to: ['kim@jaaryo.online'],
      cc: [],
      bcc: [],
      message_id: 'msg_1',
      subject: '5월 자료 보냅니다',
      attachments: [{ id: 'att_1', filename: '통장.pdf', size: 1024, content_type: 'application/pdf' }],
      ...overrides,
    },
  }
}

async function count(table: string) {
  const r = await client.execute(`SELECT COUNT(*) AS c FROM ${table}`)
  return Number(r.rows[0].c)
}

async function seedMailbox(address: string, state = 'active') {
  await client.execute({
    sql: `INSERT INTO staff_mailbox (id, tenant_id, current_staff_id, alias, address, state, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `mb_${address}`,
      'tenant-1',
      'staff-1',
      address.split('@')[0],
      address,
      state,
      '2026-06-18T00:00:00.000Z',
      '2026-06-18T00:00:00.000Z',
    ],
  })
}

beforeAll(async () => {
  testDir = mkdtempSync(join(tmpdir(), 'jaryo-inbound-email-'))
  client = createClient({ url: `file:${join(testDir, 'test.db')}` })
  testDb = drizzle(client, { schema: appSchema })
  await client.execute(`CREATE TABLE staff_mailbox (
    id text PRIMARY KEY, tenant_id text NOT NULL, current_staff_id text,
    alias text NOT NULL, address text NOT NULL, state text NOT NULL DEFAULT 'active',
    created_at text NOT NULL, updated_at text NOT NULL )`)
  await client.execute(`CREATE UNIQUE INDEX staff_mailbox_address_uidx ON staff_mailbox(address)`)
  await client.execute(`CREATE TABLE inbound_email (
    id text PRIMARY KEY, tenant_id text NOT NULL, staff_mailbox_id text NOT NULL,
    provider text NOT NULL, provider_message_id text NOT NULL, direction text NOT NULL DEFAULT 'inbound',
    from_email text, to_email text NOT NULL, cc_email text, subject text,
    text_body text, html_body text, received_at text, client_label_id text,
    processing_status text NOT NULL DEFAULT 'stored', raw_payload_hash text NOT NULL,
    created_at text NOT NULL, updated_at text NOT NULL )`)
  await client.execute(
    `CREATE UNIQUE INDEX inbound_email_provider_message_uidx ON inbound_email(provider, provider_message_id)`,
  )
  await client.execute(`CREATE TABLE inbound_email_attachment (
    id text PRIMARY KEY, tenant_id text NOT NULL, inbound_email_id text NOT NULL,
    provider_attachment_id text, original_filename text, content_type text, file_size integer,
    storage_key text, content_hash text, status text NOT NULL DEFAULT 'stored', created_at text NOT NULL )`)
})

afterAll(async () => {
  client?.close()
  if (testDir) rmSync(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await client.execute('DELETE FROM inbound_email_attachment')
  await client.execute('DELETE FROM inbound_email')
  await client.execute('DELETE FROM staff_mailbox')
  verifyMock.mockReset()
  receivingGetMock.mockReset()
  attachmentGetMock.mockReset()
  putMock.mockReset()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('stored-attachment')))
  receivingGetMock.mockResolvedValue({
    data: {
      object: 'email',
      id: 'evt_123',
      to: ['kim@jaaryo.online'],
      from: 'client@example.com',
      created_at: '2026-06-18T07:00:00.000Z',
      subject: '5월 자료 보냅니다',
      bcc: null,
      cc: null,
      reply_to: null,
      html: '<p>자료 보냅니다</p>',
      text: '자료 보냅니다',
      headers: null,
      message_id: 'msg_1',
      raw: null,
      attachments: [{ id: 'att_1', filename: '통장.pdf', size: 1024, content_type: 'application/pdf' }],
    },
    error: null,
    headers: null,
  })
  attachmentGetMock.mockResolvedValue({
    data: {
      object: 'attachment',
      id: 'att_1',
      filename: '통장.pdf',
      size: 1024,
      content_type: 'application/pdf',
      content_disposition: 'attachment',
      download_url: 'https://resend.example/att_1',
      expires_at: '2026-06-18T08:00:00.000Z',
    },
    error: null,
    headers: null,
  })
  putMock.mockResolvedValue({ url: 'https://blob.example/inbound/att_1' })
})

const HEADERS = new Headers({ 'svix-id': 'msg_abc', 'svix-signature': 'v1,xxx', 'svix-timestamp': '1' })

describe('handleResendInboundWebhook', () => {
  it('stores into the resolved staff mailbox with attachment metadata', async () => {
    await seedMailbox('kim@jaaryo.online', 'active')
    verifyMock.mockReturnValue(receivedEvent())

    const result = await handleResendInboundWebhook({ rawBody: '{"raw":true}', headers: HEADERS, webhookSecret: 's' })

    expect(result.status).toBe('stored')
    const row = (await client.execute('SELECT * FROM inbound_email')).rows[0]
    expect(row.staff_mailbox_id).toBe('mb_kim@jaaryo.online')
    expect(row.tenant_id).toBe('tenant-1')
    expect(row.from_email).toBe('client@example.com')
    expect(row.subject).toBe('5월 자료 보냅니다')
    expect(row.client_label_id).toBeNull() // 수동 라벨 — 자동 연결 없음
    expect(row.text_body).toBe('자료 보냅니다')
    expect(row.raw_payload_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await count('inbound_email_attachment')).toBe(1)
    const attachment = (await client.execute('SELECT * FROM inbound_email_attachment')).rows[0]
    expect(attachment.storage_key).toBe('https://blob.example/inbound/att_1')
    expect(attachment.content_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is idempotent on duplicate provider message id', async () => {
    await seedMailbox('kim@jaaryo.online')
    verifyMock.mockReturnValue(receivedEvent())

    const first = await handleResendInboundWebhook({ rawBody: 'a', headers: HEADERS, webhookSecret: 's' })
    const second = await handleResendInboundWebhook({ rawBody: 'a', headers: HEADERS, webhookSecret: 's' })

    expect(first.status).toBe('stored')
    expect(second.status).toBe('duplicate')
    expect(await count('inbound_email')).toBe(1)
    expect(await count('inbound_email_attachment')).toBe(1)
    expect(receivingGetMock).toHaveBeenCalledTimes(1)
  })

  it('holds mail and does not store executable attachments', async () => {
    await seedMailbox('kim@jaaryo.online')
    verifyMock.mockReturnValue(receivedEvent({
      attachments: [{ id: 'att_exe', filename: 'run.exe', size: 2048, content_type: 'application/x-msdownload' }],
    }))
    receivingGetMock.mockResolvedValue({
      data: {
        object: 'email',
        id: 'evt_123',
        to: ['kim@jaaryo.online'],
        from: 'client@example.com',
        created_at: '2026-06-18T07:00:00.000Z',
        subject: '실행 파일',
        bcc: null,
        cc: null,
        reply_to: null,
        html: null,
        text: '확인 바랍니다',
        headers: null,
        message_id: 'msg_1',
        raw: null,
        attachments: [{ id: 'att_exe', filename: 'run.exe', size: 2048, content_type: 'application/x-msdownload' }],
      },
      error: null,
      headers: null,
    })

    const result = await handleResendInboundWebhook({ rawBody: 'x', headers: HEADERS, webhookSecret: 's' })

    expect(result.status).toBe('held')
    const row = (await client.execute('SELECT processing_status FROM inbound_email')).rows[0]
    expect(row.processing_status).toBe('held')
    const attachment = (await client.execute('SELECT status, storage_key FROM inbound_email_attachment')).rows[0]
    expect(attachment.status).toBe('ignored')
    expect(attachment.storage_key).toBeNull()
    expect(putMock).not.toHaveBeenCalled()
  })

  it('ignores mail to an unknown address (no mailbox)', async () => {
    verifyMock.mockReturnValue(receivedEvent({ to: ['nobody@jaaryo.online'] }))

    const result = await handleResendInboundWebhook({ rawBody: 'x', headers: HEADERS, webhookSecret: 's' })

    expect(result).toEqual({ status: 'ignored', reason: 'no_mailbox' })
    expect(await count('inbound_email')).toBe(0)
  })

  it('holds mail for a paused mailbox', async () => {
    await seedMailbox('kim@jaaryo.online', 'paused')
    verifyMock.mockReturnValue(receivedEvent())

    const result = await handleResendInboundWebhook({ rawBody: 'x', headers: HEADERS, webhookSecret: 's' })

    expect(result.status).toBe('held')
    const row = (await client.execute('SELECT processing_status FROM inbound_email')).rows[0]
    expect(row.processing_status).toBe('held')
  })

  it('holds mail for a handoff_required mailbox (담당자 인계 대기 중에도 메일은 보존)', async () => {
    await seedMailbox('kim@jaaryo.online', 'handoff_required')
    verifyMock.mockReturnValue(receivedEvent())

    const result = await handleResendInboundWebhook({ rawBody: 'x', headers: HEADERS, webhookSecret: 's' })

    expect(result.status).toBe('held')
    const row = (await client.execute('SELECT processing_status FROM inbound_email')).rows[0]
    expect(row.processing_status).toBe('held')
  })

  it('ignores mail for a retired mailbox', async () => {
    await seedMailbox('kim@jaaryo.online', 'retired')
    verifyMock.mockReturnValue(receivedEvent())

    const result = await handleResendInboundWebhook({ rawBody: 'x', headers: HEADERS, webhookSecret: 's' })

    expect(result.status).toBe('ignored')
    expect(await count('inbound_email')).toBe(0)
  })

  it('ignores non-received events without storing', async () => {
    verifyMock.mockReturnValue({ type: 'email.delivered', data: { email_id: 'd1' } })

    const result = await handleResendInboundWebhook({ rawBody: 'x', headers: HEADERS, webhookSecret: 's' })

    expect(result).toEqual({ status: 'ignored', reason: 'event_type:email.delivered' })
    expect(await count('inbound_email')).toBe(0)
  })

  it('throws ResendInboundVerificationError when signature verification fails', async () => {
    verifyMock.mockImplementation(() => {
      throw new Error('bad signature')
    })

    await expect(
      handleResendInboundWebhook({ rawBody: 'x', headers: HEADERS, webhookSecret: 's' }),
    ).rejects.toBeInstanceOf(ResendInboundVerificationError)
  })

  it('rejects email.received payloads without a receiving address', async () => {
    verifyMock.mockReturnValue(receivedEvent({ to: [] }))

    await expect(
      handleResendInboundWebhook({ rawBody: 'x', headers: HEADERS, webhookSecret: 's' }),
    ).rejects.toThrow(/payload validation failed/)
    expect(await count('inbound_email')).toBe(0)
  })
})
