import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'
import { runBookkeepingLedgerDraftPipeline } from '@/lib/bookkeeping/fiscal-year-ledger-pipeline'
import {
  getActiveStaffForPeriodAttribution,
  startBookkeepingMaterialAttribution,
} from '@/lib/bookkeeping/period-attribution-service'

type StaffRecord = {
  id: string
  role: 'TENANT_ADMIN' | 'STAFF'
}

async function getActiveStaffByStaffId(params: {
  staffId: string
  tenantId: string
}): Promise<StaffRecord | null> {
  const [row] = await db
    .select({ id: staff.id, role: staff.role })
    .from(staff)
    .where(and(eq(staff.id, params.staffId), eq(staff.tenantId, params.tenantId), eq(staff.active, true)))
    .limit(1)

  return row ?? null
}

async function resolveStaffRecord(params: {
  tenantId: string
  userId?: string
  staffId?: string | null
}): Promise<StaffRecord | null> {
  if (params.userId) {
    return getActiveStaffForPeriodAttribution({
      userId: params.userId,
      tenantId: params.tenantId,
    })
  }

  if (params.staffId) {
    return getActiveStaffByStaffId({
      staffId: params.staffId,
      tenantId: params.tenantId,
    })
  }

  return null
}

export async function runBookkeepingDraftPipelineAfterEvaluation(params: {
  sessionId: string
  tenantId: string
  userId?: string
  staffId?: string | null
  logSource?: string
}) {
  const logSource = params.logSource ?? 'bookkeeping-auto-progression'

  try {
    const staffRecord = await resolveStaffRecord(params)
    if (!staffRecord) {
      console.warn(`[${logSource}] 담당자 정보가 없어 기장 자동 진행을 건너뜁니다 (${params.sessionId}).`)
      return
    }

    const attribution = await startBookkeepingMaterialAttribution({
      sessionId: params.sessionId,
      tenantId: params.tenantId,
      staffRecord,
    })
    if (!attribution.ok) {
      console.info(`[${logSource}] 귀속기간 자동 검토를 건너뜁니다 (${params.sessionId}):`, attribution.error)
      return
    }

    const pipeline = await runBookkeepingLedgerDraftPipeline({
      sessionId: params.sessionId,
      tenantId: params.tenantId,
      staffRecord,
    })
    if (!pipeline.ok) {
      console.info(`[${logSource}] 기장 자동 진행이 완료되지 않았습니다 (${params.sessionId}):`, pipeline.error)
    }
  } catch (error) {
    console.error(`[${logSource}] 기장 자동 진행 중 오류가 발생했습니다 (${params.sessionId}):`, error)
  }
}
