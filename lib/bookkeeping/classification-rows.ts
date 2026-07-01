type ClassifiableRow = {
  sourceType?: string | null
  transactionDate?: string | null
  merchantName?: string | null
  description?: string | null
  amountKrw?: number | null
}

const VALID_TRANSACTION_DATE = /^20\d{2}-\d{2}-\d{2}$/
const SUMMARY_ROW_PATTERN = /(합계|총계|소계|원화\s*합계|달러\s*합계|엔화\s*합계|total|subtotal|총\s*\d+\s*건)/i

export function isDisplayableClassificationRow(row: ClassifiableRow) {
  if (!row.transactionDate || !VALID_TRANSACTION_DATE.test(row.transactionDate)) return false

  const text = `${row.merchantName ?? ''} ${row.description ?? ''}`
  if (SUMMARY_ROW_PATTERN.test(text)) return false

  if (!row.amountKrw || row.amountKrw <= 0) {
    return ['receipt', 'tax_invoice', 'other'].includes(row.sourceType ?? '')
  }

  return true
}

export function attributedMonthFromTransactionDate(transactionDate: string | null) {
  if (!transactionDate || !VALID_TRANSACTION_DATE.test(transactionDate)) return ''
  return transactionDate.slice(0, 7)
}
