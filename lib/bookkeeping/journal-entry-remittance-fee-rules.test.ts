import { describe, expect, it } from 'vitest'
import {
  buildRemittanceFeeVoucherDraftFromPair,
  collectRemittanceFeePairedClassificationRowIds,
  containsRemittanceFeeText,
  findRemittanceFeePairs,
  isRemittanceFeeCandidate,
  isRemittancePrincipalCandidate,
  REMITTANCE_FEE_ACCOUNT_NAME,
  REMITTANCE_FEE_BANK_ACCOUNT_NAME,
  REMITTANCE_FEE_MAX_AMOUNT_KRW,
  REMITTANCE_FEE_MEMO,
  PAYABLE_ACCOUNT_NAME,
  PURCHASE_PAYABLE_ACCOUNT_NAME,
} from './journal-entry-remittance-fee-rules'
import {
  buildStoredVoucherRecordsFromRemittanceFeeDraft,
  mapStoredVoucherLinesToDisplayLines,
} from './journal-entry-voucher-lines'
import type { JournalEntrySourceRow } from './journal-entry-rules'

function sourceRow(overrides: Partial<JournalEntrySourceRow> & Pick<JournalEntrySourceRow, 'id'>): JournalEntrySourceRow {
  return {
    transactionDate: '2025-04-01',
    merchantName: '농협김경숙',
    description: '거래대금',
    amountKrw: 1_215_000,
    direction: 'expense',
    recommendedAccount: 'purchase_goods',
    finalAccount: 'purchase_goods',
    status: 'confirmed',
    staffMemo: null,
    ...overrides,
  }
}

function feeRow(overrides: Partial<JournalEntrySourceRow> = {}) {
  return sourceRow({
    id: 'fee-row',
    amountKrw: 500,
    merchantName: '우리은행',
    description: '송금수수료',
    recommendedAccount: 'fees',
    finalAccount: 'fees',
    ...overrides,
  })
}

function principalRow(overrides: Partial<JournalEntrySourceRow> = {}) {
  return sourceRow({
    id: 'principal-row',
    ...overrides,
  })
}

describe('journal entry remittance fee rules', () => {
  it('detects fee candidates only when 송금수수료 text, fees account, and amount are within limit', () => {
    expect(isRemittanceFeeCandidate(feeRow())).toBe(true)
    expect(isRemittanceFeeCandidate(feeRow({ description: '인터넷뱅킹 수수료' }))).toBe(false)
    expect(isRemittanceFeeCandidate(feeRow({ amountKrw: REMITTANCE_FEE_MAX_AMOUNT_KRW + 1 }))).toBe(false)
    expect(isRemittanceFeeCandidate(feeRow({ recommendedAccount: 'communication', finalAccount: 'communication' }))).toBe(false)
    expect(containsRemittanceFeeText(feeRow({ merchantName: '송금수수료', description: null }))).toBe(true)
  })

  it('detects principal candidates and excludes fee-only rows', () => {
    expect(isRemittancePrincipalCandidate(principalRow())).toBe(true)
    expect(isRemittancePrincipalCandidate(feeRow())).toBe(false)
    expect(isRemittancePrincipalCandidate(principalRow({ finalAccount: 'unclassified', recommendedAccount: 'unclassified' }))).toBe(false)
  })

  it('pairs principal and fee rows 1:1 on the same date', () => {
    const pairs = findRemittanceFeePairs([principalRow(), feeRow()])

    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toMatchObject({
      principal: { id: 'principal-row' },
      fee: { id: 'fee-row' },
    })
  })

  it('does not pair when multiple principals are eligible for one fee', () => {
    const pairs = findRemittanceFeePairs([
      principalRow({ id: 'principal-1' }),
      principalRow({ id: 'principal-2', amountKrw: 2_000_000 }),
      feeRow(),
    ])

    expect(pairs).toHaveLength(0)
  })

  it('does not pair when multiple fees are eligible for one principal', () => {
    const pairs = findRemittanceFeePairs([
      principalRow({ amountKrw: 2_000_000 }),
      feeRow({ id: 'fee-1', amountKrw: 500 }),
      feeRow({ id: 'fee-2', amountKrw: 700 }),
    ])

    expect(pairs).toHaveLength(0)
  })

  it('excludes paired fee and principal ids from standalone voucher generation', () => {
    const pairs = findRemittanceFeePairs([principalRow(), feeRow()])
    const pairedIds = collectRemittanceFeePairedClassificationRowIds(pairs)

    expect(pairedIds).toEqual(new Set(['principal-row', 'fee-row']))

    const preparedIds = ['principal-row', 'fee-row', 'other-principal']
    const standaloneIds = preparedIds.filter((id) => !pairedIds.has(id))

    expect(standaloneIds).toEqual(['other-principal'])
  })

  it('does not pair when fee amount exceeds 10,000', () => {
    const pairs = findRemittanceFeePairs([
      principalRow(),
      feeRow({ amountKrw: 13_000, description: '송금수수료' }),
    ])

    expect(pairs).toHaveLength(0)
    expect(findRemittanceFeePairs([principalRow(), feeRow({ amountKrw: 13_000 })])).toHaveLength(0)
  })

  it('builds a 3-line voucher draft with credit 보통예금 = principal + fee', () => {
    const draft = buildRemittanceFeeVoucherDraftFromPair({
      principal: principalRow(),
      fee: feeRow(),
    })

    expect(draft).toMatchObject({
      principalClassificationRowId: 'principal-row',
      feeClassificationRowId: 'fee-row',
      status: 'draft',
      counterparty: '농협김경숙',
    })
    expect(draft?.lines).toEqual([
      {
        lineSequence: 1,
        side: 'credit',
        accountName: REMITTANCE_FEE_BANK_ACCOUNT_NAME,
        amountKrw: 1_215_500,
        memo: '거래대금',
      },
      {
        lineSequence: 2,
        side: 'debit',
        accountName: PURCHASE_PAYABLE_ACCOUNT_NAME,
        amountKrw: 1_215_000,
        memo: '거래대금',
      },
      {
        lineSequence: 3,
        side: 'debit',
        accountName: REMITTANCE_FEE_ACCOUNT_NAME,
        amountKrw: 500,
        memo: REMITTANCE_FEE_MEMO,
      },
    ])
  })

  it('uses draft debit account when principal is not purchase_goods', () => {
    const draft = buildRemittanceFeeVoucherDraftFromPair({
      principal: principalRow({
        recommendedAccount: 'advertising',
        finalAccount: 'advertising',
        description: '광고비 결제',
      }),
      fee: feeRow(),
    })

    expect(draft?.lines[1]?.accountName).toBe('광고선전비')
  })

  it('falls back to 미지급금 when principal draft is needs_decision but account key is usable', () => {
    const draft = buildRemittanceFeeVoucherDraftFromPair({
      principal: principalRow({
        direction: 'unknown',
        recommendedAccount: 'supplies',
        finalAccount: 'supplies',
        status: 'needs_decision',
      }),
      fee: feeRow(),
    })

    expect(draft?.status).toBe('needs_decision')
    expect(draft?.lines[1]?.accountName).toBe(PAYABLE_ACCOUNT_NAME)
  })

  it('marks unclassified principal pairs as needs_decision', () => {
    const draft = buildRemittanceFeeVoucherDraftFromPair({
      principal: principalRow({
        recommendedAccount: 'unclassified',
        finalAccount: 'unclassified',
        status: 'needs_decision',
      }),
      fee: feeRow(),
    })

    expect(draft?.status).toBe('needs_decision')
  })

  it('stores remittance fee vouchers with 3 lines and both source classification ids', () => {
    const draft = buildRemittanceFeeVoucherDraftFromPair({
      principal: principalRow(),
      fee: feeRow(),
    })
    expect(draft).not.toBeNull()

    const stored = buildStoredVoucherRecordsFromRemittanceFeeDraft({
      ...draft!,
      requestedPeriod: '2025-04',
      attributedPeriod: '2025-04',
      closePeriod: '2025-04~2025-06',
    }, {
      tenantId: 'tenant-1',
      journalEntryRunId: 'run-1',
      uploadSessionId: 'session-1',
      sourceBatchId: 'source_batch_session-1',
      requestedPeriod: '2025-04',
      attributedPeriod: '2025-04',
      closePeriod: '2025-04~2025-06',
      timestamp: '2026-06-01T00:00:00.000+09:00',
      voucherId: 'voucher-1',
      voucherNumber: '00001',
      lineIds: ['line-1', 'line-2', 'line-3'],
    })

    expect(stored.lines).toHaveLength(3)
    expect(stored.voucher.sourceBatchId).toBe('source_batch_session-1')
    expect(stored.voucher.sourceClassificationRowIds).toBe(JSON.stringify(['principal-row', 'fee-row']))
    expect(stored.lines.map((line) => line.accountCode)).toEqual(['103', '251', '831'])

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
    expect(displayLines.every((line) => line.voucherNumber === '00001')).toBe(true)
    expect(displayLines[0]).toMatchObject({
      side: 'credit',
      accountName: REMITTANCE_FEE_BANK_ACCOUNT_NAME,
      debitAmountKrw: 0,
      creditAmountKrw: 1_215_500,
    })
    expect(displayLines[2]).toMatchObject({
      side: 'debit',
      accountName: REMITTANCE_FEE_ACCOUNT_NAME,
      debitAmountKrw: 500,
      memo: REMITTANCE_FEE_MEMO,
    })
  })
})
