import { and, eq, isNull } from 'drizzle-orm'
import { inferBookkeepingPeriodRange } from '@/lib/bookkeeping/period-range'
import type { CompanyHomePeriod } from '@/lib/company-home/summary'
import { sourceBatch } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// JC-031 Slice 3b — source_batch를 SemuAgent 내부 source lineage의 우선
// 조회 대상으로 쓰기 위한 공유 헬퍼. upload_session을 직접 훑던 각 read
// model의 "이 client의 staff_direct 세션을 기간으로 조회" 로직을 여기로
// 통일해, 화면마다 다른 lineage 판단이 생기지 않게 한다.
// legacy_upload_session_id로 기존 downstream 테이블(uploadSessionId 컬럼
// 기준)의 inArray 조회를 그대로 재사용한다 — downstream 테이블 자체에
// source_batch_id를 붙이는 건 Slice 3c 범위다.
// ---------------------------------------------------------------------------

export type SessionPeriodInput = {
  accountingPeriod: string
  bookkeepingPeriodStart: string | null
  bookkeepingPeriodEnd: string | null
}

export function sessionPeriodOverlapsCompanyPeriod(
  session: SessionPeriodInput,
  period: Pick<CompanyHomePeriod, 'startMonth' | 'endMonth'>,
) {
  const snapshotStart = normalizeMonthValue(session.bookkeepingPeriodStart)
  const snapshotEnd = normalizeMonthValue(session.bookkeepingPeriodEnd)
  const snapshotRange = snapshotStart && snapshotEnd && snapshotStart <= snapshotEnd
    ? { start: snapshotStart, end: snapshotEnd }
    : null
  const range = snapshotRange ?? inferBookkeepingPeriodRange(session.accountingPeriod)

  return Boolean(range && range.start <= period.endMonth && range.end >= period.startMonth)
}

function normalizeMonthValue(value: string | null | undefined) {
  if (!value) return null
  if (/^20\d{2}-\d{2}$/.test(value)) return value
  if (/^20\d{2}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7)
  return null
}

export type SourceBatchSessionRow = {
  id: string
  accountingPeriod: string
  bookkeepingPeriodType: 'monthly' | 'quarterly' | 'yearly' | null
  bookkeepingPeriodStart: string | null
  bookkeepingPeriodEnd: string | null
  createdAt: string
}

// tenant/client 범위의 staff_direct source_batch 전체를 legacy upload_session
// id로 브릿지해 반환한다. 기간 필터는 호출부가 필요에 맞게(단일 기간 겹침
// 검사 또는 회계연도 전체 월별 버킷팅) 직접 수행한다.
export async function listActiveSourceBatchSessions(params: {
  tenantId: string
  clientId: string
}): Promise<SourceBatchSessionRow[]> {
  const { db } = await import('@/lib/db')
  const rows = await db
    .select({
      id: sourceBatch.legacyUploadSessionId,
      accountingPeriod: sourceBatch.accountingPeriod,
      bookkeepingPeriodType: sourceBatch.bookkeepingPeriodType,
      bookkeepingPeriodStart: sourceBatch.bookkeepingPeriodStart,
      bookkeepingPeriodEnd: sourceBatch.bookkeepingPeriodEnd,
      createdAt: sourceBatch.createdAt,
    })
    .from(sourceBatch)
    .where(and(
      eq(sourceBatch.tenantId, params.tenantId),
      eq(sourceBatch.clientId, params.clientId),
      eq(sourceBatch.sourceKind, 'staff_direct'),
      isNull(sourceBatch.deletedAt),
    ))

  return rows.filter((row): row is SourceBatchSessionRow => row.id !== null)
}

// 단일 기간과 겹치는 upload_session id만 필요한 호출부용 편의 함수.
export async function resolveActiveSourceBatchSessionIds(params: {
  tenantId: string
  clientId: string
  period: Pick<CompanyHomePeriod, 'startMonth' | 'endMonth'>
}): Promise<string[]> {
  const sessions = await listActiveSourceBatchSessions(params)
  return sessions
    .filter((session) => sessionPeriodOverlapsCompanyPeriod(session, params.period))
    .map((session) => session.id)
}
