// 서버 전용 가드: DB 클라이언트가 클라이언트 번들에 포함되면 빌드타임에 실패시킨다.
import 'server-only'
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
