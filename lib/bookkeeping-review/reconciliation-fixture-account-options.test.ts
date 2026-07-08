import { describe, expect, it } from 'vitest'
import { BOOKKEEPING_ACCOUNT_CATEGORIES } from '@/lib/bookkeeping/account-categories'
import {
  filterReconciliationFixtureAccountGroups,
  RECONCILIATION_FIXTURE_ACCOUNT_GROUPS,
} from './reconciliation-fixture-account-options'

describe('RECONCILIATION_FIXTURE_ACCOUNT_GROUPS', () => {
  it('covers every real bookkeeping account category key exactly once, except unclassified, with no invented labels', () => {
    const allKeys = RECONCILIATION_FIXTURE_ACCOUNT_GROUPS.flatMap((group) => group.accounts.map((account) => account.key))
    const realKeys = BOOKKEEPING_ACCOUNT_CATEGORIES
      .map((category) => category.key)
      .filter((key) => key !== 'unclassified')

    expect(new Set(allKeys).size).toBe(allKeys.length)
    expect([...allKeys].sort()).toEqual([...realKeys].sort())
  })

  it('excludes unclassified, matching the existing classification queue picker', () => {
    const allKeys = RECONCILIATION_FIXTURE_ACCOUNT_GROUPS.flatMap((group) => group.accounts.map((account) => account.key))
    expect(allKeys).not.toContain('unclassified')
  })

  it('pairs each key with its real label', () => {
    const labelByKey = new Map(BOOKKEEPING_ACCOUNT_CATEGORIES.map((category) => [category.key, category.label]))
    for (const group of RECONCILIATION_FIXTURE_ACCOUNT_GROUPS) {
      for (const account of group.accounts) {
        expect(account.label).toBe(labelByKey.get(account.key))
      }
    }
  })
})

describe('filterReconciliationFixtureAccountGroups', () => {
  it('filters accounts by label substring', () => {
    const filtered = filterReconciliationFixtureAccountGroups('복리후생비')
    const allAccounts = filtered.flatMap((group) => group.accounts)
    expect(allAccounts).toHaveLength(1)
    expect(allAccounts[0]).toEqual({ key: 'employee_welfare', label: '복리후생비' })
  })

  it('returns every group unfiltered for an empty query', () => {
    expect(filterReconciliationFixtureAccountGroups('')).toEqual(RECONCILIATION_FIXTURE_ACCOUNT_GROUPS)
  })

  it('excludes groups with no matching accounts', () => {
    const filtered = filterReconciliationFixtureAccountGroups('존재하지-않는-계정명')
    expect(filtered).toEqual([])
  })
})
