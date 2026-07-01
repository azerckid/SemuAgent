/**
 * Static account name → Code map from `전표 분개 예시_최종.xlsx`.
 * Exact name match only; unmapped accounts return an empty string.
 */
export const JOURNAL_ENTRY_ACCOUNT_CODE_BY_NAME = {
  '감가상각누계액': '209',
  '감가상각비(판)': '818',
  '광고선전비(판)': '833',
  '미지급금': '253',
  '미지급비용': '262',
  '보통예금': '103',
  '보험료(판)': '821',
  '복리후생비(판)': '811',
  '부가세대급금': '135',
  '부가세예수금': '255',
  '상품': '146',
  '상품매출': '401',
  '소모품비(판)': '830',
  '여비교통비(판)': '812',
  '예수금': '254',
  '외상매입금': '251',
  '외상매출금': '108',
  '이자비용': '931',
  '이자수익': '901',
  '잡이익': '930',
  '장기차입금': '293',
  '접대비(기업업무추진비)(판)': '813',
  '지급수수료(판)': '831',
  '지급임차료(판)': '819',
  '직원급여(판)': '802',
  '차량유지비(판)': '822',
  '통신비(판)': '814',
  '퇴직연금운용자산': '198',
} as const satisfies Record<string, string>

/**
 * JARYO account-categories display labels that differ from the excel account names
 * but map to the same Code. Not arbitrary codes — aliases of the 28 excel entries.
 */
export const JOURNAL_ENTRY_ACCOUNT_LABEL_ALIASES = {
  '매출': '401',
  '광고선전비': '833',
  '소모품비': '830',
  '통신비': '814',
  '여비교통비': '812',
  '차량유지비': '822',
  '접대비': '813',
  '복리후생비': '811',
  '지급임차료': '819',
  '보험료': '821',
  '지급수수료': '831',
} as const satisfies Record<string, string>

export type JournalEntryMappedAccountName = keyof typeof JOURNAL_ENTRY_ACCOUNT_CODE_BY_NAME

export function lookupJournalEntryAccountCode(accountName: string | null | undefined) {
  const normalized = accountName?.trim()
  if (!normalized) return ''

  return (
    JOURNAL_ENTRY_ACCOUNT_CODE_BY_NAME[normalized as JournalEntryMappedAccountName]
    ?? JOURNAL_ENTRY_ACCOUNT_LABEL_ALIASES[normalized as keyof typeof JOURNAL_ENTRY_ACCOUNT_LABEL_ALIASES]
    ?? ''
  )
}

export function resolveJournalEntryAccountCode(params: {
  accountName: string | null | undefined
  storedAccountCode?: string | null
}) {
  const stored = params.storedAccountCode?.trim()
  if (stored) return stored
  return lookupJournalEntryAccountCode(params.accountName)
}
