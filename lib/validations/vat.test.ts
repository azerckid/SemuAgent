import { describe, expect, it } from 'vitest'
import { vatDeductionReviewPatchSchema, vatPeriodKeySchema } from './vat'

describe('VAT validation schemas', () => {
  it('requires a reason for non-deductible decisions and an explicit proration rate for prorated decisions', () => {
    expect(vatDeductionReviewPatchSchema.safeParse({ decision: 'deductible' }).success).toBe(true)
    expect(vatDeductionReviewPatchSchema.safeParse({ decision: 'non_deductible' }).success).toBe(false)
    expect(vatDeductionReviewPatchSchema.safeParse({
      decision: 'non_deductible',
      reason: '접대비 불공제',
    }).success).toBe(true)
    expect(vatDeductionReviewPatchSchema.safeParse({
      decision: 'prorated',
      prorationRateBps: 0,
    }).success).toBe(false)
    expect(vatDeductionReviewPatchSchema.safeParse({
      decision: 'prorated',
      prorationRateBps: 5_000,
    }).success).toBe(true)
  })

  it('accepts only VAT half-year period keys', () => {
    expect(vatPeriodKeySchema.safeParse('2026-H1').success).toBe(true)
    expect(vatPeriodKeySchema.safeParse('2026-H2').success).toBe(true)
    expect(vatPeriodKeySchema.safeParse('2026-01').success).toBe(false)
  })
})
