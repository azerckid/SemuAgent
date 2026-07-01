import { describe, expect, it } from 'vitest'
import { manualBillingUpdateSchema } from './manual-subscription-model'

describe('manual billing update schema', () => {
  it('accepts public fixed-price plans with manual invoice mode', () => {
    const parsed = manualBillingUpdateSchema.parse({
      planCode: 'starter',
      mode: 'manual_invoice',
    })

    expect(parsed).toEqual({ planCode: 'starter', mode: 'manual_invoice' })
  })

  it('accepts manual pilot mode', () => {
    expect(manualBillingUpdateSchema.parse({
      planCode: 'pro',
      mode: 'manual_pilot',
    }).mode).toBe('manual_pilot')
  })

  it('rejects enterprise for this manual status shortcut', () => {
    const result = manualBillingUpdateSchema.safeParse({
      planCode: 'enterprise',
      mode: 'manual_invoice',
    })

    expect(result.success).toBe(false)
  })
})
