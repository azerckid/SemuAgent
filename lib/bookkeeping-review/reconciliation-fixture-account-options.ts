import { BOOKKEEPING_ACCOUNT_CATEGORIES, type BookkeepingAccountCategoryKey } from '@/lib/bookkeeping/account-categories'

export type ReconciliationAccountOption = {
  key: BookkeepingAccountCategoryKey
  label: string
}

export type ReconciliationFixtureAccountGroup = {
  label: string
  accounts: ReconciliationAccountOption[]
}

const CATEGORY_BY_KEY = new Map(BOOKKEEPING_ACCOUNT_CATEGORIES.map((category) => [category.key, category]))

function accountOptions(...keys: BookkeepingAccountCategoryKey[]): ReconciliationAccountOption[] {
  return keys.map((key) => {
    const category = CATEGORY_BY_KEY.get(key)
    if (!category) {
      throw new Error(`Unknown bookkeeping account category key: ${key}`)
    }
    return { key: category.key, label: category.label }
  })
}

export const RECONCILIATION_FIXTURE_ACCOUNT_GROUPS: ReconciliationFixtureAccountGroup[] = [
  {
    label: '매출',
    accounts: accountOptions('sales'),
  },
  {
    label: '비용',
    accounts: accountOptions(
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
    ),
  },
  {
    label: '영업외수익',
    accounts: accountOptions('interest_income'),
  },
  {
    label: '기타',
    accounts: accountOptions('card_payment'),
  },
]

export function filterReconciliationFixtureAccountGroups(query: string): ReconciliationFixtureAccountGroup[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return RECONCILIATION_FIXTURE_ACCOUNT_GROUPS
  }

  return RECONCILIATION_FIXTURE_ACCOUNT_GROUPS.map((group) => ({
    ...group,
    accounts: group.accounts.filter((account) => account.label.toLowerCase().includes(normalized)),
  })).filter((group) => group.accounts.length > 0)
}
