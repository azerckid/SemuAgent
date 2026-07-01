import {
  buildJournalEntryDraftRow,
  type JournalEntryDraftRow,
  type JournalEntrySourceRow,
} from './journal-entry-rules'
import type { JournalEntryRowStatus } from './schemas'

export const REMITTANCE_FEE_ACCOUNT_NAME = '지급수수료(판)'
export const REMITTANCE_FEE_BANK_ACCOUNT_NAME = '보통예금'
export const REMITTANCE_FEE_MEMO = '송금수수료'
export const REMITTANCE_FEE_MAX_AMOUNT_KRW = 10_000
export const PAYABLE_ACCOUNT_NAME = '미지급금'
export const PURCHASE_PAYABLE_ACCOUNT_NAME = '외상매입금'

export type RemittanceFeePair = {
  principal: JournalEntrySourceRow
  fee: JournalEntrySourceRow
}

export type RemittanceFeeVoucherLineDraft = {
  lineSequence: number
  side: 'debit' | 'credit'
  accountName: string
  amountKrw: number
  memo: string
}

export type RemittanceFeeVoucherDraft = {
  principalClassificationRowId: string
  feeClassificationRowId: string
  entryDate: string | null
  counterparty: string | null
  status: JournalEntryRowStatus
  reason: string | null
  staffMemo: string | null
  lines: RemittanceFeeVoucherLineDraft[]
}

function accountKey(row: JournalEntrySourceRow) {
  return row.finalAccount ?? row.recommendedAccount
}

function rowText(row: JournalEntrySourceRow) {
  return [row.description, row.merchantName].filter(Boolean).join(' ')
}

export function containsRemittanceFeeText(row: JournalEntrySourceRow) {
  return rowText(row).includes(REMITTANCE_FEE_MEMO)
}

export function isRemittanceFeeCandidate(row: JournalEntrySourceRow) {
  if (row.status === 'excluded') return false
  if (row.direction !== 'expense') return false
  if (accountKey(row) !== 'fees') return false
  if (!containsRemittanceFeeText(row)) return false

  const amount = row.amountKrw
  return Boolean(amount && amount > 0 && amount <= REMITTANCE_FEE_MAX_AMOUNT_KRW)
}

export function isRemittancePrincipalCandidate(row: JournalEntrySourceRow) {
  if (row.status === 'excluded') return false
  if (row.direction !== 'expense') return false
  if (isRemittanceFeeCandidate(row)) return false

  const key = accountKey(row)
  if (!key || key === 'fees' || key === 'unclassified') return false

  const amount = row.amountKrw
  return Boolean(amount && amount > 0)
}

function eligiblePrincipalsForFee(
  fee: JournalEntrySourceRow,
  principals: JournalEntrySourceRow[],
) {
  return principals.filter((principal) =>
    principal.transactionDate !== null &&
    principal.transactionDate === fee.transactionDate &&
    (principal.amountKrw ?? 0) > (fee.amountKrw ?? 0),
  )
}

function eligibleFeesForPrincipal(
  principal: JournalEntrySourceRow,
  fees: JournalEntrySourceRow[],
) {
  return fees.filter((fee) =>
    fee.transactionDate !== null &&
    fee.transactionDate === principal.transactionDate &&
    (principal.amountKrw ?? 0) > (fee.amountKrw ?? 0),
  )
}

export function findRemittanceFeePairs(rows: JournalEntrySourceRow[]): RemittanceFeePair[] {
  const fees = rows.filter(isRemittanceFeeCandidate)
  const principals = rows.filter(isRemittancePrincipalCandidate)
  const pairs: RemittanceFeePair[] = []
  const usedFeeIds = new Set<string>()
  const usedPrincipalIds = new Set<string>()

  for (const fee of fees) {
    if (usedFeeIds.has(fee.id)) continue

    const eligiblePrincipals = eligiblePrincipalsForFee(fee, principals)
      .filter((principal) => !usedPrincipalIds.has(principal.id))

    if (eligiblePrincipals.length !== 1) continue

    const principal = eligiblePrincipals[0]!
    const eligibleFees = eligibleFeesForPrincipal(principal, fees)
      .filter((candidate) => !usedFeeIds.has(candidate.id))

    if (eligibleFees.length !== 1 || eligibleFees[0]!.id !== fee.id) continue

    pairs.push({ principal, fee })
    usedFeeIds.add(fee.id)
    usedPrincipalIds.add(principal.id)
  }

  return pairs
}

export function resolveRemittancePrincipalDebitAccountName(
  principal: JournalEntrySourceRow,
  principalDraft: JournalEntryDraftRow,
): string | null {
  const key = accountKey(principal)
  if (!key || key === 'unclassified') return null

  if (key === 'purchase_goods') {
    return PURCHASE_PAYABLE_ACCOUNT_NAME
  }

  const draftDebit = principalDraft.debitAccount?.trim()
  if (draftDebit && principalDraft.status !== 'needs_decision') {
    return draftDebit
  }

  return PAYABLE_ACCOUNT_NAME
}

export function buildRemittanceFeeVoucherDraft(params: {
  principal: JournalEntrySourceRow
  fee: JournalEntrySourceRow
  principalDraft: JournalEntryDraftRow
}): RemittanceFeeVoucherDraft | null {
  const principalAmount = params.principal.amountKrw
  const feeAmount = params.fee.amountKrw
  if (!principalAmount || !feeAmount) return null

  const principalDebitAccount = resolveRemittancePrincipalDebitAccountName(
    params.principal,
    params.principalDraft,
  )

  const needsDecision =
    !principalDebitAccount ||
    params.principalDraft.status === 'needs_decision' ||
    params.principal.status === 'needs_decision' ||
    params.fee.status === 'needs_decision'

  const counterparty = params.principalDraft.counterparty ?? params.principal.merchantName
  const principalMemo = params.principalDraft.memo ?? params.principal.description ?? ''
  const creditAmount = principalAmount + feeAmount

  return {
    principalClassificationRowId: params.principal.id,
    feeClassificationRowId: params.fee.id,
    entryDate: params.principal.transactionDate,
    counterparty,
    status: needsDecision ? 'needs_decision' : 'draft',
    reason: needsDecision
      ? '송금수수료 페어 전표이나 본금 계정 또는 계정항목 확인이 필요합니다.'
      : '송금수수료 페어 3줄 전표 초안입니다.',
    staffMemo: params.principalDraft.staffMemo ?? params.fee.staffMemo,
    lines: [
      {
        lineSequence: 1,
        side: 'credit',
        accountName: REMITTANCE_FEE_BANK_ACCOUNT_NAME,
        amountKrw: creditAmount,
        memo: principalMemo,
      },
      {
        lineSequence: 2,
        side: 'debit',
        accountName: principalDebitAccount ?? PAYABLE_ACCOUNT_NAME,
        amountKrw: principalAmount,
        memo: principalMemo,
      },
      {
        lineSequence: 3,
        side: 'debit',
        accountName: REMITTANCE_FEE_ACCOUNT_NAME,
        amountKrw: feeAmount,
        memo: REMITTANCE_FEE_MEMO,
      },
    ],
  }
}

export function buildRemittanceFeeVoucherDraftFromPair(pair: RemittanceFeePair) {
  const principalDraft = buildJournalEntryDraftRow(pair.principal)
  if (!principalDraft) return null
  return buildRemittanceFeeVoucherDraft({
    principal: pair.principal,
    fee: pair.fee,
    principalDraft,
  })
}

export function collectRemittanceFeePairedClassificationRowIds(pairs: RemittanceFeePair[]) {
  return new Set(pairs.flatMap((pair) => [pair.principal.id, pair.fee.id]))
}
