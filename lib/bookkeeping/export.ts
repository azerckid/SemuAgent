import { labelForBookkeepingAccountCategory } from './account-categories'
import {
  attributedMonthFromTransactionDate,
  isDisplayableClassificationRow,
} from './classification-rows'

export type ClassificationExportRow = {
  transactionDate: string | null
  direction: string
  merchantName: string | null
  description: string | null
  amountKrw: number | null
  sourceType: string
  recommendedAccount: string | null
  recommendationConfidence: string
  finalAccount: string | null
  status: string
  staffMemo: string | null
  recommendationReason: string | null
  sourceFilename?: string | null
}

export function formatClassificationRowsForExport(rows: ClassificationExportRow[]) {
  return rows.filter(isDisplayableClassificationRow).map((row) => ({
    거래일자: row.transactionDate ?? '',
    귀속월: attributedMonthFromTransactionDate(row.transactionDate),
    원천파일: row.sourceFilename ?? '',
    구분: row.direction === 'income' ? '입금' : row.direction === 'expense' ? '출금' : '미확인',
    거래처: row.merchantName ?? '',
    적요: row.description ?? '',
    입금: row.direction === 'income' ? row.amountKrw ?? '' : '',
    출금: row.direction === 'expense' ? row.amountKrw ?? '' : '',
    계정항목: labelForBookkeepingAccountCategory(row.finalAccount ?? row.recommendedAccount),
    AI추천: labelForBookkeepingAccountCategory(row.recommendedAccount),
    신뢰도: row.recommendationConfidence,
    상태: row.status,
    '추천 근거': row.recommendationReason ?? '',
  }))
}
