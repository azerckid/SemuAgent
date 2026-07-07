import { describe, expect, it } from 'vitest'
import { RECONCILIATION_LEDGER_DISPLAY_FIXTURE } from './reconciliation-display-fixture'
import {
  computeRemainingDifferenceKrw,
  listEvidenceFinderBrowseRows,
  matchesEvidenceFinderSource,
} from './reconciliation-work-panel'

describe('reconciliation-work-panel', () => {
  it('computes remaining difference from row amount and candidate totals', () => {
    const row = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-bank-musinsa')
    expect(row).toBeDefined()

    expect(computeRemainingDifferenceKrw(row!.amountKrw, row!.candidates)).toBe(62_140)
  })

  it('returns full row amount when no candidates exist', () => {
    const row = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-card-saas')
    expect(row).toBeDefined()

    expect(computeRemainingDifferenceKrw(row!.amountKrw, row!.candidates)).toBe(112_000)
  })

  it('lists browse rows for evidence finder by source', () => {
    const rows = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows
    const selectedRowId = 'preview-bank-litnex'

    const taxInvoiceRows = listEvidenceFinderBrowseRows(rows, 'tax_invoice', selectedRowId)
    expect(taxInvoiceRows.every((row) => row.source === 'tax_invoice')).toBe(true)
    expect(taxInvoiceRows.some((row) => row.id === selectedRowId)).toBe(false)

    const cashReceiptRows = listEvidenceFinderBrowseRows(rows, 'cash_receipt', selectedRowId)
    expect(cashReceiptRows.every((row) => matchesEvidenceFinderSource(row.source, 'cash_receipt'))).toBe(true)
  })
})
