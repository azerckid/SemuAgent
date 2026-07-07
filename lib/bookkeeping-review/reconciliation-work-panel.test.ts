import { describe, expect, it } from 'vitest'
import { RECONCILIATION_LEDGER_DISPLAY_FIXTURE } from './reconciliation-display-fixture'
import {
  computeRemainingDifferenceKrw,
  evidenceActionChipLabel,
  hasAiEvidenceSuggestion,
  listEvidenceFinderBrowseRows,
  matchesEvidenceFinderSource,
  resolveLinkedEvidenceDisplay,
  shouldShowEvidenceFinder,
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

  it('treats candidate rows with matches as AI suggestions, not chip labels', () => {
    const row = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-bank-litnex')
    expect(row).toBeDefined()
    expect(hasAiEvidenceSuggestion(row!)).toBe(true)
    expect(evidenceActionChipLabel(row!.evidenceActionState)).toBeNull()
  })

  it('shows 증빙있음 for linked rows and hides evidence finder', () => {
    expect(evidenceActionChipLabel('linked')?.label).toBe('증빙있음')

    const linkedRow = {
      ...RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows[0]!,
      evidenceActionState: 'linked' as const,
      workPanelConclusion: {
        ...RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows[0]!.workPanelConclusion,
        primaryAction: 'review_only' as const,
      },
    }

    expect(shouldShowEvidenceFinder(linkedRow)).toBe(false)
  })

  it('resolves linked evidence from candidates or row fallback', () => {
    const rentRow = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-bank-rent-linked')
    const interestRow = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-bank-interest-income')
    expect(rentRow).toBeDefined()
    expect(interestRow).toBeDefined()

    expect(resolveLinkedEvidenceDisplay(rentRow!)[0]?.source).toBe('tax_invoice')
    expect(resolveLinkedEvidenceDisplay(interestRow!)[0]?.source).toBe('bank')
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
