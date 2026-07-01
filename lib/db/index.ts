import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { env } from '../env'
import * as appSchema from './schema'
import * as authSchema from './auth-schema'

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
})

export const db = drizzle(client, { schema: { ...appSchema, ...authSchema } })
export type DB = typeof db

// Re-export schemas for convenience
export { appSchema, authSchema }

/**
 * Tenant-scoped query helper.
 * All queries using this must include WHERE tenant_id = tenantId.
 */
export function dbForTenant(tenantId: string) {
  return { db, tenantId }
}
