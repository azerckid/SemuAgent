import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingClassificationRun,
  bookkeepingFiscalYearLedger,
} from '@/lib/db/schema'
import { attributedMonthFromTransactionDate } from './classification-rows'
import { loadClassificationRowsForRun } from './classification-run-lifecycle'
import { listLedgerAcceptedMaterials } from './fiscal-year-ledger-accepted-materials'
import { resolveLedgerPeriodRange, type LedgerPeriodRange } from './fiscal-year-ledger-rules'

type ClassificationRunRow = typeof bookkeepingClassificationRun.$inferSelect
type ClassificationDisplayRow = Awaited<ReturnType<typeof loadClassificationRowsForRun>>[number]

export type AccumulatedClassificationRow = ClassificationDisplayRow & { periodMonth: string }

export type AccumulatedClassificationResult =
  | {
      ok: true
      ledger: { id: string; tenantId: string; clientId: string; fiscalYear: number }
      period: LedgerPeriodRange
      sessionCount: number
      excludedUnknownDateCount: number
      excludedNotAcceptedFileCount: number
      rows: AccumulatedClassificationRow[]
    }
  | { ok: false; status: number; error: string }

export async function listAccumulatedClassificationRows(params: {
  tenantId: string
  ledgerId: string
  period?: string | null
}): Promise<AccumulatedClassificationResult> {
  const [ledger] = await db
    .select()
    .from(bookkeepingFiscalYearLedger)
    .where(
      and(
        eq(bookkeepingFiscalYearLedger.id, params.ledgerId),
        eq(bookkeepingFiscalYearLedger.tenantId, params.tenantId),
      ),
    )
    .limit(1)

  if (!ledger) return { ok: false, status: 404, error: '회계연도 장부를 찾을 수 없습니다.' }

  const period = resolveLedgerPeriodRange(ledger.fiscalYear, params.period)
  if (!period) return { ok: false, status: 400, error: '기간 형식이 올바르지 않거나 장부의 회계연도와 다릅니다.' }

  const ledgerSummary = {
    id: ledger.id,
    tenantId: ledger.tenantId,
    clientId: ledger.clientId,
    fiscalYear: ledger.fiscalYear,
  }

  const links = await listLedgerAcceptedMaterials({
    tenantId: params.tenantId,
    ledgerId: params.ledgerId,
    clientId: ledger.clientId,
    period,
  })

  const sessionIds = [...new Set(links.map((link) => link.uploadSessionId))]

  if (sessionIds.length === 0) {
    return {
      ok: true,
      ledger: ledgerSummary,
      period,
      sessionCount: 0,
      excludedUnknownDateCount: 0,
      excludedNotAcceptedFileCount: 0,
      rows: [],
    }
  }

  // 분류 run은 attribution 결정이 바뀌거나 재머지된 뒤에도 그대로 남아있을 수 있다(stale).
  // 같은 세션 안에 include/exclude 파일이 섞여 있을 수도 있으므로, "지금" status='included'인
  // material_link의 uploadFileId 집합으로 분류 행을 한 번 더 걸러서 누적 view에는 현재
  // 실제로 받아들여진 자료만 보이게 한다. fileId가 없는 link만 있는 세션은(드문 경우) 비교할
  // 기준이 없으므로 세션·기간 필터만 적용한다.
  const acceptedFileIdsBySession = new Map<string, Set<string>>()
  for (const link of links) {
    if (!link.uploadFileId) continue
    const set = acceptedFileIdsBySession.get(link.uploadSessionId) ?? new Set<string>()
    set.add(link.uploadFileId)
    acceptedFileIdsBySession.set(link.uploadSessionId, set)
  }

  // 세션마다 "현재 보여줄" 계정항목 정리 결과는 최신 completed run 하나뿐이다
  // (기존 단일 세션 뷰의 displayRun과 같은 기준). 진행 중/실패/superseded run은 제외한다.
  const runs = await db
    .select()
    .from(bookkeepingClassificationRun)
    .where(
      and(
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.status, 'completed'),
        inArray(bookkeepingClassificationRun.uploadSessionId, sessionIds),
      ),
    )

  const latestRunBySession = new Map<string, ClassificationRunRow>()
  for (const run of runs) {
    const current = latestRunBySession.get(run.uploadSessionId)
    if (!current || run.createdAt > current.createdAt) {
      latestRunBySession.set(run.uploadSessionId, run)
    }
  }

  let excludedUnknownDateCount = 0
  let excludedNotAcceptedFileCount = 0
  const rows: AccumulatedClassificationRow[] = []

  for (const run of latestRunBySession.values()) {
    const acceptedFileIds = acceptedFileIdsBySession.get(run.uploadSessionId) ?? null
    const runRows = await loadClassificationRowsForRun({ tenantId: params.tenantId, runId: run.id })
    for (const row of runRows) {
      // 분류 run은 attribution이 재실행되거나 결정이 바뀐 뒤에도 그대로일 수 있어서(stale),
      // "지금" included된 파일만 통과시킨다. acceptedFileIds가 없는 세션은(파일 단위 link
      // 정보가 없는 드문 경우) 비교할 기준이 없으니 건너뛰지 않는다.
      if (acceptedFileIds && (!row.uploadFileId || !acceptedFileIds.has(row.uploadFileId))) {
        excludedNotAcceptedFileCount += 1
        continue
      }

      // 세션이 기간을 넘나드는 통장(예: 7월에 올린 1~12월치 거래내역)이어도, 행 자체의
      // transactionDate로 다시 한 번 잘라야 ledger 월별 보기가 정확해진다.
      const periodMonth = attributedMonthFromTransactionDate(row.transactionDate)
      if (!periodMonth) {
        excludedUnknownDateCount += 1
        continue
      }
      if (periodMonth < period.start || periodMonth > period.end) continue
      rows.push({ ...row, periodMonth })
    }
  }

  rows.sort((a, b) => {
    if (a.periodMonth !== b.periodMonth) return a.periodMonth.localeCompare(b.periodMonth)
    return (a.transactionDate ?? '').localeCompare(b.transactionDate ?? '')
  })

  return {
    ok: true,
    ledger: ledgerSummary,
    period,
    sessionCount: latestRunBySession.size,
    excludedUnknownDateCount,
    excludedNotAcceptedFileCount,
    rows,
  }
}
