export const BOOKKEEPING_ACCOUNT_CATEGORIES = [
  { key: 'sales', label: '매출' },
  { key: 'purchase_goods', label: '상품매입 / 원재료비' },
  { key: 'fees', label: '지급수수료' },
  { key: 'supplies', label: '소모품비' },
  { key: 'communication', label: '통신비' },
  { key: 'domain_hosting', label: '도메인/호스팅비' },
  { key: 'travel_transport', label: '여비교통비' },
  { key: 'shipping', label: '운반비 / 배송비' },
  { key: 'vehicle', label: '차량유지비' },
  { key: 'entertainment', label: '접대비' },
  { key: 'employee_welfare', label: '복리후생비' },
  { key: 'advertising', label: '광고선전비' },
  { key: 'rent', label: '지급임차료' },
  { key: 'utilities', label: '수도광열비' },
  { key: 'insurance', label: '보험료' },
  { key: 'taxes_dues', label: '세금과공과' },
  { key: 'payroll_related', label: '인건비성 비용' },
  { key: 'interest_income', label: '이자수익' },
  { key: 'card_payment', label: '카드대금 정산' },
  { key: 'unclassified', label: '미분류' },
] as const

export type BookkeepingAccountCategoryKey = typeof BOOKKEEPING_ACCOUNT_CATEGORIES[number]['key']

const categoryKeySet = new Set<string>(BOOKKEEPING_ACCOUNT_CATEGORIES.map((category) => category.key))
const categoryLabelByKey = new Map<string, string>(
  BOOKKEEPING_ACCOUNT_CATEGORIES.map((category) => [category.key, category.label]),
)

export function isBookkeepingAccountCategoryKey(value: string | null | undefined): value is BookkeepingAccountCategoryKey {
  return typeof value === 'string' && categoryKeySet.has(value)
}

export function labelForBookkeepingAccountCategory(value: string | null | undefined) {
  if (!value) return ''
  return categoryLabelByKey.get(value) ?? value
}

export function formatBookkeepingCategoryNotes() {
  return BOOKKEEPING_ACCOUNT_CATEGORIES
    .map((category) => `- ${category.key}: ${category.label}`)
    .join('\n')
}
