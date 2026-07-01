import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { requireJaryoAdminEnv } from '@/lib/env'

export function normalizeJaryoAdminEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isJaryoAdminEmailAllowed(email: string | null | undefined, allowedEmails: string[]) {
  if (!email) return false
  return allowedEmails.includes(normalizeJaryoAdminEmail(email))
}

export async function requireJaryoAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect('/sign-in')
  }

  const { JARYO_ADMIN_EMAILS } = requireJaryoAdminEnv()

  if (!isJaryoAdminEmailAllowed(session.user.email, JARYO_ADMIN_EMAILS)) {
    notFound()
  }

  return {
    user: session.user,
    session: session.session,
  }
}

export type JaryoAdminSession = Awaited<ReturnType<typeof requireJaryoAdminSession>>
