import { describe, expect, it } from 'vitest'
import {
  BILLING_PLANS,
  annualPriceLabel,
  formatKRW,
  getSuggestedBillingPlan,
  planLimitLabel,
} from './plans'

describe('billing plans', () => {
  it('uses flat monthly tier pricing by managed client cap', () => {
    expect(BILLING_PLANS.map((plan) => [plan.code, plan.maxClients, plan.monthlyPriceKrw])).toEqual([
      ['starter', 15, 33000],
      ['growth', 60, 99000],
      ['pro', 90, 148500],
      ['enterprise', null, null],
    ])
  })

  it('suggests 15, 60, 90, then enterprise tiers by managed client count', () => {
    expect(getSuggestedBillingPlan(1).code).toBe('starter')
    expect(getSuggestedBillingPlan(15).code).toBe('starter')
    expect(getSuggestedBillingPlan(16).code).toBe('growth')
    expect(getSuggestedBillingPlan(60).code).toBe('growth')
    expect(getSuggestedBillingPlan(61).code).toBe('pro')
    expect(getSuggestedBillingPlan(90).code).toBe('pro')
    expect(getSuggestedBillingPlan(91).code).toBe('enterprise')
  })

  it('formats billing labels for the flat tier policy', () => {
    expect(formatKRW(33000)).toBe('33,000원')
    expect(formatKRW(99000)).toBe('99,000원')
    expect(formatKRW(148500)).toBe('148,500원')
    expect(annualPriceLabel(33000)).toBe('316,800원/년')
    expect(annualPriceLabel(99000)).toBe('950,400원/년')
    expect(annualPriceLabel(148500)).toBe('1,425,600원/년')
    expect(planLimitLabel({ maxClients: null })).toBe('90개 초과')
  })
})
