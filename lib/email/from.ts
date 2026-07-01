import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenant } from '@/lib/db/schema'

const EMAIL_ADDRESS_IN_BRACKETS = /<([^<>]+)>/
const UNSAFE_DISPLAY_NAME_CHARS = /[\r\n<>"]/g

export function sanitizeDisplayName(name: string | null | undefined): string {
  return (name ?? '').replace(UNSAFE_DISPLAY_NAME_CHARS, '').trim()
}

export function extractEmailAddress(from: string): string {
  const trimmed = from.trim()
  const bracketMatch = trimmed.match(EMAIL_ADDRESS_IN_BRACKETS)
  return bracketMatch?.[1]?.trim() || trimmed
}

export function formatEmailFrom(baseFrom: string, displayName: string | null | undefined): string {
  const safeName = sanitizeDisplayName(displayName)
  if (!safeName) return baseFrom
  return `${safeName} <${extractEmailAddress(baseFrom)}>`
}

export async function getTenantEmailFrom(tenantId: string, baseFrom: string): Promise<string> {
  const rows = await db
    .select({ name: tenant.name })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)

  return formatEmailFrom(baseFrom, rows[0]?.name)
}
