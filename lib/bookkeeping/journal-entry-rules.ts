import { labelForBookkeepingAccountCategory } from './account-categories'
import {
  formatJournalEntryVoucherLinesForExport,
  type JournalEntryVoucherSourceRow,
} from './journal-entry-voucher-lines'
import type { JournalEntryRowStatus } from './schemas'

export const JOURNAL_ENTRY_RULES_SNAPSHOT = [
  '기장 전표 분개표 초안 생성 규칙 v3',
  '- 지출: 차변 최종 계정, 대변 보통예금/미지급금/카드미지급 검토',
  '- 수입: 차변 보통예금/미수금 검토, 대변 최종 계정',
  '- 송금수수료 페어(본금+수수료 별도 행): 대변 보통예금 = 본금+수수료, 차변 본금계정+지급수수료(판)',
  '- 매출 세금계산서(tax_invoice/매출 세금계산서, gross 10% 분리 가능): 대변 부가세예수금+상품매출, 차변 외상매출금',
  '- 통장/PG/현금영수증 정산 입금은 매출+부가세 3줄 규칙에서 제외한다.',
  '- 방향/계정이 불명확하면 담당자 판단 상태로 둔다.',
  '- 세무 신고 또는 더존 업로드 완료를 의미하지 않는다.',
].join('\n')

export const RECEIPT_CLEARING_ACCOUNT = '보통예금/미수금 검토'
export const PAYMENT_CLEARING_ACCOUNT = '보통예금/미지급금/카드미지급 검토'

export type JournalEntrySourceRow = {
  id: string
  transactionDate: string | null
  merchantName: string | null
  description: string | null
  amountKrw: number | null
  direction: 'income' | 'expense' | 'unknown'
  recommendedAccount: string | null
  finalAccount: string | null
  status: 'suggested' | 'needs_decision' | 'confirmed' | 'unclassified' | 'excluded'
  staffMemo: string | null
}

export type JournalEntryDraftRow = {
  classificationRowId: string
  entryDate: string | null
  debitAccount: string | null
  debitAmountKrw: number | null
  creditAccount: string | null
  creditAmountKrw: number | null
  counterparty: string | null
  memo: string | null
  status: JournalEntryRowStatus
  reason: string | null
  staffMemo: string | null
}

export function buildJournalEntryDraftRow(row: JournalEntrySourceRow): JournalEntryDraftRow | null {
  if (row.status === 'excluded') return null

  const accountKey = row.finalAccount ?? row.recommendedAccount
  const accountLabel = labelForBookkeepingAccountCategory(accountKey)
  const amount = row.amountKrw
  const needsDecision =
    !accountKey ||
    accountKey === 'unclassified' ||
    !amount ||
    row.direction === 'unknown'

  if (row.direction === 'expense') {
    return {
      classificationRowId: row.id,
      entryDate: row.transactionDate,
      debitAccount: accountLabel || null,
      debitAmountKrw: amount ?? null,
      creditAccount: PAYMENT_CLEARING_ACCOUNT,
      creditAmountKrw: amount ?? null,
      counterparty: row.merchantName,
      memo: row.description,
      status: needsDecision ? 'needs_decision' : 'draft',
      reason: needsDecision ? '계정항목 또는 거래 방향을 담당자가 확인해야 합니다.' : '지출 거래 기본 분개 초안입니다.',
      staffMemo: row.staffMemo,
    }
  }

  if (row.direction === 'income') {
    return {
      classificationRowId: row.id,
      entryDate: row.transactionDate,
      debitAccount: RECEIPT_CLEARING_ACCOUNT,
      debitAmountKrw: amount ?? null,
      creditAccount: accountLabel || null,
      creditAmountKrw: amount ?? null,
      counterparty: row.merchantName,
      memo: row.description,
      status: needsDecision ? 'needs_decision' : 'draft',
      reason: needsDecision ? '계정항목 또는 거래 방향을 담당자가 확인해야 합니다.' : '수입 거래 기본 분개 초안입니다.',
      staffMemo: row.staffMemo,
    }
  }

  return {
    classificationRowId: row.id,
    entryDate: row.transactionDate,
    debitAccount: accountLabel || null,
    debitAmountKrw: amount ?? null,
    creditAccount: null,
    creditAmountKrw: null,
    counterparty: row.merchantName,
    memo: row.description,
    status: 'needs_decision',
    reason: '거래 방향을 확인할 수 없어 대변 계정을 담당자가 지정해야 합니다.',
    staffMemo: row.staffMemo,
  }
}

export type JournalEntryExportRow = JournalEntryVoucherSourceRow

export function formatJournalEntryRowsForExport(rows: JournalEntryExportRow[]) {
  return formatJournalEntryVoucherLinesForExport(rows)
}
