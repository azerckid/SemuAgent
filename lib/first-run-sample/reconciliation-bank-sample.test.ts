import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))

import {
  RECONCILIATION_BANK_MATCHED_COUNT,
  RECONCILIATION_BANK_SAMPLE_COUNT,
  RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT,
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
  it('creates 50 bank rows and paired tax invoices for 96% match rate', () => {
    const rows = buildReconciliationBankSampleRows(
      params,
      firstRunSampleId(params.tenantId, 'upload_session_2026h1'),
      firstRunSampleId(params.tenantId, 'source_batch_2026h1'),
      firstRunSampleId(params.tenantId, 'bookkeeping_run_2026h1'),
    )
    const summary = summarizeReconciliationBankSample(rows)

    expect(RECONCILIATION_BANK_SAMPLE_COUNT).toBe(50)
    expect(RECONCILIATION_BANK_MATCHED_COUNT).toBe(48)
    expect(RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT).toBe(6)
    expect(summary.bankCount).toBe(50)
    expect(summary.taxInvoiceCount).toBe(48 + RECONCILIATION_ORPHAN_TAX_INVOICE_COUNT)
    expect(summary.matchRate).toBeGreaterThanOrEqual(0.95)
    expect(summary.aiHighConfidenceCount).toBeGreaterThanOrEqual(96)
  })

  it('pairs bank and tax rows by same date and amount', () => {
    const rows = buildReconciliationBankSampleRows(
      params,
      firstRunSampleId(params.tenantId, 'upload_session_2026h1'),
      firstRunSampleId(params.tenantId, 'source_batch_2026h1'),
      firstRunSampleId(params.tenantId, 'bookkeeping_run_2026h1'),
    )

    const bankRow = rows.find((row) => row.id.endsWith('bk_bank_001'))
    const taxRow = rows.find((row) => row.id.endsWith('bk_tax_001'))
    expect(bankRow?.sourceType).toBe('bank')
    expect(taxRow?.sourceType).toBe('tax_invoice')
    expect(bankRow?.amountKrw).toBe(taxRow?.amountKrw)
    expect(bankRow?.transactionDate).toBe(taxRow?.transactionDate)
    expect(bankRow?.recommendedAccount).toBe('매출')
    expect(bankRow?.status).toBe('suggested')
    expect(bankRow?.recommendationConfidence).toBe('high')
  })
})
