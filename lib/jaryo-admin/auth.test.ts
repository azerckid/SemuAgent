import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const redirectMock = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`)
})
const notFoundMock = vi.fn(() => {
  throw new Error('not-found')
})

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}))

const coreEnv = {
  TURSO_DATABASE_URL: 'libsql://test.local',
  TURSO_AUTH_TOKEN: 'test-token',
  BETTER_AUTH_SECRET: '12345678901234567890123456789012',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
}

async function importAuth() {
  vi.resetModules()
  return import('./auth')
}

describe('JARYO Admin auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(process.env, coreEnv)
    delete process.env.JARYO_ADMIN_EMAILS
  })

  it('normalizes and matches allowlisted emails case-insensitively', async () => {
    process.env.JARYO_ADMIN_EMAILS = ' Admin@Example.com, ops@example.com '
    const { requireJaryoAdminSession } = await importAuth()
    getSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'admin@example.com', name: 'Admin' },
      session: { id: 'session-1' },
    })

    await expect(requireJaryoAdminSession()).resolves.toMatchObject({
      user: { email: 'admin@example.com' },
      session: { id: 'session-1' },
    })
  })

  it('fails env validation when the allowlist is empty', async () => {
    process.env.JARYO_ADMIN_EMAILS = ' , '
    const { requireJaryoAdminSession } = await importAuth()
    getSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'admin@example.com', name: 'Admin' },
      session: { id: 'session-1' },
    })

    await expect(requireJaryoAdminSession()).rejects.toThrow('JARYO Admin env validation failed')
  })

  it('redirects unauthenticated users to sign-in', async () => {
    process.env.JARYO_ADMIN_EMAILS = 'admin@example.com'
    const { requireJaryoAdminSession } = await importAuth()
    getSessionMock.mockResolvedValue(null)

    await expect(requireJaryoAdminSession()).rejects.toThrow('redirect:/sign-in')
    expect(redirectMock).toHaveBeenCalledWith('/sign-in')
  })

  it('hides the admin route from authenticated users outside the allowlist', async () => {
    process.env.JARYO_ADMIN_EMAILS = 'admin@example.com'
    const { requireJaryoAdminSession } = await importAuth()
    getSessionMock.mockResolvedValue({
      user: { id: 'user-2', email: 'tenant-admin@example.com', name: 'Tenant Admin' },
      session: { id: 'session-2', activeOrganizationId: 'tenant-1' },
    })

    await expect(requireJaryoAdminSession()).rejects.toThrow('not-found')
    expect(notFoundMock).toHaveBeenCalled()
  })

  it('keeps the pure allowlist helper strict for missing email values', async () => {
    const { isJaryoAdminEmailAllowed } = await importAuth()

    expect(isJaryoAdminEmailAllowed(undefined, ['admin@example.com'])).toBe(false)
    expect(isJaryoAdminEmailAllowed(null, ['admin@example.com'])).toBe(false)
    expect(isJaryoAdminEmailAllowed(' ADMIN@example.com ', ['admin@example.com'])).toBe(true)
  })
})
