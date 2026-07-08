import { describe, expect, it } from 'vitest'
import { RECONCILIATION_BANK_FIXTURE_ROW_IDS } from './reconciliation-bank-fixture-rows'
import { RECONCILIATION_LEDGER_DISPLAY_FIXTURE } from './reconciliation-display-fixture'
import {
  computeRemainingDifferenceKrw,
  evidenceActionChipLabel,
  evidenceFinderActionLabel,
  evidenceRowHighlightTone,
  hasAiEvidenceSuggestion,
  listEvidenceFinderBrowseRows,
  matchesEvidenceFinderSource,
  resolveLinkedEvidenceDisplay,
  shouldShowEvidenceFinder,
} from './reconciliation-row-actions'

describe('reconciliation-row-actions', () => {
  it('computes remaining difference from row amount and candidate totals', () => {
    const row = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankAmbiguous)
    expect(row).toBeDefined()

    expect(computeRemainingDifferenceKrw(row!.amountKrw, row!.candidates)).toBe(row!.amountKrw! - 3_767_360)
  })

  it('returns full row amount when no candidates exist', () => {
    const row = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-card-saas')
    expect(row).toBeDefined()

    expect(computeRemainingDifferenceKrw(row!.amountKrw, row!.candidates)).toBe(112_000)
  })

  it('shows 증빙있음 for rows with found evidence and still offers the evidence finder', () => {
    const row = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankToTaxInvoice)
    expect(row).toBeDefined()
    expect(hasAiEvidenceSuggestion(row!)).toBe(true)
    expect(evidenceActionChipLabel(row!.evidenceActionState)?.label).toBe('증빙있음')
    expect(shouldShowEvidenceFinder(row!)).toBe(true)
    expect(evidenceFinderActionLabel(row!)).toBe('증빙 확인')
  })

  it('shows 증빙있음 for linked rows and still offers the evidence finder', () => {
    expect(evidenceActionChipLabel('linked')?.label).toBe('증빙있음')

    const linkedRow = {
      ...RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows[0]!,
      evidenceActionState: 'linked' as const,
      rowConclusion: {
        ...RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows[0]!.rowConclusion,
        primaryAction: 'review_only' as const,
      },
    }

    expect(shouldShowEvidenceFinder(linkedRow)).toBe(true)
    expect(evidenceFinderActionLabel(linkedRow)).toBe('증빙 확인')
  })

  it('hides evidence finder for explanation rows', () => {
    const explanationRow = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-card-saas')
    expect(explanationRow).toBeDefined()
    expect(evidenceActionChipLabel(explanationRow!.evidenceActionState)?.label).toBe('소명 필요')
    expect(shouldShowEvidenceFinder(explanationRow!)).toBe(false)
  })

  it('keeps 증빙 찾기 label for rows that still need evidence', () => {
    const evidenceRequiredRow = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-tax-hardson')
    expect(evidenceRequiredRow).toBeDefined()
    expect(evidenceActionChipLabel(evidenceRequiredRow!.evidenceActionState)?.label).toBe('증빙 필요')
    expect(shouldShowEvidenceFinder(evidenceRequiredRow!)).toBe(true)
    expect(evidenceFinderActionLabel(evidenceRequiredRow!)).toBe('증빙 찾기')
  })

  it('uses danger row highlight only for evidence or explanation blockers', () => {
    const foundEvidenceRow = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankToTaxInvoice)
    const evidenceRequiredRow = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-tax-hardson')
    const explanationRow = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-card-saas')

    expect(foundEvidenceRow).toBeDefined()
    expect(evidenceRequiredRow).toBeDefined()
    expect(explanationRow).toBeDefined()
    expect(evidenceRowHighlightTone(foundEvidenceRow!)).toBe('default')
    expect(evidenceRowHighlightTone(evidenceRequiredRow!)).toBe('danger')
    expect(evidenceRowHighlightTone(explanationRow!)).toBe('danger')
  })

  it('resolves linked evidence from candidates or row fallback', () => {
    const rentRow = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankLinked)
    const interestRow = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankInterestLinked)
    expect(rentRow).toBeDefined()
    expect(interestRow).toBeDefined()

    expect(resolveLinkedEvidenceDisplay(rentRow!)[0]?.source).toBe('tax_invoice')
    expect(resolveLinkedEvidenceDisplay(interestRow!)[0]?.source).toBe('bank')
  })

  it('lists browse rows for evidence finder by source', () => {
    const rows = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows
    const selectedRowId = RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankToTaxInvoice

    const taxInvoiceRows = listEvidenceFinderBrowseRows(rows, 'tax_invoice', selectedRowId)
    expect(taxInvoiceRows.every((row) => row.source === 'tax_invoice')).toBe(true)
    expect(taxInvoiceRows.some((row) => row.id === selectedRowId)).toBe(false)

    const cashReceiptRows = listEvidenceFinderBrowseRows(rows, 'cash_receipt', selectedRowId)
    expect(cashReceiptRows.every((row) => matchesEvidenceFinderSource(row.source, 'cash_receipt'))).toBe(true)
  })
})
