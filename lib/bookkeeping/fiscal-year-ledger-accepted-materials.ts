import { and, between, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingLedgerMaterialLink,
  bookkeepingMaterialAttribution,
  uploadSession,
} from '@/lib/db/schema'
import { periodFromAttributionValue } from './period-range'
import type { LedgerPeriodRange } from './fiscal-year-ledger-rules'

export type LedgerAcceptedMaterial = {
  uploadSessionId: string
  uploadFileId: string | null
}

function isIncludedAttribution(row: Pick<typeof bookkeepingMaterialAttribution.$inferSelect, 'staffDecision' | 'recommendation'>) {
  return (row.staffDecision ?? row.recommendation) === 'include'
}

export async function listLedgerAcceptedMaterials(params: {
  tenantId: string
  ledgerId: string
  clientId: string
  period: LedgerPeriodRange
}): Promise<LedgerAcceptedMaterial[]> {
  const links = await db
    .select({
      uploadSessionId: bookkeepingLedgerMaterialLink.uploadSessionId,
      uploadFileId: bookkeepingLedgerMaterialLink.uploadFileId,
    })
    .from(bookkeepingLedgerMaterialLink)
    .where(
      and(
        eq(bookkeepingLedgerMaterialLink.tenantId, params.tenantId),
        eq(bookkeepingLedgerMaterialLink.ledgerId, params.ledgerId),
        eq(bookkeepingLedgerMaterialLink.status, 'included'),
        between(bookkeepingLedgerMaterialLink.periodMonth, params.period.start, params.period.end),
      ),
    )

  if (links.length > 0) return links

  const sessions = await db
    .select({ id: uploadSession.id })
    .from(uploadSession)
    .where(
      and(
        eq(uploadSession.tenantId, params.tenantId),
        eq(uploadSession.clientId, params.clientId),
        isNull(uploadSession.deletedAt),
      ),
    )

  const sessionIds = sessions.map((session) => session.id)
  if (sessionIds.length === 0) return []

  const attributionRows = await db
    .select({
      uploadSessionId: bookkeepingMaterialAttribution.uploadSessionId,
      uploadFileId: bookkeepingMaterialAttribution.uploadFileId,
      attributedPeriod: bookkeepingMaterialAttribution.attributedPeriod,
      evidenceDate: bookkeepingMaterialAttribution.evidenceDate,
      recommendation: bookkeepingMaterialAttribution.recommendation,
      staffDecision: bookkeepingMaterialAttribution.staffDecision,
    })
    .from(bookkeepingMaterialAttribution)
    .where(
      and(
        eq(bookkeepingMaterialAttribution.tenantId, params.tenantId),
        eq(bookkeepingMaterialAttribution.status, 'active'),
        inArray(bookkeepingMaterialAttribution.uploadSessionId, sessionIds),
      ),
    )

  return attributionRows
    .filter((row) => {
      if (!isIncludedAttribution(row)) return false
      const periodMonth = periodFromAttributionValue(row)
      return Boolean(periodMonth && periodMonth >= params.period.start && periodMonth <= params.period.end)
    })
    .map((row) => ({
      uploadSessionId: row.uploadSessionId,
      uploadFileId: row.uploadFileId,
    }))
}
