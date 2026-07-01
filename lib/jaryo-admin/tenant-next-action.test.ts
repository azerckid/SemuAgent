import { describe, expect, it } from 'vitest'
import { deriveTenantNextAction } from './tenant-next-action'

describe('deriveTenantNextAction', () => {
  it('asks for billing info before anything else when the profile is missing', () => {
    expect(deriveTenantNextAction({ subscriptionStatus: 'active', hasBillingProfile: false })).toBe('청구정보 요청')
    expect(deriveTenantNextAction({ subscriptionStatus: 'past_due', hasBillingProfile: false })).toBe('청구정보 요청')
  })

  it('maps each subscription status once the billing profile is complete', () => {
    expect(deriveTenantNextAction({ subscriptionStatus: 'past_due', hasBillingProfile: true })).toBe('결제 실패 follow-up')
    expect(deriveTenantNextAction({ subscriptionStatus: 'manual_pilot', hasBillingProfile: true })).toBe('수동 invoice 확인')
    expect(deriveTenantNextAction({ subscriptionStatus: 'pending_payment', hasBillingProfile: true })).toBe('결제 수단 등록 대기')
    expect(deriveTenantNextAction({ subscriptionStatus: 'canceled', hasBillingProfile: true })).toBe('해지 후속 확인')
    expect(deriveTenantNextAction({ subscriptionStatus: 'active', hasBillingProfile: true })).toBe('정상 운영')
  })

  it('falls back to a safe label when there is no subscription row at all', () => {
    expect(deriveTenantNextAction({ subscriptionStatus: null, hasBillingProfile: true })).toBe('구독 상태 확인')
  })
})
