import { describe, expect, it } from 'vitest'
import {
  resolveTaxInvoiceAmountBreakdown,
  taxInvoiceTradeTypeLabel,
  usesTaxInvoiceLedgerLayout,
} from './reconciliation-tax-invoice-display'

describe('reconciliation tax invoice display', () => {
  it('detects tax invoice tab layout', () => {
    expect(usesTaxInvoiceLedgerLayout('tax_invoice')).toBe(true)
    expect(usesTaxInvoiceLedgerLayout('card')).toBe(false)
  })

  it('splits total into supply and tax for purchase rows', () => {
    expect(resolveTaxInvoiceAmountBreakdown({
      amountKrw: 416_207,
      taxAmountKrw: 37_837,
      direction: 'expense',
    })).toEqual({
      totalAmountKrw: 416_207,
      taxAmountKrw: 37_837,
      supplyAmountKrw: 378_370,
    })
  })

  it('keeps total amount for bank and card matching', () => {
    const breakdown = resolveTaxInvoiceAmountBreakdown({
      amountKrw: 416_207,
      taxAmountKrw: 37_837,
      direction: 'expense',
    })

    expect(breakdown.totalAmountKrw).toBe(416_207)
  })

  it('labels trade direction for display', () => {
    expect(taxInvoiceTradeTypeLabel('expense')).toBe('매입')
    expect(taxInvoiceTradeTypeLabel('income')).toBe('매출')
  })

  it('estimates tax as total/11 for both income and expense when taxAmountKrw is missing', () => {
    const expenseBreakdown = resolveTaxInvoiceAmountBreakdown({
      amountKrw: 110_000,
      direction: 'expense',
    })
    expect(expenseBreakdown.taxAmountKrw).toBe(10_000)
    expect(expenseBreakdown.supplyAmountKrw).toBe(100_000)

    const incomeBreakdown = resolveTaxInvoiceAmountBreakdown({
      amountKrw: 110_000,
      direction: 'income',
    })
    expect(incomeBreakdown.taxAmountKrw).toBe(10_000)
    expect(incomeBreakdown.supplyAmountKrw).toBe(100_000)
  })

  it('returns null breakdown when amountKrw is null regardless of direction', () => {
    expect(resolveTaxInvoiceAmountBreakdown({ amountKrw: null, direction: 'income' })).toEqual({
      supplyAmountKrw: null,
      taxAmountKrw: null,
      totalAmountKrw: null,
    })
  })
})
