import { describe, expect, it } from 'vitest'
import {
  BOOKKEEPING_ACCOUNT_CATEGORIES,
  isBookkeepingAccountCategoryKey,
  labelForBookkeepingAccountCategory,
} from './account-categories'

describe('bookkeeping account categories', () => {
  it('keeps stable built-in category keys', () => {
    expect(BOOKKEEPING_ACCOUNT_CATEGORIES.map((category) => category.key)).toEqual([
      'sales',
      'purchase_goods',
      'fees',
      'supplies',
      'communication',
      'domain_hosting',
      'travel_transport',
      'shipping',
      'vehicle',
      'entertainment',
      'employee_welfare',
      'advertising',
      'rent',
      'utilities',
      'insurance',
      'taxes_dues',
      'payroll_related',
      'interest_income',
      'card_payment',
      'unclassified',
    ])
  })

  it('validates and labels category keys', () => {
    expect(isBookkeepingAccountCategoryKey('fees')).toBe(true)
    expect(isBookkeepingAccountCategoryKey('unknown_key')).toBe(false)
    expect(labelForBookkeepingAccountCategory('fees')).toBe('지급수수료')
  })
})
