function normalizeText(value: string | null | undefined) {
  return (value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function buildJournalEntryWorkbookSource(parts: {
  detectedFileType?: string | null
  explanation?: string | null
  riskFlags?: string[]
  originalFilename?: string | null
}) {
  return normalizeText([
    parts.detectedFileType,
    parts.explanation,
    parts.riskFlags?.join(' '),
    parts.originalFilename,
  ].join('\n'))
}

export function looksLikeJournalEntryWorkbook(source: string) {
  const normalized = normalizeText(source)

  if (
    /(기업은행|우리은행|은행|통장|거래내역|bank statement)/i.test(normalized) &&
    !/(지출\s*결의|입출금\s*장부|전표\s*정리|전표\s*입출금)/i.test(normalized)
  ) {
    return false
  }

  const hasInflow = /(입금|입출금|수입)/i.test(normalized)
  const hasOutflow = /(출금|지출|차용|대여|급여)/i.test(normalized)
  const ledgerStructure = /(적요|잔액|입출금|차변|대변|transaction\s*ledger|cash\s*flow)/i.test(normalized)
  const workbookLabel = /(지출\s*결의|입출금\s*정리|전표\s*정리|전표\s*입출금|전표\s*작성)/i.test(normalized)
  const summaryOnly = /(월별\s*지출\s*집계|지출\s*금액\s*합계만|요약표|summary)/i.test(normalized)

  if (summaryOnly) return false

  return hasInflow && hasOutflow && (ledgerStructure || workbookLabel)
}
