import type { JournalEntryDraftRow } from './journal-entry-rules'
import { lookupJournalEntryAccountCode, resolveJournalEntryAccountCode } from './journal-entry-account-codes'
import type { RemittanceFeeVoucherDraft } from './journal-entry-remittance-fee-rules'
import type { SalesVatVoucherDraft } from './journal-entry-sales-vat-rules'
import type { JournalEntryRowStatus } from './schemas'

export const JOURNAL_ENTRY_VOUCHER_EXPORT_HEADERS = [
  '전표일자',
  '전표번호',
  '구분',
  'Code',
  '계정과목',
  '차변',
  '대변',
  '거래처',
  'Code',
  '적요',
] as const

export type JournalEntryVoucherSourceRow = {
  id: string
  status?: JournalEntryRowStatus
  entryDate: string | null
  debitAccount: string | null
  debitAmountKrw: number | null
  creditAccount: string | null
  creditAmountKrw: number | null
  counterparty: string | null
  memo: string | null
}

export type JournalEntryVoucherLine = {
  journalEntryRowId: string
  voucherNumber: string
  voucherStatus: JournalEntryRowStatus
  side: 'debit' | 'credit'
  entryDate: string
  accountCode: string
  accountName: string
  debitAmountKrw: number
  creditAmountKrw: number
  counterparty: string
  counterpartyCode: string
  memo: string
}

export type StoredJournalEntryVoucher = {
  id: string
  voucherNumber: string
  entryDate: string | null
  status: JournalEntryRowStatus
}

export type StoredJournalEntryVoucherLine = {
  id: string
  voucherId: string
  lineSequence: number
  side: 'debit' | 'credit'
  accountName: string | null
  accountCode: string | null
  amountKrw: number
  counterparty: string | null
  counterpartyCode: string | null
  memo: string | null
}

export type JournalEntryVoucherDraftContext = {
  tenantId: string
  journalEntryRunId: string
  uploadSessionId: string
  requestedPeriod: string
  attributedPeriod: string | null
  closePeriod: string
  timestamp: string
}

export function encodeSourceClassificationRowIds(rowIds: string[]) {
  return JSON.stringify(rowIds)
}

export function buildStoredVoucherRecordsFromDraft(
  draft: JournalEntryDraftRow & {
    requestedPeriod: string
    attributedPeriod: string | null
    closePeriod: string
  },
  params: JournalEntryVoucherDraftContext & {
    voucherId: string
    voucherNumber: string
    debitLineId: string
    creditLineId: string
  },
) {
  const counterparty = draft.counterparty ?? ''
  const memo = draft.memo ?? ''

  return {
    voucher: {
      id: params.voucherId,
      tenantId: params.tenantId,
      journalEntryRunId: params.journalEntryRunId,
      uploadSessionId: params.uploadSessionId,
      classificationRowId: draft.classificationRowId,
      sourceClassificationRowIds: encodeSourceClassificationRowIds([draft.classificationRowId]),
      voucherNumber: params.voucherNumber,
      entryDate: draft.entryDate,
      requestedPeriod: draft.requestedPeriod,
      attributedPeriod: draft.attributedPeriod,
      closePeriod: draft.closePeriod,
      status: draft.status,
      reason: draft.reason,
      staffMemo: draft.staffMemo,
      confirmedByStaffId: null as string | null,
      confirmedAt: null as string | null,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
    lines: [
      {
        id: params.debitLineId,
        tenantId: params.tenantId,
        voucherId: params.voucherId,
        lineSequence: 1,
        side: 'debit' as const,
        accountName: draft.debitAccount,
        accountCode: lookupJournalEntryAccountCode(draft.debitAccount),
        amountKrw: draft.debitAmountKrw ?? 0,
        counterparty,
        counterpartyCode: '',
        memo,
        createdAt: params.timestamp,
        updatedAt: params.timestamp,
      },
      {
        id: params.creditLineId,
        tenantId: params.tenantId,
        voucherId: params.voucherId,
        lineSequence: 2,
        side: 'credit' as const,
        accountName: draft.creditAccount,
        accountCode: lookupJournalEntryAccountCode(draft.creditAccount),
        amountKrw: draft.creditAmountKrw ?? 0,
        counterparty,
        counterpartyCode: '',
        memo,
        createdAt: params.timestamp,
        updatedAt: params.timestamp,
      },
    ],
  }
}

export function buildStoredVoucherRecordsFromSalesVatDraft(
  draft: SalesVatVoucherDraft & {
    requestedPeriod: string
    attributedPeriod: string | null
    closePeriod: string
  },
  params: JournalEntryVoucherDraftContext & {
    voucherId: string
    voucherNumber: string
    lineIds: string[]
  },
) {
  const counterparty = draft.counterparty ?? ''

  return {
    voucher: {
      id: params.voucherId,
      tenantId: params.tenantId,
      journalEntryRunId: params.journalEntryRunId,
      uploadSessionId: params.uploadSessionId,
      classificationRowId: draft.classificationRowId,
      sourceClassificationRowIds: encodeSourceClassificationRowIds([draft.classificationRowId]),
      voucherNumber: params.voucherNumber,
      entryDate: draft.entryDate,
      requestedPeriod: draft.requestedPeriod,
      attributedPeriod: draft.attributedPeriod,
      closePeriod: draft.closePeriod,
      status: draft.status,
      reason: draft.reason,
      staffMemo: draft.staffMemo,
      confirmedByStaffId: null as string | null,
      confirmedAt: null as string | null,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
    lines: draft.lines.map((line, index) => ({
      id: params.lineIds[index] ?? `${params.voucherId}-line-${line.lineSequence}`,
      tenantId: params.tenantId,
      voucherId: params.voucherId,
      lineSequence: line.lineSequence,
      side: line.side,
      accountName: line.accountName,
      accountCode: lookupJournalEntryAccountCode(line.accountName),
      amountKrw: line.amountKrw,
      counterparty,
      counterpartyCode: '',
      memo: line.memo,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    })),
  }
}

export function buildStoredVoucherRecordsFromRemittanceFeeDraft(
  draft: RemittanceFeeVoucherDraft & {
    requestedPeriod: string
    attributedPeriod: string | null
    closePeriod: string
  },
  params: JournalEntryVoucherDraftContext & {
    voucherId: string
    voucherNumber: string
    lineIds: string[]
  },
) {
  const counterparty = draft.counterparty ?? ''

  return {
    voucher: {
      id: params.voucherId,
      tenantId: params.tenantId,
      journalEntryRunId: params.journalEntryRunId,
      uploadSessionId: params.uploadSessionId,
      classificationRowId: draft.principalClassificationRowId,
      sourceClassificationRowIds: encodeSourceClassificationRowIds([
        draft.principalClassificationRowId,
        draft.feeClassificationRowId,
      ]),
      voucherNumber: params.voucherNumber,
      entryDate: draft.entryDate,
      requestedPeriod: draft.requestedPeriod,
      attributedPeriod: draft.attributedPeriod,
      closePeriod: draft.closePeriod,
      status: draft.status,
      reason: draft.reason,
      staffMemo: draft.staffMemo,
      confirmedByStaffId: null as string | null,
      confirmedAt: null as string | null,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
    lines: draft.lines.map((line, index) => ({
      id: params.lineIds[index] ?? `${params.voucherId}-line-${line.lineSequence}`,
      tenantId: params.tenantId,
      voucherId: params.voucherId,
      lineSequence: line.lineSequence,
      side: line.side,
      accountName: line.accountName,
      accountCode: lookupJournalEntryAccountCode(line.accountName),
      amountKrw: line.amountKrw,
      counterparty,
      counterpartyCode: '',
      memo: line.memo,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    })),
  }
}

export function mapStoredVoucherLinesToDisplayLines(
  vouchers: StoredJournalEntryVoucher[],
  lines: StoredJournalEntryVoucherLine[],
): JournalEntryVoucherLine[] {
  const linesByVoucherId = new Map<string, StoredJournalEntryVoucherLine[]>()

  for (const line of lines) {
    linesByVoucherId.set(line.voucherId, [...(linesByVoucherId.get(line.voucherId) ?? []), line])
  }

  return vouchers.flatMap((voucher) => {
    const voucherLines = (linesByVoucherId.get(voucher.id) ?? []).sort((a, b) => a.lineSequence - b.lineSequence)
    const entryDate = voucher.entryDate ?? ''

    return voucherLines.map((line) => ({
      journalEntryRowId: voucher.id,
      voucherNumber: voucher.voucherNumber,
      voucherStatus: voucher.status,
      side: line.side,
      entryDate,
      accountCode: resolveJournalEntryAccountCode({
        accountName: line.accountName,
        storedAccountCode: line.accountCode,
      }),
      accountName: line.accountName ?? '',
      debitAmountKrw: line.side === 'debit' ? line.amountKrw : 0,
      creditAmountKrw: line.side === 'credit' ? line.amountKrw : 0,
      counterparty: line.counterparty ?? '',
      counterpartyCode: line.counterpartyCode ?? '',
      memo: line.memo ?? '',
    }))
  })
}

export function formatJournalEntryVoucherNumber(index: number) {
  return String(index).padStart(5, '0')
}

export function expandJournalEntryRowsToVoucherLines(rows: JournalEntryVoucherSourceRow[]) {
  return rows.flatMap((row, index): JournalEntryVoucherLine[] => {
    const voucherNumber = formatJournalEntryVoucherNumber(index + 1)
    const entryDate = row.entryDate ?? ''
    const counterparty = row.counterparty ?? ''
    const memo = row.memo ?? ''
    const voucherStatus = row.status ?? 'draft'

    return [
      {
        journalEntryRowId: row.id,
        voucherNumber,
        voucherStatus,
        side: 'debit',
        entryDate,
        accountCode: lookupJournalEntryAccountCode(row.debitAccount),
        accountName: row.debitAccount ?? '',
        debitAmountKrw: row.debitAmountKrw ?? 0,
        creditAmountKrw: 0,
        counterparty,
        counterpartyCode: '',
        memo,
      },
      {
        journalEntryRowId: row.id,
        voucherNumber,
        voucherStatus,
        side: 'credit',
        entryDate,
        accountCode: lookupJournalEntryAccountCode(row.creditAccount),
        accountName: row.creditAccount ?? '',
        debitAmountKrw: 0,
        creditAmountKrw: row.creditAmountKrw ?? 0,
        counterparty,
        counterpartyCode: '',
        memo,
      },
    ]
  })
}

export function journalEntryVoucherLineToExportRow(line: JournalEntryVoucherLine): (string | number)[] {
  return [
    line.entryDate,
    line.voucherNumber,
    line.side === 'debit' ? '차변' : '대변',
    line.accountCode,
    line.accountName,
    line.debitAmountKrw,
    line.creditAmountKrw,
    line.counterparty,
    line.counterpartyCode,
    line.memo,
  ]
}

export function buildJournalEntryVoucherExportAoa(lines: JournalEntryVoucherLine[]) {
  return [
    [...JOURNAL_ENTRY_VOUCHER_EXPORT_HEADERS],
    ...lines.map(journalEntryVoucherLineToExportRow),
  ]
}

export function formatJournalEntryVoucherLinesForExport(rows: JournalEntryVoucherSourceRow[]) {
  return buildJournalEntryVoucherExportAoa(expandJournalEntryRowsToVoucherLines(rows))
}
