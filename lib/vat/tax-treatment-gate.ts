import type { DateTime } from 'luxon'
import { z } from 'zod'
import {
  buildCompanyHomePeriod,
  type CompanyHomePeriod,
} from '@/lib/company-home/summary'
import type { VatTaxTreatmentDisplayRow } from '@/lib/validations/vat-tax-treatment'
import { loadVatTaxTreatmentDisplayRows } from './tax-treatment-summary'

export const vatTaxTreatmentGateSchema = z.object({
  isReady: z.boolean(),
  blockerCount: z.number().int().nonnegative(),
  unconfirmedCount: z.number().int().nonnegative(),
  heldCount: z.number().int().nonnegative(),
  expertReviewCount: z.number().int().nonnegative(),
  evidenceIncompleteCount: z.number().int().nonnegative(),
  prorationIncompleteCount: z.number().int().nonnegative(),
  targetRoute: z.literal('/dashboard/vat'),
})

export type VatTaxTreatmentGate = z.infer<typeof vatTaxTreatmentGateSchema>

function hasIncompleteEvidence(row: VatTaxTreatmentDisplayRow) {
  return row.requiredEvidence.some((item) => item.status !== 'present')
}

function hasIncompleteProration(row: VatTaxTreatmentDisplayRow) {
  const requiresProration = row.recommendation === 'proration_required'
    || row.finalDecision === 'prorated'
  if (!requiresProration) return false

  return !row.requiredEvidence.some((item) => (
    item.code === 'proration_basis' && item.status === 'present'
  ))
}

export function buildVatTaxTreatmentGate(
  rows: VatTaxTreatmentDisplayRow[],
): VatTaxTreatmentGate {
  const blockerRowIds = new Set<string>()
  let unconfirmedCount = 0
  let heldCount = 0
  let expertReviewCount = 0
  let evidenceIncompleteCount = 0
  let prorationIncompleteCount = 0

  for (const row of rows) {
    const isUnconfirmed = row.userActionStatus !== 'confirmed' || !row.finalDecision
    const evidenceIncomplete = hasIncompleteEvidence(row)
    const prorationIncomplete = hasIncompleteProration(row)

    if (isUnconfirmed) unconfirmedCount += 1
    if (row.userActionStatus === 'held') heldCount += 1
    if (row.userActionStatus === 'expert_review') expertReviewCount += 1
    if (evidenceIncomplete) evidenceIncompleteCount += 1
    if (prorationIncomplete) prorationIncompleteCount += 1
    if (isUnconfirmed || evidenceIncomplete || prorationIncomplete) {
      blockerRowIds.add(row.rowId)
    }
  }

  return vatTaxTreatmentGateSchema.parse({
    isReady: blockerRowIds.size === 0,
    blockerCount: blockerRowIds.size,
    unconfirmedCount,
    heldCount,
    expertReviewCount,
    evidenceIncompleteCount,
    prorationIncompleteCount,
    targetRoute: '/dashboard/vat',
  })
}

export async function loadVatTaxTreatmentGate(params: {
  tenantId: string
  businessEntityId: string
  periodKey: string
  period?: Pick<CompanyHomePeriod, 'key' | 'startMonth' | 'endMonth'>
  today?: DateTime
}) {
  const period = params.period ?? buildCompanyHomePeriod({
    periodKey: params.periodKey,
    today: params.today,
  })
  const rows = await loadVatTaxTreatmentDisplayRows({
    tenantId: params.tenantId,
    businessEntityId: params.businessEntityId,
    period,
    includeAi: false,
    includeStoredAi: false,
  })
  return buildVatTaxTreatmentGate(rows)
}
