import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bookkeepingMaterialAttribution } from '@/lib/db/schema'
import { buildAttributionSummary } from './build-material-attribution-summary'
import type {
  ReviewMaterialAttribution,
  ReviewMaterialAttributionSummary,
} from './review-workspace-types'

const ACTIVE_ATTRIBUTION_STATUS = 'active'

function mapAttributionRow(row: typeof bookkeepingMaterialAttribution.$inferSelect): ReviewMaterialAttribution {
  return {
    id: row.id,
    uploadSessionId: row.uploadSessionId,
    sourceKind: row.sourceKind,
    sourceLabel: row.sourceLabel,
    evidenceDate: row.evidenceDate,
    attributedPeriod: row.attributedPeriod,
    requestedPeriod: row.requestedPeriod,
    closePeriod: row.closePeriod,
    periodRelation: row.periodRelation,
    amountKrw: row.amountKrw,
    counterparty: row.counterparty,
    description: row.description,
    duplicateStatus: row.duplicateStatus,
    duplicateBasis: row.duplicateBasis,
    recommendation: row.recommendation,
    staffDecision: row.staffDecision,
    staffNote: row.staffNote,
  }
}

export async function loadMaterialAttributionSummary(params: {
  sessionId: string
  tenantId: string
}): Promise<ReviewMaterialAttributionSummary | null> {
  const rows = await db
    .select()
    .from(bookkeepingMaterialAttribution)
    .where(
      and(
        eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
        eq(bookkeepingMaterialAttribution.uploadSessionId, params.sessionId),
        eq(bookkeepingMaterialAttribution.status, ACTIVE_ATTRIBUTION_STATUS),
      ),
    )

  return buildAttributionSummary(rows.map(mapAttributionRow))
}
