import { z } from 'zod'

const rateLimitConfigSchema = z.object({
  USAGE_HELP_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  USAGE_HELP_RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().min(1).default(60),
})

const rateLimitConfig = rateLimitConfigSchema.parse(process.env)

type RateLimitBucket = {
  timestamps: number[]
}

const buckets = new Map<string, RateLimitBucket>()

export class UsageHelpRateLimitError extends Error {
  readonly code = 'rate_limited' as const

  constructor() {
    super('Usage help LLM rate limit exceeded')
    this.name = 'UsageHelpRateLimitError'
  }
}

function buildRateLimitKey(tenantId: string, userId: string) {
  return `${tenantId}:${userId}`
}

function pruneBucket(bucket: RateLimitBucket, windowMs: number, now: number) {
  bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < windowMs)
}

export function getUsageHelpRateLimitConfig() {
  return {
    maxRequests: rateLimitConfig.USAGE_HELP_RATE_LIMIT_MAX,
    windowMs: rateLimitConfig.USAGE_HELP_RATE_LIMIT_WINDOW_SEC * 1000,
  }
}

export function assertAndConsumeUsageHelpLlmRateLimit(params: {
  tenantId: string
  userId: string
}) {
  const { maxRequests, windowMs } = getUsageHelpRateLimitConfig()
  const key = buildRateLimitKey(params.tenantId, params.userId)
  const now = Date.now()
  const bucket = buckets.get(key) ?? { timestamps: [] }

  pruneBucket(bucket, windowMs, now)

  if (bucket.timestamps.length >= maxRequests) {
    buckets.set(key, bucket)
    throw new UsageHelpRateLimitError()
  }

  bucket.timestamps.push(now)
  buckets.set(key, bucket)
}

export function resetUsageHelpRateLimitStoreForTests() {
  buckets.clear()
}
