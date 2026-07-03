// 서버 전용 가드: 클라이언트 컴포넌트가 이 모듈(=서버 시크릿 검증)을 번들에 끌어들이면
// 빌드타임에 실패시킨다. 브라우저 번들 누수 → "Missing required environment variables" 크래시 재발 방지.
import 'server-only'
import { z } from 'zod'
import { isGeminiEnabled } from '@/lib/ai/gemini-enabled'
import { normalizeGeminiAnalysisModel } from '@/lib/ai/models'

// ---------------------------------------------------------------------------
// Core — always required. Validated eagerly at module load.
// ---------------------------------------------------------------------------
const coreSchema = z.object({
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  // 검색엔진 소유 확인 메타 태그 값(공개·비밀 아님). 미설정 시 태그를 출력하지 않는다.
  GOOGLE_SITE_VERIFICATION: z.string().min(1).optional(),
  NAVER_SITE_VERIFICATION: z.string().min(1).optional(),
})

const coreResult = coreSchema.safeParse(process.env)
if (!coreResult.success) {
  const missing = coreResult.error.issues.map((i) => i.path.join('.')).join(', ')
  console.error('❌ Missing required environment variables:', coreResult.error.issues)
  throw new Error(`Missing required environment variables: ${missing}`)
}

export const env = coreResult.data
export type Env = typeof env

// ---------------------------------------------------------------------------
// Feature env schemas — each validated independently at call time.
// This lets you get precise error messages (missing vs. malformed).
// ---------------------------------------------------------------------------

const emailSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
})

const aiSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  GOOGLE_AI_API_KEY: z.string().min(1).optional(),
  GEMINI_ANALYSIS_MODEL: z.preprocess(
    (value) => normalizeGeminiAnalysisModel(typeof value === 'string' ? value : undefined),
    z.string().min(1),
  ).optional(),
  ANALYSIS_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),
}).superRefine((data, ctx) => {
  if (!isGeminiEnabled()) return
  if (!data.GOOGLE_AI_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['GOOGLE_AI_API_KEY'],
      message: 'GEMINI_ENABLED=true일 때 GOOGLE_AI_API_KEY가 필요합니다',
    })
  }
})

const anthropicSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
})

const openAiSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
})

const googleAiSchema = z.object({
  GOOGLE_AI_API_KEY: z.string().min(1),
  GEMINI_ANALYSIS_MODEL: z.preprocess(
    (value) => normalizeGeminiAnalysisModel(typeof value === 'string' ? value : undefined),
    z.string().min(1),
  ),
})

const blobSchema = z.object({
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
})

const chainSchema = z.object({
  GIWA_CHAIN_RPC_URL: z.url(),
  GIWA_CHAIN_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, '0x + 64 hex chars 형식이어야 합니다'),
  GIWA_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, '0x + 40 hex chars 형식이어야 합니다'),
  GIWA_SERVER_SALT: z.string().min(16, '16자 이상이어야 합니다'),
})

const envBooleanSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value
    return value.trim().toLowerCase()
  },
  z
    .enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])
    .optional()
    .transform((value) => value === 'true' || value === '1' || value === 'yes' || value === 'on'),
)

const tossBillingFlagSchema = z.object({
  TOSS_BILLING_ENABLED: envBooleanSchema,
  TOSS_BILLING_AUTO_CHARGE_ENABLED: envBooleanSchema,
})

const tossBillingSchema = tossBillingFlagSchema.extend({
  TOSS_CLIENT_KEY: z.string().min(1),
  TOSS_SECRET_KEY: z.string().min(1),
})

const tossWebhookSecretSchema = z.object({
  TOSS_WEBHOOK_SECRET: z.string().min(16).optional(),
})

const resendInboundWebhookSchema = z.object({
  // Resend(Svix) inbound webhook signing secret. Optional until webhook 등록.
  RESEND_INBOUND_WEBHOOK_SECRET: z.string().min(1).optional(),
})

const lawOpenApiSchema = z.object({
  LAW_OPEN_API_OC: z.string().min(1),
})

const jaryoAdminSchema = z.object({
  JARYO_ADMIN_EMAILS: z
    .string()
    .min(1)
    .transform((value, ctx) => {
      const emails = value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)

      if (emails.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: '운영자 이메일 allowlist가 비어 있습니다',
        })
        return z.NEVER
      }

      for (const email of emails) {
        const emailCheck = z.email().safeParse(email)
        if (!emailCheck.success) {
          ctx.addIssue({
            code: 'custom',
            message: `유효하지 않은 운영자 이메일입니다: ${email}`,
          })
          return z.NEVER
        }
      }

      return emails
    }),
})

function parseFeatureEnv<T>(schema: z.ZodType<T>, label: string): T {
  const result = schema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`${label} env validation failed — ${issues}`)
  }
  return result.data
}

export function requireEmailEnv() {
  return parseFeatureEnv(emailSchema, 'Email (Resend)')
}

export function requireLawOpenApiEnv() {
  return parseFeatureEnv(lawOpenApiSchema, 'Law Open API')
}

export function requireJaryoAdminEnv() {
  return parseFeatureEnv(jaryoAdminSchema, 'JARYO Admin')
}

export function requireAiEnv() {
  return parseFeatureEnv(aiSchema, 'AI providers')
}

export function requireAnthropicEnv() {
  return parseFeatureEnv(anthropicSchema, 'Anthropic')
}

export function requireOpenAiEnv() {
  return parseFeatureEnv(openAiSchema, 'OpenAI')
}

export { isGeminiEnabled } from '@/lib/ai/gemini-enabled'

export function requireGoogleAiEnv() {
  if (!isGeminiEnabled()) {
    throw new Error('Google AI env validation failed — GEMINI_ENABLED is not true')
  }
  return parseFeatureEnv(googleAiSchema, 'Google AI')
}

export function requireBlobEnv() {
  return parseFeatureEnv(blobSchema, 'Vercel Blob')
}

export function requireChainEnv() {
  return parseFeatureEnv(chainSchema, 'Giwa Chain')
}

export function requireTossBillingEnv() {
  const flags = parseFeatureEnv(tossBillingFlagSchema, 'Toss Billing flags')
  if (!flags.TOSS_BILLING_ENABLED) {
    throw new Error('Toss Billing env validation failed — TOSS_BILLING_ENABLED is not true')
  }
  return parseFeatureEnv(tossBillingSchema, 'Toss Billing')
}

/** env가 없거나 placeholder이면 null 반환 — proof worker graceful skip용 */
export function getChainEnvOrNull() {
  const result = chainSchema.safeParse(process.env)
  return result.success ? result.data : null
}

/** Toss 결제 준비가 꺼져 있으면 null 반환 — Billing UI/API에서 graceful skip */
export function getTossBillingEnvOrNull() {
  const flags = parseFeatureEnv(tossBillingFlagSchema, 'Toss Billing flags')
  if (!flags.TOSS_BILLING_ENABLED) return null

  const result = tossBillingSchema.safeParse(process.env)
  return result.success ? result.data : null
}

/** Toss webhook endpoint shared secret. Optional until live webhook registration. */
export function getTossWebhookSecretOrNull() {
  if (process.env.TOSS_WEBHOOK_SECRET === undefined) return null
  return parseFeatureEnv(tossWebhookSecretSchema, 'Toss Webhook').TOSS_WEBHOOK_SECRET ?? null
}

/** Resend inbound webhook signing secret. Optional until webhook 등록. */
export function getResendInboundWebhookSecretOrNull() {
  if (process.env.RESEND_INBOUND_WEBHOOK_SECRET === undefined) return null
  return (
    parseFeatureEnv(resendInboundWebhookSchema, 'Resend Inbound Webhook')
      .RESEND_INBOUND_WEBHOOK_SECRET ?? null
  )
}

// PUBLIC_UPLOAD_BASE_URL: optional URL — 설정 시 Zod로 형식 검증
const uploadBaseUrlRaw = process.env.PUBLIC_UPLOAD_BASE_URL
if (uploadBaseUrlRaw !== undefined) {
  const urlCheck = z.url().safeParse(uploadBaseUrlRaw)
  if (!urlCheck.success) {
    throw new Error(`PUBLIC_UPLOAD_BASE_URL이 유효한 URL 형식이 아닙니다: "${uploadBaseUrlRaw}"`)
  }
}

/**
 * 고객용 업로드 링크 base URL을 반환한다.
 *
 * 우선순위: PUBLIC_UPLOAD_BASE_URL > NEXT_PUBLIC_APP_URL
 * - trailing slash를 제거한다.
 * - localhost/127.0.0.1 + RESEND_API_KEY → throw (실제 발송 경로 차단)
 * - Vercel Preview 환경 (VERCEL_ENV=preview) + PUBLIC_UPLOAD_BASE_URL 미설정 → throw
 *   (Preview 보호 URL이 고객 메일에 들어가는 것을 차단)
 * - RESEND_API_KEY 없는 개발 환경에서 localhost는 경고만 출력하고 허용
 */
export function getUploadBaseUrl(): string {
  const isPreview = process.env.VERCEL_ENV === 'preview'
  const hasExplicitBase = !!process.env.PUBLIC_UPLOAD_BASE_URL
  const hasResend = !!process.env.RESEND_API_KEY

  // Preview 환경에서 PUBLIC_UPLOAD_BASE_URL 미설정: Preview 보호 URL fallback 차단
  if (isPreview && !hasExplicitBase) {
    throw new Error(
      'Vercel Preview 환경에서 PUBLIC_UPLOAD_BASE_URL이 설정되지 않았습니다. ' +
      'Preview 보호 URL이 고객 메일 링크로 사용되면 Vercel 로그인 화면이 노출됩니다. ' +
      'PUBLIC_UPLOAD_BASE_URL=https://company.jaaryo.online 을 설정하세요.',
    )
  }

  const raw = process.env.PUBLIC_UPLOAD_BASE_URL ?? env.NEXT_PUBLIC_APP_URL
  const url = raw.replace(/\/$/, '')

  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)
  if (isLocalhost) {
    if (hasResend) {
      throw new Error(
        'PUBLIC_UPLOAD_BASE_URL이 설정되지 않았거나 localhost를 가리킵니다. ' +
        '실제 이메일 발송 경로에서는 공개 도메인이 필요합니다. ' +
        'PUBLIC_UPLOAD_BASE_URL=https://company.jaaryo.online 을 설정하세요.',
      )
    }
    console.warn(
      '[getUploadBaseUrl] 경고: localhost URL이 업로드 링크에 사용됩니다. ' +
      '실제 메일 발송 시 수신자가 열 수 없습니다.',
    )
  }

  return url
}
