import { describe, expect, it } from 'vitest'
import {
  buildJournalEntryVoucherExportAoa,
  buildStoredVoucherRecordsFromDraft,
  expandJournalEntryRowsToVoucherLines,
  formatJournalEntryVoucherNumber,
  mapStoredVoucherLinesToDisplayLines,
} from './journal-entry-voucher-lines'
import { PAYMENT_CLEARING_ACCOUNT } from './journal-entry-rules'

describe('journal entry voucher lines', () => {
  it('assigns the same voucher number to debit and credit lines from one journal row', () => {
    const lines = expandJournalEntryRowsToVoucherLines([{
      id: 'journal-row-1',
      entryDate: '2025-04-01',
      debitAccount: '보통예금',
      debitAmountKrw: 313845,
      creditAccount: '외상매출금',
      creditAmountKrw: 313845,
      counterparty: '네이버 주식회사',
      memo: '네이버페이정산',
    }])

    expect(lines).toHaveLength(2)
    expect(lines[0]?.voucherNumber).toBe('00001')
    expect(lines[1]?.voucherNumber).toBe('00001')
    expect(lines[0]).toMatchObject({
      side: 'debit',
      accountName: '보통예금',
      accountCode: '103',
      debitAmountKrw: 313845,
      creditAmountKrw: 0,
    })
    expect(lines[1]).toMatchObject({
      side: 'credit',
      accountName: '외상매출금',
      accountCode: '108',
      debitAmountKrw: 0,
      creditAmountKrw: 313845,
    })
  })

  it('increments voucher numbers across journal rows', () => {
    const lines = expandJournalEntryRowsToVoucherLines([
      {
        id: 'journal-row-1',
        entryDate: '2025-04-01',
        debitAccount: '광고선전비',
        debitAmountKrw: 110000,
        creditAccount: '보통예금/미지급금/카드미지급 검토',
        creditAmountKrw: 110000,
        counterparty: '카카오',
        memo: '광고비',
      },
      {
        id: 'journal-row-2',
        entryDate: '2025-04-02',
        debitAccount: '통신비',
        debitAmountKrw: 62190,
        creditAccount: '보통예금/미지급금/카드미지급 검토',
        creditAmountKrw: 62190,
        counterparty: 'LGU+',
        memo: '휴대폰',
      },
    ])

    expect(formatJournalEntryVoucherNumber(1)).toBe('00001')
    expect(lines.map((line) => line.voucherNumber)).toEqual(['00001', '00001', '00002', '00002'])
  })

  it('builds export rows with the attached workbook column order only', () => {
    const aoa = buildJournalEntryVoucherExportAoa(expandJournalEntryRowsToVoucherLines([{
      id: 'journal-row-1',
      entryDate: '2025-04-01',
      debitAccount: '보통예금',
      debitAmountKrw: 313845,
      creditAccount: '외상매출금',
      creditAmountKrw: 313845,
      counterparty: '네이버 주식회사',
      memo: '네이버페이정산',
    }]))

    expect(aoa[0]).toEqual([
      '전표일자', '전표번호', '구분', 'Code', '계정과목', '차변', '대변', '거래처', 'Code', '적요',
    ])
    expect(aoa[1]).toEqual([
      '2025-04-01', '00001', '차변', '103', '보통예금', 313845, 0, '네이버 주식회사', '', '네이버페이정산',
    ])
    expect(aoa[2]).toEqual([
      '2025-04-01', '00001', '대변', '108', '외상매출금', 0, 313845, '네이버 주식회사', '', '네이버페이정산',
    ])
  })

  it('maps stored voucher lines to the same display shape as legacy pair expansion', () => {
    const stored = buildStoredVoucherRecordsFromDraft({
      classificationRowId: 'classification-row-1',
      entryDate: '2025-04-01',
      debitAccount: '광고선전비',
      debitAmountKrw: 110000,
      creditAccount: PAYMENT_CLEARING_ACCOUNT,
      creditAmountKrw: 110000,
      counterparty: '카카오',
      memo: '광고비',
      status: 'draft',
      reason: '지출 거래 기본 분개 초안입니다.',
      staffMemo: null,
      requestedPeriod: '2026-05',
      attributedPeriod: '2026-05',
      closePeriod: '2026-04~2026-06',
    }, {
      tenantId: 'tenant-1',
      journalEntryRunId: 'run-1',
      uploadSessionId: 'session-1',
      requestedPeriod: '2026-05',
      attributedPeriod: '2026-05',
      closePeriod: '2026-04~2026-06',
      timestamp: '2026-06-01T00:00:00.000+09:00',
      voucherId: 'voucher-1',
      voucherNumber: '00001',
      debitLineId: 'line-debit-1',
      creditLineId: 'line-credit-1',
    })

    const displayLines = mapStoredVoucherLinesToDisplayLines(
      [{
        id: stored.voucher.id,
        voucherNumber: stored.voucher.voucherNumber,
        entryDate: stored.voucher.entryDate,
        status: stored.voucher.status,
      }],
      stored.lines,
    )

    const legacyLines = expandJournalEntryRowsToVoucherLines([{
      id: 'legacy-row-1',
      status: 'draft',
      entryDate: '2025-04-01',
      debitAccount: '광고선전비',
      debitAmountKrw: 110000,
      creditAccount: PAYMENT_CLEARING_ACCOUNT,
      creditAmountKrw: 110000,
      counterparty: '카카오',
      memo: '광고비',
    }])

    expect(displayLines.map(({ journalEntryRowId: _id, ...line }) => line)).toEqual(
      legacyLines.map(({ journalEntryRowId: _id, ...line }) => line),
    )
    expect(displayLines.find((line) => line.accountName === '광고선전비')?.accountCode).toBe('833')
    expect(stored.lines.every((line) => line.counterpartyCode === '')).toBe(true)
    expect(stored.lines.find((line) => line.accountName === '광고선전비')?.accountCode).toBe('833')
    expect(stored.lines.find((line) => line.accountName === PAYMENT_CLEARING_ACCOUNT)?.accountCode).toBe('')
    expect(stored.voucher.voucherNumber).toBe('00001')
    expect(stored.voucher.sourceClassificationRowIds).toBe(JSON.stringify(['classification-row-1']))
  })
})
