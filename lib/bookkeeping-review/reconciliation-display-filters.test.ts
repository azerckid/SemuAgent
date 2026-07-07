import { describe, expect, it } from 'vitest'
import {
  filterReconciliationDisplayRows,
  normalizeReconciliationDisplayFilter,
  reconciliationDisplayFilterHref,
} from './reconciliation-display-filters'
import { RECONCILIATION_LEDGER_DISPLAY_FIXTURE } from './reconciliation-display-fixture'

describe('reconciliation display filters', () => {
  const rows = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows

  it('normalizes fixture tab query values', () => {
    expect(normalizeReconciliationDisplayFilter('evidence_required')).toBe('evidence_required')
    expect(normalizeReconciliationDisplayFilter('missing_evidence')).toBe('all')
  })

  it('filters evidence and explanation action states', () => {
    expect(filterReconciliationDisplayRows(rows, 'evidence_required').every((row) => row.evidenceActionState === 'evidence_required')).toBe(true)
    expect(filterReconciliationDisplayRows(rows, 'explanation_required').length).toBeGreaterThan(0)
  })

  it('builds fixture href with display=fixture', () => {
    expect(reconciliationDisplayFilterHref('evidence_required')).toContain('display=fixture')
    expect(reconciliationDisplayFilterHref('evidence_required')).toContain('source=evidence_required')
  })

  it('filters cash_receipt tab across cash_receipt and receipt sources', () => {
    const filtered = filterReconciliationDisplayRows(rows, 'cash_receipt')
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((row) => row.source === 'cash_receipt' || row.source === 'receipt')).toBe(true)
  })
})
