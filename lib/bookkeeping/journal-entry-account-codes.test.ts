import { describe, expect, it } from 'vitest'
import {
  JOURNAL_ENTRY_ACCOUNT_CODE_BY_NAME,
  lookupJournalEntryAccountCode,
} from './journal-entry-account-codes'

describe('journal entry account codes', () => {
  it('maps all 28 excel account names to codes with exact match only', () => {
    expect(Object.keys(JOURNAL_ENTRY_ACCOUNT_CODE_BY_NAME)).toHaveLength(28)
    expect(lookupJournalEntryAccountCode('보통예금')).toBe('103')
    expect(lookupJournalEntryAccountCode('외상매출금')).toBe('108')
    expect(lookupJournalEntryAccountCode('부가세예수금')).toBe('255')
    expect(lookupJournalEntryAccountCode('상품매출')).toBe('401')
    expect(lookupJournalEntryAccountCode('지급수수료(판)')).toBe('831')
  })

  it('maps JARYO category display labels to the same codes as excel (판) accounts', () => {
    expect(lookupJournalEntryAccountCode('광고선전비')).toBe('833')
    expect(lookupJournalEntryAccountCode('지급수수료')).toBe('831')
    expect(lookupJournalEntryAccountCode('매출')).toBe('401')
  })

  it('returns empty string for unmapped or clearing account names', () => {
    expect(lookupJournalEntryAccountCode('보통예금/미수금 검토')).toBe('')
    expect(lookupJournalEntryAccountCode('보통예금/미지급금/카드미지급 검토')).toBe('')
    expect(lookupJournalEntryAccountCode('')).toBe('')
    expect(lookupJournalEntryAccountCode(null)).toBe('')
    expect(lookupJournalEntryAccountCode('존재하지않는계정')).toBe('')
  })

  it('does not trim-match partial account names', () => {
    expect(lookupJournalEntryAccountCode(' 보통예금 ')).toBe('103')
    expect(lookupJournalEntryAccountCode('보통예금 ')).toBe('103')
  })
})
