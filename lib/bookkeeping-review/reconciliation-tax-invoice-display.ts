export type TaxInvoiceTradeDirection = 'income' | 'expense' | 'unknown'

export type TaxInvoiceAmountBreakdown = {
  supplyAmountKrw: number | null
  taxAmountKrw: number | null
  totalAmountKrw: number | null
}

export const TAX_INVOICE_LEDGER_TAX_TYPE_LABEL = '일반'

export function usesTaxInvoiceLedgerLayout(filter: string) {
  return filter === 'tax_invoice'
}

export function estimateTaxAmountKrwFromTotal(totalAmountKrw: number) {
  return Math.round(totalAmountKrw / 11)
}

export function resolveTaxInvoiceAmountBreakdown(input: {
  amountKrw: number | null
  taxAmountKrw?: number | null
  direction: TaxInvoiceTradeDirection
}): TaxInvoiceAmountBreakdown {
  if (input.amountKrw === null) {
    return { supplyAmountKrw: null, taxAmountKrw: null, totalAmountKrw: null }
  }

  const totalAmountKrw = input.amountKrw
  const taxAmountKrw = input.taxAmountKrw ?? estimateTaxAmountKrwFromTotal(totalAmountKrw)

  return {
    totalAmountKrw,
    taxAmountKrw,
    supplyAmountKrw: Math.max(0, totalAmountKrw - taxAmountKrw),
  }
}

export function taxInvoiceTradeTypeLabel(direction: TaxInvoiceTradeDirection) {
  if (direction === 'income') return '매출'
  if (direction === 'expense') return '매입'
  return '미정'
}
