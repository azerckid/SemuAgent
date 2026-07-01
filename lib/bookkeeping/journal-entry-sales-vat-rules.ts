import {
  type JournalEntryDraftRow,
  type JournalEntrySourceRow,
} from './journal-entry-rules'
import type { JournalEntryRowStatus } from './schemas'

export const SALES_VAT_AR_ACCOUNT_NAME = '외상매출금'
export const SALES_VAT_SALES_ACCOUNT_NAME = '상품매출'
export const SALES_VAT_PAYABLE_ACCOUNT_NAME = '부가세예수금'
export const SALES_TAX_INVOICE_SIGNAL = '매출 세금계산서'

export type ClassificationSourceType = 'bank' | 'card' | 'receipt' | 'tax_invoice' | 'other'

export type JournalEntryClassificationSourceRow = JournalEntrySourceRow & {
  sourceType: ClassificationSourceType
}

export type SalesVatVoucherLineDraft = {
  lineSequence: number
  side: 'debit' | 'credit'
  accountName: string
  amountKrw: number
  memo: string
}

export type SalesVatVoucherDraft = {
  classificationRowId: string
  entryDate: string | null
  counterparty: string | null
  status: JournalEntryRowStatus
  reason: string | null
  staffMemo: string | null
  lines: SalesVatVoucherLineDraft[]
}

const EXCLUDED_SOURCE_TYPES = new Set<ClassificationSourceType>(['bank', 'card', 'receipt'])

function accountKey(row: JournalEntrySourceRow) {
  return row.finalAccount ?? row.recommendedAccount
}

function rowText(row: JournalEntrySourceRow) {
  return [row.description, row.merchantName].filter(Boolean).join(' ')
}

export function splitGrossSupplyAndVat(gross: number): { supply: number; vat: number } | null {
  if (!Number.isInteger(gross) || gross <= 0) return null
  if ((gross * 10) % 11 !== 0) return null

  const supply = (gross * 10) / 11
  const vat = gross - supply
  if (!Number.isInteger(supply) || !Number.isInteger(vat)) return null
  if (supply <= 0 || vat <= 0) return null
  if (vat * 10 !== supply) return null

  return { supply, vat }
}

export function isSalesVatExcludedSourceType(sourceType: ClassificationSourceType) {
  return EXCLUDED_SOURCE_TYPES.has(sourceType)
}

export function containsSalesTaxInvoiceSignal(row: JournalEntrySourceRow) {
  const text = rowText(row)
  return text.includes(SALES_TAX_INVOICE_SIGNAL) || text.includes('매출세금계산서')
}

export function hasSalesVatSourceSignal(row: JournalEntryClassificationSourceRow) {
  return row.sourceType === 'tax_invoice' || containsSalesTaxInvoiceSignal(row)
}

export function isSalesVatCandidate(row: JournalEntryClassificationSourceRow) {
  if (row.status === 'excluded') return false
  if (row.direction !== 'income') return false
  if (isSalesVatExcludedSourceType(row.sourceType)) return false
  if (accountKey(row) !== 'sales') return false
  if (!hasSalesVatSourceSignal(row)) return false

  const gross = row.amountKrw
  if (!gross || gross <= 0) return false

  return splitGrossSupplyAndVat(gross) !== null
}

export function buildSalesVatVoucherDraft(params: {
  source: JournalEntryClassificationSourceRow
  draft: JournalEntryDraftRow
}): SalesVatVoucherDraft | null {
  if (!isSalesVatCandidate(params.source)) return null

  const gross = params.source.amountKrw
  if (!gross) return null

  const split = splitGrossSupplyAndVat(gross)
  if (!split) return null

  const needsDecision =
    params.source.status === 'needs_decision' ||
    params.draft.status === 'needs_decision'

  const memo = params.draft.memo ?? params.source.description ?? ''

  return {
    classificationRowId: params.source.id,
    entryDate: params.source.transactionDate,
    counterparty: params.draft.counterparty ?? params.source.merchantName,
    status: needsDecision ? 'needs_decision' : 'draft',
    reason: needsDecision
      ? '매출 세금계산서 전표이나 계정항목 확인이 필요합니다.'
      : '매출 세금계산서 3줄 전표 초안입니다.',
    staffMemo: params.draft.staffMemo,
    lines: [
      {
        lineSequence: 1,
        side: 'credit',
        accountName: SALES_VAT_PAYABLE_ACCOUNT_NAME,
        amountKrw: split.vat,
        memo,
      },
      {
        lineSequence: 2,
        side: 'credit',
        accountName: SALES_VAT_SALES_ACCOUNT_NAME,
        amountKrw: split.supply,
        memo,
      },
      {
        lineSequence: 3,
        side: 'debit',
        accountName: SALES_VAT_AR_ACCOUNT_NAME,
        amountKrw: gross,
        memo,
      },
    ],
  }
}
