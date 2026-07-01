import { describe, expect, it } from 'vitest'
import {
  buildJournalEntryDraftRow,
  formatJournalEntryRowsForExport,
  PAYMENT_CLEARING_ACCOUNT,
  RECEIPT_CLEARING_ACCOUNT,
} from './journal-entry-rules'

describe('bookkeeping journal entry rules', () => {
  it('builds a draft expense journal entry from a confirmed classification row', () => {
    const row = buildJournalEntryDraftRow({
      id: 'classification-row-1',
      transactionDate: '2026-05-12',
      merchantName: '카카오',
      description: '광고비 결제',
      amountKrw: 110000,
      direction: 'expense',
      recommendedAccount: 'advertising',
      finalAccount: 'advertising',
      status: 'confirmed',
      staffMemo: null,
    })

    expect(row).toMatchObject({
      classificationRowId: 'classification-row-1',
      debitAccount: '광고선전비',
      debitAmountKrw: 110000,
      creditAccount: PAYMENT_CLEARING_ACCOUNT,
      creditAmountKrw: 110000,
      status: 'draft',
    })
  })

  it('builds a draft income journal entry from a confirmed classification row', () => {
    const row = buildJournalEntryDraftRow({
      id: 'classification-row-2',
      transactionDate: '2026-05-13',
      merchantName: '네이버페이',
      description: '온라인 매출 정산',
      amountKrw: 250000,
      direction: 'income',
      recommendedAccount: 'sales',
      finalAccount: 'sales',
      status: 'confirmed',
      staffMemo: null,
    })

    expect(row).toMatchObject({
      classificationRowId: 'classification-row-2',
      debitAccount: RECEIPT_CLEARING_ACCOUNT,
      debitAmountKrw: 250000,
      creditAccount: '매출',
      creditAmountKrw: 250000,
      status: 'draft',
    })
  })

  it('builds a draft journal entry from a suggested classification row when account, amount, and direction are usable', () => {
    const row = buildJournalEntryDraftRow({
      id: 'classification-row-suggested',
      transactionDate: '2026-05-13',
      merchantName: 'KCP',
      description: '온라인 매출 정산',
      amountKrw: 250000,
      direction: 'income',
      recommendedAccount: 'sales',
      finalAccount: 'sales',
      status: 'suggested',
      staffMemo: null,
    })

    expect(row).toMatchObject({
      classificationRowId: 'classification-row-suggested',
      debitAccount: RECEIPT_CLEARING_ACCOUNT,
      creditAccount: '매출',
      debitAmountKrw: 250000,
      creditAmountKrw: 250000,
      status: 'draft',
    })
  })

  it('keeps rows without usable direction and account as needs_decision', () => {
    const row = buildJournalEntryDraftRow({
      id: 'classification-row-3',
      transactionDate: '2026-05-14',
      merchantName: '거래처',
      description: '분류 필요',
      amountKrw: 30000,
      direction: 'unknown',
      recommendedAccount: null,
      finalAccount: null,
      status: 'suggested',
      staffMemo: null,
    })

    expect(row).toMatchObject({
      classificationRowId: 'classification-row-3',
      status: 'needs_decision',
      creditAccount: null,
    })
  })

  it('omits excluded classification rows', () => {
    const row = buildJournalEntryDraftRow({
      id: 'classification-row-4',
      transactionDate: '2026-05-15',
      merchantName: '테스트',
      description: '제외',
      amountKrw: 1000,
      direction: 'expense',
      recommendedAccount: 'supplies',
      finalAccount: 'supplies',
      status: 'excluded',
      staffMemo: '중복',
    })

    expect(row).toBeNull()
  })

  it('formats rows for voucher-style xlsx export', () => {
    const aoa = formatJournalEntryRowsForExport([{
      id: 'journal-row-1',
      entryDate: '2025-04-01',
      debitAccount: '보통예금',
      debitAmountKrw: 313845,
      creditAccount: '외상매출금',
      creditAmountKrw: 313845,
      counterparty: '네이버 주식회사',
      memo: '네이버페이정산',
    }])

    expect(aoa[1]).toEqual([
      '2025-04-01', '00001', '차변', '103', '보통예금', 313845, 0, '네이버 주식회사', '', '네이버페이정산',
    ])
    expect(aoa[2]).toEqual([
      '2025-04-01', '00001', '대변', '108', '외상매출금', 0, 313845, '네이버 주식회사', '', '네이버페이정산',
    ])
  })
})
