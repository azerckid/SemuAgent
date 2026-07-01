import { afterEach, describe, expect, it } from 'vitest'
import {
  assertAndConsumeUsageHelpLlmRateLimit,
  getUsageHelpRateLimitConfig,
  resetUsageHelpRateLimitStoreForTests,
  UsageHelpRateLimitError,
} from '@/lib/usage-help/rate-limit'

describe('usage help rate limit', () => {
  afterEach(() => {
    resetUsageHelpRateLimitStoreForTests()
  })

  it('allows requests up to the configured limit', () => {
    const { maxRequests } = getUsageHelpRateLimitConfig()
    const params = { tenantId: 'tenant-a', userId: 'user-a' }

    for (let index = 0; index < maxRequests; index += 1) {
      expect(() => assertAndConsumeUsageHelpLlmRateLimit(params)).not.toThrow()
    }
  })

  it('throws when the limit is exceeded for the same tenant and user', () => {
    const { maxRequests } = getUsageHelpRateLimitConfig()
    const params = { tenantId: 'tenant-a', userId: 'user-a' }

    for (let index = 0; index < maxRequests; index += 1) {
      assertAndConsumeUsageHelpLlmRateLimit(params)
    }

    expect(() => assertAndConsumeUsageHelpLlmRateLimit(params)).toThrow(UsageHelpRateLimitError)
  })

  it('tracks limits separately per tenant and user', () => {
    const { maxRequests } = getUsageHelpRateLimitConfig()

    for (let index = 0; index < maxRequests; index += 1) {
      assertAndConsumeUsageHelpLlmRateLimit({ tenantId: 'tenant-a', userId: 'user-a' })
    }

    expect(() =>
      assertAndConsumeUsageHelpLlmRateLimit({ tenantId: 'tenant-a', userId: 'user-b' }),
    ).not.toThrow()
  })
})
