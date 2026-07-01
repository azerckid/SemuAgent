import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function requireSession() {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

/**
 * Requires an authenticated session with an active organization (= tenant).
 *
 * activeOrganizationId is null by default after login.
 * It must be set via organization.setActive() on the client after sign-in.
 * Use this guard in all admin routes that need tenant-scoped data.
 */
export async function requireTenantSession() {
  const session = await requireSession()
  const tenantId = session.session.activeOrganizationId
  if (!tenantId) {
    throw new Error(
      'No active tenant — user must select or create an organization before accessing this resource',
    )
  }
  return {
    user: session.user,
    session: session.session,
    tenantId,
  }
}

export type TenantSession = Awaited<ReturnType<typeof requireTenantSession>>
