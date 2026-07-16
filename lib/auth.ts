import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { db } from '@/lib/db'
import { env } from '@/lib/env'

// 로그인·가입 brute-force 방어용 rate limit 저장소.
// better-auth는 prod에서 rate limit을 기본 활성화하지만 저장소 기본값이 memory다.
// Vercel serverless/fluid는 인스턴스 간 memory를 공유하지 않아 분산 요청 방어가 약하다.
// prod는 RATE_LIMIT_STORAGE=database로 전환한다. 단, database 전환 전에 rateLimit 테이블
// 마이그레이션(0074)이 prod에 먼저 적용돼 있어야 한다 — 미적용 상태로 전환하면 인증 요청이
// 테이블 부재로 실패한다. 기본값 memory이므로 이 코드를 병합해도 prod 동작은 바뀌지 않는다.
const rateLimitStorage: 'memory' | 'database' =
  process.env.RATE_LIMIT_STORAGE === 'database' ? 'database' : 'memory'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  // CSRF: baseURL origin만 신뢰한다. 커스텀 도메인·preview URL을 인증에 쓰려면
  // 여기에 명시적으로 추가한다(암묵 확장 금지).
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
  emailAndPassword: {
    enabled: true,
  },
  rateLimit: {
    storage: rateLimitStorage,
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
