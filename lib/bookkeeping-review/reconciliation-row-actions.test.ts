import { describe, expect, it } from 'vitest'
import { RECONCILIATION_BANK_FIXTURE_ROW_IDS } from './reconciliation-bank-fixture-rows'
import { RECONCILIATION_LEDGER_DISPLAY_FIXTURE } from './reconciliation-display-fixture'
import {
  computeRemainingDifferenceKrw,
  evidenceActionChipLabel,
  evidenceFinderActionLabel,
  evidenceFinderSourceForLinkedEvidence,
  evidenceRowHighlightTone,
  filterEvidenceFinderBrowseRows,
  formatExclusionReasonMemo,
  hasAiEvidenceSuggestion,
  hasEvidenceFinderAiMatch,
  listEvidenceFinderBrowseRows,
  matchesEvidenceFinderSource,
  resolveEvidenceFinderRowMatch,
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

  it('hides evidence finder for excluded rows (JC-010 2b-1 exclusion visibility)', () => {
    const excludedRow = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === 'preview-cash-personal')
    expect(excludedRow).toBeDefined()
    expect(evidenceActionChipLabel(excludedRow!.evidenceActionState)?.label).toBe('제외됨')
    expect(shouldShowEvidenceFinder(excludedRow!)).toBe(false)
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

    const rentEvidence = resolveLinkedEvidenceDisplay(rentRow!)[0]
    const interestEvidence = resolveLinkedEvidenceDisplay(interestRow!)[0]

    expect(rentEvidence?.source).toBe('tax_invoice')
    expect(rentEvidence?.rowId).toBe(rentRow!.candidates[0]!.rowId)
    expect(interestEvidence?.source).toBe('bank')
    expect(interestEvidence?.rowId).toBeNull()
  })

  it('maps linked evidence sources to evidence finder source lists', () => {
    expect(evidenceFinderSourceForLinkedEvidence('tax_invoice')).toBe('tax_invoice')
    expect(evidenceFinderSourceForLinkedEvidence('receipt')).toBe('cash_receipt')
    expect(evidenceFinderSourceForLinkedEvidence('cash_receipt')).toBe('cash_receipt')
    expect(evidenceFinderSourceForLinkedEvidence('card')).toBe('card')
    expect(evidenceFinderSourceForLinkedEvidence('bank')).toBeNull()
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

  it('filters evidence finder browse rows by query across counterparty, description, and amount', () => {
    const rows = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows
    const selectedRowId = RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankToTaxInvoice
    const taxInvoiceRows = listEvidenceFinderBrowseRows(rows, 'tax_invoice', selectedRowId)
    const target = taxInvoiceRows[0]
    expect(target).toBeDefined()

    const byCounterparty = target!.counterparty
      ? filterEvidenceFinderBrowseRows(taxInvoiceRows, { query: target!.counterparty, date: '' })
      : []
    if (target!.counterparty) {
      expect(byCounterparty.some((row) => row.id === target!.id)).toBe(true)
    }

    const noMatches = filterEvidenceFinderBrowseRows(taxInvoiceRows, { query: '존재하지-않는-거래처-xyz', date: '' })
    expect(noMatches).toHaveLength(0)

    const amountTarget = taxInvoiceRows.find((row) => row.amountKrw !== null)
    expect(amountTarget).toBeDefined()
    const formattedAmount = amountTarget!.amountKrw!.toLocaleString('ko-KR')
    const byFormattedAmount = filterEvidenceFinderBrowseRows(taxInvoiceRows, { query: formattedAmount, date: '' })
    expect(byFormattedAmount.some((row) => row.id === amountTarget!.id)).toBe(true)

    const unfiltered = filterEvidenceFinderBrowseRows(taxInvoiceRows, { query: '', date: '' })
    expect(unfiltered).toHaveLength(taxInvoiceRows.length)
  })

  it('filters evidence finder browse rows by partial date match', () => {
    const rows = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows
    const selectedRowId = RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankToTaxInvoice
    const taxInvoiceRows = listEvidenceFinderBrowseRows(rows, 'tax_invoice', selectedRowId)
    const target = taxInvoiceRows.find((row) => row.transactionDate)
    expect(target).toBeDefined()

    const filtered = filterEvidenceFinderBrowseRows(taxInvoiceRows, { query: '', date: target!.transactionDate! })
    expect(filtered.every((row) => row.transactionDate === target!.transactionDate)).toBe(true)
    expect(filtered.some((row) => row.id === target!.id)).toBe(true)
  })

  it('resolves the AI-matched candidate for a browse row by rowId', () => {
    const row = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows.find((item) => item.id === RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankToTaxInvoice)
    expect(row).toBeDefined()
    expect(row!.candidates.length).toBeGreaterThan(0)

    const matchedCandidateRowId = row!.candidates[0]!.rowId
    expect(resolveEvidenceFinderRowMatch(row!.candidates, matchedCandidateRowId)).toEqual(row!.candidates[0])
    expect(resolveEvidenceFinderRowMatch(row!.candidates, 'no-such-row-id')).toBeNull()
    expect(resolveEvidenceFinderRowMatch([], matchedCandidateRowId)).toBeNull()
  })

  it('only reports an AI match when the candidate is in the currently browsed source list', () => {
    const rows = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows
    const row = rows.find((item) => item.id === RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankToTaxInvoice)
    expect(row).toBeDefined()
    expect(row!.candidates.every((candidate) => candidate.source === 'tax_invoice')).toBe(true)

    const taxInvoiceBrowseRows = listEvidenceFinderBrowseRows(rows, 'tax_invoice', row!.id)
    expect(hasEvidenceFinderAiMatch(row!.candidates, taxInvoiceBrowseRows)).toBe(true)

    const cashReceiptBrowseRows = listEvidenceFinderBrowseRows(rows, 'cash_receipt', row!.id)
    expect(hasEvidenceFinderAiMatch(row!.candidates, cashReceiptBrowseRows)).toBe(false)
  })

  it('does not treat manual reference links as AI matches', () => {
    const rows = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows
    const row = rows.find((item) => item.id === RECONCILIATION_BANK_FIXTURE_ROW_IDS.bankToTaxInvoice)
    expect(row).toBeDefined()
    expect(row!.candidates[0]).toBeDefined()

    const manualReferenceCandidate = {
      ...row!.candidates[0]!,
      reason: 'manual_reference' as const,
    }
    const taxInvoiceBrowseRows = listEvidenceFinderBrowseRows(rows, 'tax_invoice', row!.id)

    expect(hasEvidenceFinderAiMatch([manualReferenceCandidate], taxInvoiceBrowseRows)).toBe(false)
  })
})

describe('formatExclusionReasonMemo', () => {
  it('prefixes the reason with a consistent "제외 사유: " label', () => {
    expect(formatExclusionReasonMemo('개인 사용 - 영화 관람')).toBe('제외 사유: 개인 사용 - 영화 관람')
  })

  it('trims surrounding whitespace from the reason', () => {
    expect(formatExclusionReasonMemo('  업무무관  ')).toBe('제외 사유: 업무무관')
  })
})
