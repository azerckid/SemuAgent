import { describe, expect, it } from 'vitest'
import {
  BANK_SAMPLE_DEFINITIONS,
  CARD_SAMPLE_DEFINITIONS,
  ORPHAN_TAX_INVOICE_DEFINITIONS,
  RECONCILIATION_BANK_MATCHED_COUNT,
  RECONCILIATION_BANK_SAMPLE_COUNT,
  RECONCILIATION_CARD_MATCHED_COUNT,
  RECONCILIATION_CARD_SAMPLE_COUNT,
  RECONCILIATION_MATCHED_PRIMARY_COUNT,
  RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT,
  RECONCILIATION_PRIMARY_SAMPLE_COUNT,
  RECONCILIATION_SAMPLE_MONTHS,
  RECONCILIATION_TAX_INVOICE_SAMPLE_COUNT,
} from './reconciliation-bank-sample-data'

describe('reconciliation sample generator', () => {
  it('creates 7 months of bank, card, and tax invoice definitions', () => {
    expect(RECONCILIATION_SAMPLE_MONTHS).toHaveLength(7)
    expect(RECONCILIATION_BANK_SAMPLE_COUNT).toBe(245)
    expect(RECONCILIATION_CARD_SAMPLE_COUNT).toBe(105)
    expect(RECONCILIATION_PRIMARY_SAMPLE_COUNT).toBe(350)
    expect(RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT).toBe(14)
    expect(BANK_SAMPLE_DEFINITIONS).toHaveLength(RECONCILIATION_BANK_SAMPLE_COUNT)
    expect(CARD_SAMPLE_DEFINITIONS).toHaveLength(RECONCILIATION_CARD_SAMPLE_COUNT)
    expect(ORPHAN_TAX_INVOICE_DEFINITIONS).toHaveLength(RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT)
    expect(RECONCILIATION_TAX_INVOICE_SAMPLE_COUNT).toBe(
      RECONCILIATION_BANK_MATCHED_COUNT
      + RECONCILIATION_CARD_MATCHED_COUNT
      + RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT,
    )
  })

  it('keeps at least 95% primary match rate for bank and card rows', () => {
    const matchRate = RECONCILIATION_MATCHED_PRIMARY_COUNT / RECONCILIATION_PRIMARY_SAMPLE_COUNT
    expect(matchRate).toBeGreaterThanOrEqual(0.95)
    expect(RECONCILIATION_BANK_MATCHED_COUNT).toBe(238)
    expect(RECONCILIATION_CARD_MATCHED_COUNT).toBe(98)
  })

  it('pairs matched bank rows with same date and amount tax invoices', () => {
    const matchedBank = BANK_SAMPLE_DEFINITIONS.filter((sample) => sample.matched)
    for (const sample of matchedBank.slice(0, 12)) {
      expect(sample.taxItem).toBeTruthy()
      expect(sample.taxCounterparty).toBeTruthy()
      expect(sample.amountKrw).toBeGreaterThan(0)
      expect(sample.transactionDate).toMatch(/^2026-\d{2}-\d{2}$/)
    }
  })

  it('spans January through July 2026', () => {
    const months = new Set([
      ...BANK_SAMPLE_DEFINITIONS.map((sample) => sample.transactionDate.slice(0, 7)),
      ...CARD_SAMPLE_DEFINITIONS.map((sample) => sample.transactionDate.slice(0, 7)),
    ])
    expect(months.has('2026-01')).toBe(true)
    expect(months.has('2026-07')).toBe(true)
  })
})
