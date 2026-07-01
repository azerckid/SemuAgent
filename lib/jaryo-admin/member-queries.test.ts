import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as appSchema from '@/lib/db/schema'
import * as authSchema from '@/lib/db/auth-schema'

let client: Client
let testDb: ReturnType<typeof drizzle>

vi.mock('@/lib/db', () => ({
  get db() {
    return testDb
  },
}))

beforeAll(async () => {
  client = createClient({ url: ':memory:' })
  testDb = drizzle(client, { schema: { ...appSchema, ...authSchema } })

  await client.execute(`
    CREATE TABLE user (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      email_verified integer NOT NULL DEFAULT 0,
      image text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE session (
      id text PRIMARY KEY,
      expires_at integer NOT NULL,
      token text NOT NULL UNIQUE,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      ip_address text,
      user_agent text,
      user_id text NOT NULL,
      active_organization_id text
    )
  `)
  await client.execute(`
    CREATE TABLE account (
      id text PRIMARY KEY,
      account_id text NOT NULL,
      provider_id text NOT NULL,
      user_id text NOT NULL,
      access_token text,
      refresh_token text,
      id_token text,
      access_token_expires_at integer,
      refresh_token_expires_at integer,
      scope text,
      password text,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE tenant (
      id text PRIMARY KEY,
      name text NOT NULL,
      subdomain text NOT NULL UNIQUE,
      plan text NOT NULL DEFAULT 'free',
      timezone text NOT NULL DEFAULT 'Asia/Seoul',
      created_at text NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE staff (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      user_id text NOT NULL,
      email text NOT NULL,
      name text NOT NULL,
      role text NOT NULL DEFAULT 'STAFF',
      phone text,
      active integer NOT NULL DEFAULT 1,
      created_at text NOT NULL
    )
  `)
})

beforeEach(async () => {
  await client.execute('DELETE FROM user')
  await client.execute('DELETE FROM session')
  await client.execute('DELETE FROM account')
  await client.execute('DELETE FROM tenant')
  await client.execute('DELETE FROM staff')
})

async function seedUser(params: { id: string; name: string; email: string; emailVerified?: boolean; createdAtMs: number }) {
  await client.execute({
    sql: 'INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [params.id, params.name, params.email, params.emailVerified ? 1 : 0, params.createdAtMs, params.createdAtMs],
  })
}

async function seedSession(params: { id: string; userId: string; updatedAtMs: number }) {
  await client.execute({
    sql: 'INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    args: [params.id, params.updatedAtMs + 86400000, params.id, params.updatedAtMs, params.updatedAtMs, params.userId],
  })
}

async function seedTenantAndStaff(params: { tenantId: string; tenantName: string; staffId: string; userId: string; role?: 'TENANT_ADMIN' | 'STAFF'; active?: boolean }) {
  await client.execute({
    sql: 'INSERT INTO tenant (id, name, subdomain, created_at) VALUES (?, ?, ?, ?)',
    args: [params.tenantId, params.tenantName, params.tenantId, '2026-01-01T00:00:00+09:00'],
  })
  await client.execute({
    sql: 'INSERT INTO staff (id, tenant_id, user_id, email, name, role, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [params.staffId, params.tenantId, params.userId, 'staff@example.com', '직원', params.role ?? 'STAFF', params.active === false ? 0 : 1, '2026-01-01T00:00:00+09:00'],
  })
}

describe('listJaryoAdminMembers', () => {
  it('searches by email case-insensitively', async () => {
    const { listJaryoAdminMembers } = await import('./member-queries')
    await seedUser({ id: 'u-1', name: '김철수', email: 'cheolsu@example.com', createdAtMs: 1735689600000 })
    await seedUser({ id: 'u-2', name: '이영희', email: 'younghee@example.com', createdAtMs: 1735689700000 })

    const result = await listJaryoAdminMembers({ q: 'CHEOLSU', page: 1 })

    expect(result.rows.map((r) => r.id)).toEqual(['u-1'])
  })

  it('paginates over distinct users, not staff membership rows', async () => {
    const { listJaryoAdminMembers, JARYO_ADMIN_MEMBER_PAGE_SIZE } = await import('./member-queries')
    await seedUser({ id: 'u-multi', name: '다중소속', email: 'multi@example.com', createdAtMs: 1735689600000 })
    await seedTenantAndStaff({ tenantId: 't-1', tenantName: '테넌트1', staffId: 's-1', userId: 'u-multi' })
    await seedTenantAndStaff({ tenantId: 't-2', tenantName: '테넌트2', staffId: 's-2', userId: 'u-multi' })
    await seedTenantAndStaff({ tenantId: 't-3', tenantName: '테넌트3', staffId: 's-3', userId: 'u-multi' })

    const result = await listJaryoAdminMembers({ page: 1 })

    expect(result.total).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].memberships).toHaveLength(3)
    expect(result.pageSize).toBe(JARYO_ADMIN_MEMBER_PAGE_SIZE)
  })

  it('lists every tenant membership with role and active state', async () => {
    const { listJaryoAdminMembers } = await import('./member-queries')
    await seedUser({ id: 'u-roles', name: '역할테스트', email: 'roles@example.com', createdAtMs: 1735689600000 })
    await seedTenantAndStaff({ tenantId: 't-admin', tenantName: '관리자테넌트', staffId: 's-admin', userId: 'u-roles', role: 'TENANT_ADMIN', active: true })
    await seedTenantAndStaff({ tenantId: 't-inactive', tenantName: '비활성테넌트', staffId: 's-inactive', userId: 'u-roles', role: 'STAFF', active: false })

    const result = await listJaryoAdminMembers({ page: 1 })
    const memberships = result.rows[0].memberships

    expect(memberships).toContainEqual({ tenantId: 't-admin', tenantName: '관리자테넌트', role: 'TENANT_ADMIN', active: true })
    expect(memberships).toContainEqual({ tenantId: 't-inactive', tenantName: '비활성테넌트', role: 'STAFF', active: false })
  })

  it('derives last login from the most recent session, and null when there are none', async () => {
    const { listJaryoAdminMembers } = await import('./member-queries')
    await seedUser({ id: 'u-logged-in', name: '로그인유저', email: 'login@example.com', createdAtMs: 1735689600000 })
    await seedUser({ id: 'u-never-logged-in', name: '미로그인유저', email: 'nologin@example.com', createdAtMs: 1735689600000 })
    await seedSession({ id: 'sess-1', userId: 'u-logged-in', updatedAtMs: 1736000000000 })
    await seedSession({ id: 'sess-2', userId: 'u-logged-in', updatedAtMs: 1736500000000 })

    const result = await listJaryoAdminMembers({ page: 1 })
    const loggedIn = result.rows.find((r) => r.id === 'u-logged-in')
    const neverLoggedIn = result.rows.find((r) => r.id === 'u-never-logged-in')

    expect(loggedIn?.lastLoginAt?.getTime()).toBe(1736500000000)
    expect(neverLoggedIn?.lastLoginAt).toBeNull()
  })

  it('never exposes account credentials or tokens in the returned shape', async () => {
    const { listJaryoAdminMembers } = await import('./member-queries')
    await seedUser({ id: 'u-secret', name: '시크릿유저', email: 'secret@example.com', createdAtMs: 1735689600000 })
    await client.execute({
      sql: 'INSERT INTO account (id, account_id, provider_id, user_id, password, access_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['acc-1', 'secret@example.com', 'credential', 'u-secret', 'bcrypt-hash-should-never-leak', 'oauth-token-should-never-leak', 1735689600000, 1735689600000],
    })

    const result = await listJaryoAdminMembers({ page: 1 })
    const keys = Object.keys(result.rows[0])

    for (const forbidden of ['password', 'accessToken', 'refreshToken', 'idToken']) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('returns an empty memberships array for a user with no tenant yet', async () => {
    const { listJaryoAdminMembers } = await import('./member-queries')
    await seedUser({ id: 'u-no-tenant', name: '미가입유저', email: 'notenant@example.com', createdAtMs: 1735689600000 })

    const result = await listJaryoAdminMembers({ page: 1 })

    expect(result.rows[0].memberships).toEqual([])
  })
})
