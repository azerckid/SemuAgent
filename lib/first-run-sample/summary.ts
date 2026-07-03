import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { client, sampleDataset } from '@/lib/db/schema'

export type FirstRunSampleVisibleStatus = 'creating' | 'active' | 'delete_pending' | 'failed'
export type FirstRunSampleState =
  | { status: 'none'; visible: false }
  | { status: 'deleted'; visible: false; datasetId: string; clientId: string }
  | {
      status: FirstRunSampleVisibleStatus
      visible: true
      datasetId: string
      clientId: string
      clientName: string | null
      seedVersion: string
      periodKey: string
      payrollPeriodKey: string
      errorMessage: string | null
    }

const VISIBLE_SAMPLE_STATUSES = ['creating', 'active', 'delete_pending', 'failed'] as const

export function sampleStatusLabel(status: FirstRunSampleVisibleStatus) {
  switch (status) {
    case 'creating':
      return '샘플 생성 중'
    case 'delete_pending':
      return '샘플 삭제 중'
    case 'failed':
      return '샘플 생성 실패'
    case 'active':
    default:
      return '샘플 데이터'
  }
}

export async function loadFirstRunSampleState(tenantId: string): Promise<FirstRunSampleState> {
  const visibleRows = await db
    .select({
      id: sampleDataset.id,
      clientId: sampleDataset.clientId,
      status: sampleDataset.status,
      seedVersion: sampleDataset.seedVersion,
      periodKey: sampleDataset.periodKey,
      payrollPeriodKey: sampleDataset.payrollPeriodKey,
      errorMessage: sampleDataset.errorMessage,
      updatedAt: sampleDataset.updatedAt,
    })
    .from(sampleDataset)
    .where(and(
      eq(sampleDataset.tenantId, tenantId),
      inArray(sampleDataset.status, VISIBLE_SAMPLE_STATUSES),
    ))
    .orderBy(desc(sampleDataset.updatedAt), desc(sampleDataset.id))
    .limit(1)

  const visible = visibleRows[0]
  if (visible && VISIBLE_SAMPLE_STATUSES.includes(visible.status as FirstRunSampleVisibleStatus)) {
    const [clientRow] = await db
      .select({ name: client.name })
      .from(client)
      .where(and(eq(client.tenantId, tenantId), eq(client.id, visible.clientId)))
      .limit(1)

    return {
      status: visible.status as FirstRunSampleVisibleStatus,
      visible: true,
      datasetId: visible.id,
      clientId: visible.clientId,
      clientName: clientRow?.name ?? null,
      seedVersion: visible.seedVersion,
      periodKey: visible.periodKey,
      payrollPeriodKey: visible.payrollPeriodKey,
      errorMessage: visible.errorMessage,
    }
  }

  const deletedRows = await db
    .select({ id: sampleDataset.id, clientId: sampleDataset.clientId })
    .from(sampleDataset)
    .where(and(eq(sampleDataset.tenantId, tenantId), eq(sampleDataset.status, 'deleted')))
    .orderBy(desc(sampleDataset.updatedAt), desc(sampleDataset.id))
    .limit(1)

  const deleted = deletedRows[0]
  if (deleted) return { status: 'deleted', visible: false, datasetId: deleted.id, clientId: deleted.clientId }

  return { status: 'none', visible: false }
}
