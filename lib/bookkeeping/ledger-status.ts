import { DateTime } from '@/lib/time'
import { type DisplayStatus } from '@/lib/status-tone'
import { resolveBookkeepingPeriodRangeSnapshot } from './period-range'
import type { FiscalLedgerMonthStatus } from './fiscal-year-ledger-rules'

// 자료검토 테이블의 `계정항목`/`전표분개` 컬럼은 fiscal-year ledger 누적 기준이다.
// getOrCreateFiscalYearLedgerSummary가 월 단위로 주는 단일 6단계 상태
// (not_requested → ... → journal_draft_ready)가 이미 계정항목 진행도와
// 전표분개 진행도를 순서대로 포함하고 있으므로, 새 신호를 더 모으지 않고 이
// 한 값을 두 컬럼 라벨로 나눠서 보여준다.
const STAGE_RANK: Record<FiscalLedgerMonthStatus, number> = {
  not_requested: 0,
  requested: 1,
  material_received: 2,
  classification_needed: 3,
  journal_needed: 4,
  journal_draft_ready: 5,
}

export function resolveSessionLedgerMonths(session: {
  accountingPeriod: string
  bookkeepingPeriodType: 'monthly' | 'quarterly' | 'yearly' | null
  bookkeepingPeriodStart: string | null
  bookkeepingPeriodEnd: string | null
}): { fiscalYear: number; months: string[] } | null {
  const range = resolveBookkeepingPeriodRangeSnapshot(session)
  if (!range) return null

  const startDate = DateTime.fromFormat(`${range.start}-01`, 'yyyy-MM-dd', { zone: 'Asia/Seoul' })
  const endDate = DateTime.fromFormat(`${range.end}-01`, 'yyyy-MM-dd', { zone: 'Asia/Seoul' })
  if (!startDate.isValid || !endDate.isValid) return null

  const months: string[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    months.push(cursor.toFormat('yyyy-MM'))
    cursor = cursor.plus({ months: 1 })
  }
  if (months.length === 0) return null

  return { fiscalYear: startDate.year, months }
}

// 기간이 분기/반기/연간으로 여러 달에 걸치면, 그 중 가장 덜 진행된 달의
// 단계로 전체 행의 상태를 표시한다(전부 끝나야 "완료"로 보이게).
export function pickLeastAdvancedLedgerStatus(
  statuses: FiscalLedgerMonthStatus[],
): FiscalLedgerMonthStatus | null {
  if (statuses.length === 0) return null
  return statuses.reduce((least, status) => (STAGE_RANK[status] < STAGE_RANK[least] ? status : least))
}

export function deriveAccountClassificationDisplayStatus(status: FiscalLedgerMonthStatus | null): DisplayStatus {
  if (status === null) {
    return { label: '대기', detail: '연결된 fiscal-year ledger 자료가 없습니다', tone: 'default' }
  }
  if (STAGE_RANK[status] >= STAGE_RANK.journal_needed) {
    return { label: '정리완료', detail: '계정항목 정리가 완료되었습니다', tone: 'success' }
  }
  if (status === 'classification_needed') {
    return { label: '정리필요', detail: '계정항목 정리가 필요합니다', tone: 'warning' }
  }
  return {
    label: '대기',
    detail: '귀속기간이 확정된 자료가 누적되면 계정항목 정리를 시작할 수 있습니다',
    tone: 'default',
  }
}

export function deriveJournalEntryDisplayStatus(status: FiscalLedgerMonthStatus | null): DisplayStatus {
  if (status === null) {
    return { label: '생성전', detail: '연결된 fiscal-year ledger 자료가 없습니다', tone: 'default' }
  }
  if (status === 'journal_draft_ready') {
    return { label: '전표초안', detail: '전표분개 초안이 생성되었습니다', tone: 'success' }
  }
  if (status === 'journal_needed') {
    return { label: '전표필요', detail: '계정항목 정리가 끝나 전표분개표를 생성할 수 있습니다', tone: 'warning' }
  }
  return {
    label: '생성전',
    detail: '계정항목 정리가 끝나야 전표분개표를 생성할 수 있습니다',
    tone: 'default',
  }
}
