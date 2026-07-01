import { describe, expect, it } from 'vitest'
import { buildJournalEntryDraftRow } from './journal-entry-rules'
import {
  buildSalesVatVoucherDraft,
  containsSalesTaxInvoiceSignal,
  isSalesVatCandidate,
  isSalesVatExcludedSourceType,
  SALES_TAX_INVOICE_SIGNAL,
  SALES_VAT_AR_ACCOUNT_NAME,
  SALES_VAT_PAYABLE_ACCOUNT_NAME,
  SALES_VAT_SALES_ACCOUNT_NAME,
  splitGrossSupplyAndVat,
  type JournalEntryClassificationSourceRow,
} from './journal-entry-sales-vat-rules'
import {
  buildStoredVoucherRecordsFromSalesVatDraft,
  mapStoredVoucherLinesToDisplayLines,
} from './journal-entry-voucher-lines'

function sourceRow(
  overrides: Partial<JournalEntryClassificationSourceRow> & Pick<JournalEntryClassificationSourceRow, 'id'>,
): JournalEntryClassificationSourceRow {
  return {
    transactionDate: '2025-04-15',
    merchantName: '거래처A',
    description: '4월 매출',
    amountKrw: 1_320_000,
    direction: 'income',
    recommendedAccount: 'sales',
    finalAccount: 'sales',
    status: 'confirmed',
    staffMemo: null,
    sourceType: 'tax_invoice',
    ...overrides,
  }
}

describe('journal entry sales vat rules', () => {
  it('splits gross amounts only when supply and vat form an exact 10% relationship', () => {
    expect(splitGrossSupplyAndVat(1_320_000)).toEqual({ supply: 1_200_000, vat: 120_000 })
    expect(splitGrossSupplyAndVat(77_600)).toBeNull()
    expect(splitGrossSupplyAndVat(1_000_003)).toBeNull()
    expect(splitGrossSupplyAndVat(1_100_001)).toBeNull()
  })

  it('detects sales vat candidates only for income sales tax_invoice rows with splittable gross', () => {
    expect(isSalesVatCandidate(sourceRow({ id: 'sales-vat' }))).toBe(true)
    expect(isSalesVatCandidate(sourceRow({ id: 'bank', sourceType: 'bank' }))).toBe(false)
    expect(isSalesVatCandidate(sourceRow({ id: 'card', sourceType: 'card' }))).toBe(false)
    expect(isSalesVatCandidate(sourceRow({ id: 'receipt', sourceType: 'receipt' }))).toBe(false)
    expect(isSalesVatCandidate(sourceRow({ id: 'pg', sourceType: 'bank', description: 'Npay정산' }))).toBe(false)
    expect(isSalesVatCandidate(sourceRow({ id: 'other-sales', sourceType: 'other', recommendedAccount: 'sales', finalAccount: 'sales' }))).toBe(false)
    expect(isSalesVatCandidate(sourceRow({ id: 'signal', sourceType: 'other', description: SALES_TAX_INVOICE_SIGNAL }))).toBe(true)
    expect(isSalesVatCandidate(sourceRow({ id: 'bad-gross', amountKrw: 1_000_003 }))).toBe(false)
    expect(isSalesVatCandidate(sourceRow({ id: 'expense', direction: 'expense' }))).toBe(false)
    expect(isSalesVatExcludedSourceType('bank')).toBe(true)
    expect(containsSalesTaxInvoiceSignal(sourceRow({ id: 'text', description: '매출세금계산서 발행' }))).toBe(true)
  })

  it('builds a 3-line voucher draft in excel order: 부가세예수금 → 상품매출 → 외상매출금', () => {
    const source = sourceRow({ id: 'sales-vat' })
    const draft = buildJournalEntryDraftRow(source)
    expect(draft).not.toBeNull()

    const salesVatDraft = buildSalesVatVoucherDraft({ source, draft: draft! })

    expect(salesVatDraft).toMatchObject({
      classificationRowId: 'sales-vat',
      status: 'draft',
      counterparty: '거래처A',
    })
    expect(salesVatDraft?.lines).toEqual([
      {
        lineSequence: 1,
        side: 'credit',
        accountName: SALES_VAT_PAYABLE_ACCOUNT_NAME,
        amountKrw: 120_000,
        memo: '4월 매출',
      },
      {
        lineSequence: 2,
        side: 'credit',
        accountName: SALES_VAT_SALES_ACCOUNT_NAME,
        amountKrw: 1_200_000,
        memo: '4월 매출',
      },
      {
        lineSequence: 3,
        side: 'debit',
        accountName: SALES_VAT_AR_ACCOUNT_NAME,
        amountKrw: 1_320_000,
        memo: '4월 매출',
      },
    ])
  })

  it('returns null for bank PG settlement income rows even when classified as sales', () => {
    const source = sourceRow({
      id: 'pg-settlement',
      sourceType: 'bank',
      merchantName: 'Npay',
      description: '정산 입금',
      amountKrw: 1_320_000,
    })
    const draft = buildJournalEntryDraftRow(source)

    expect(isSalesVatCandidate(source)).toBe(false)
    expect(buildSalesVatVoucherDraft({ source, draft: draft! })).toBeNull()
  })

  it('marks needs_decision when source or draft requires staff review', () => {
    const source = sourceRow({ id: 'needs-review', status: 'needs_decision' })
    const draft = buildJournalEntryDraftRow(source)
    const salesVatDraft = buildSalesVatVoucherDraft({ source, draft: draft! })

    expect(salesVatDraft?.status).toBe('needs_decision')
  })

  it('stores sales vat vouchers with 3 lines and single source classification id', () => {
    const source = sourceRow({ id: 'sales-vat' })
    const draft = buildJournalEntryDraftRow(source)
    const salesVatDraft = buildSalesVatVoucherDraft({ source, draft: draft! })
    expect(salesVatDraft).not.toBeNull()

    const stored = buildStoredVoucherRecordsFromSalesVatDraft({
      ...salesVatDraft!,
      requestedPeriod: '2025-04',
      attributedPeriod: '2025-04',
      closePeriod: '2025-04~2025-06',
    }, {
      tenantId: 'tenant-1',
      journalEntryRunId: 'run-1',
      uploadSessionId: 'session-1',
      requestedPeriod: '2025-04',
      attributedPeriod: '2025-04',
      closePeriod: '2025-04~2025-06',
      timestamp: '2026-06-01T00:00:00.000+09:00',
      voucherId: 'voucher-1',
      voucherNumber: '00001',
      lineIds: ['line-1', 'line-2', 'line-3'],
    })

    expect(stored.lines).toHaveLength(3)
    expect(stored.voucher.sourceClassificationRowIds).toBe(JSON.stringify(['sales-vat']))
    expect(stored.lines.map((line) => line.accountName)).toEqual([
      SALES_VAT_PAYABLE_ACCOUNT_NAME,
      SALES_VAT_SALES_ACCOUNT_NAME,
      SALES_VAT_AR_ACCOUNT_NAME,
    ])
    expect(stored.lines.map((line) => line.accountCode)).toEqual(['255', '401', '108'])

    const displayLines = mapStoredVoucherLinesToDisplayLines(
      [{
        id: stored.voucher.id,
        voucherNumber: stored.voucher.voucherNumber,
        entryDate: stored.voucher.entryDate,
        status: stored.voucher.status,
      }],
      stored.lines,
    )

    expect(displayLines).toHaveLength(3)
    expect(displayLines[0]).toMatchObject({
      side: 'credit',
      accountName: SALES_VAT_PAYABLE_ACCOUNT_NAME,
      creditAmountKrw: 120_000,
    })
    expect(displayLines[2]).toMatchObject({
      side: 'debit',
      accountName: SALES_VAT_AR_ACCOUNT_NAME,
      debitAmountKrw: 1_320_000,
    })
  })
})
