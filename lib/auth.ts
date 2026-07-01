import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { db } from '@/lib/db'
import { env } from '@/lib/env'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      // owner   → TENANT_ADMIN (계정 생성자, 전체 권한)
      // member  → STAFF (일반 담당자)
      // admin   → (미사용, 필요 시 v2에서 확장)
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
export type ActiveOrganization = typeof auth.$Infer.ActiveOrganization
