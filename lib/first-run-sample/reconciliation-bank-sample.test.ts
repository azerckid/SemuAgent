import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))

import {
  RECONCILIATION_BANK_MATCHED_COUNT,
  RECONCILIATION_BANK_SAMPLE_COUNT,
  RECONCILIATION_CARD_SAMPLE_COUNT,
  RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT,
  RECONCILIATION_TAX_INVOICE_SAMPLE_COUNT,
  buildReconciliationBankSampleRows,
  summarizeReconciliationBankSample,
} from './reconciliation-bank-sample'
import { firstRunSampleId } from './seed'

const params = {
  tenantId: 'tenant-1',
  staffId: 'staff-1',
  timestamp: '2026-07-08T00:00:00.000+09:00',
}

describe('reconciliation bank sample rows', () => {
  it('creates 7-month bank, card, and tax invoice seed rows with 95%+ match rate', () => {
    const rows = buildReconciliationBankSampleRows(
      params,
      firstRunSampleId(params.tenantId, 'upload_session_2026h1'),
      firstRunSampleId(params.tenantId, 'source_batch_2026h1'),
      firstRunSampleId(params.tenantId, 'bookkeeping_run_2026h1'),
    )
    const summary = summarizeReconciliationBankSample(rows)

    expect(RECONCILIATION_BANK_SAMPLE_COUNT).toBe(245)
    expect(RECONCILIATION_CARD_SAMPLE_COUNT).toBe(105)
    expect(RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT).toBe(14)
    expect(summary.bankCount).toBe(245)
    expect(summary.cardCount).toBe(105)
    expect(summary.taxInvoiceCount).toBe(RECONCILIATION_TAX_INVOICE_SAMPLE_COUNT)
    expect(summary.matchRate).toBeGreaterThanOrEqual(0.95)
    expect(summary.aiHighConfidenceCount).toBeGreaterThanOrEqual(600)
    expect(rows.length).toBe(
      RECONCILIATION_BANK_SAMPLE_COUNT
      + RECONCILIATION_CARD_SAMPLE_COUNT
      + RECONCILIATION_TAX_INVOICE_SAMPLE_COUNT,
    )
    expect(RECONCILIATION_BANK_MATCHED_COUNT).toBe(238)
  })

  it('pairs bank and tax rows by same date and amount', () => {
    const rows = buildReconciliationBankSampleRows(
      params,
      firstRunSampleId(params.tenantId, 'upload_session_2026h1'),
      firstRunSampleId(params.tenantId, 'source_batch_2026h1'),
      firstRunSampleId(params.tenantId, 'bookkeeping_run_2026h1'),
    )

    const bankRow = rows.find((row) => row.id.endsWith('bk_bank_202601_b01'))
    const taxRow = rows.find((row) => row.id.endsWith('bk_tax_202601_b01'))
    expect(bankRow?.sourceType).toBe('bank')
    expect(taxRow?.sourceType).toBe('tax_invoice')
    expect(bankRow?.amountKrw).toBe(taxRow?.amountKrw)
    expect(bankRow?.transactionDate).toBe(taxRow?.transactionDate)
    expect(bankRow?.status).toBe('suggested')
    expect(bankRow?.recommendationConfidence).toBe('high')
  })

  it('creates paired card and tax invoice rows', () => {
    const rows = buildReconciliationBankSampleRows(
      params,
      firstRunSampleId(params.tenantId, 'upload_session_2026h1'),
      firstRunSampleId(params.tenantId, 'source_batch_2026h1'),
      firstRunSampleId(params.tenantId, 'bookkeeping_run_2026h1'),
    )

    const cardRow = rows.find((row) => row.id.endsWith('bk_card_202601_c01'))
    const taxRow = rows.find((row) => row.id.endsWith('bk_tax_card_202601_c01'))
    expect(cardRow?.sourceType).toBe('card')
    expect(taxRow?.sourceType).toBe('tax_invoice')
    expect(cardRow?.amountKrw).toBe(taxRow?.amountKrw)
    expect(cardRow?.transactionDate).toBe(taxRow?.transactionDate)
  })
})
