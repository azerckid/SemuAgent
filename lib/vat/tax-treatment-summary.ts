import { and, desc, eq, inArray } from 'drizzle-orm'
import { labelForBookkeepingAccountCategory } from '@/lib/bookkeeping/account-categories'
import { pickLatestCompletedRunIdsBySession } from '@/lib/bookkeeping-review/summary'
import type { CompanyHomePeriod } from '@/lib/company-home/summary'
import {
  bookkeepingClassificationRun,
  bookkeepingTransactionClassification,
  vatDeductionReview,
  vatTaxTreatmentEvidenceAttestation,
  vatTaxTreatmentReview,
} from '@/lib/db/schema'
import { listActiveSourceBatchSessions } from '@/lib/source-batch/scope'
import {
  VAT_TAX_TREATMENT_RULE_VERSION,
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
  type VatTaxTreatmentFinalDecision,
} from '@/lib/validations/vat-tax-treatment'
import { parsedVatFactSchema } from './facts'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'
import {
  applyPriorConfirmedVatPattern,
  type VatTaxTreatmentPatternRow,
} from './tax-treatment-patterns'
import { applyStoredVatTaxTreatmentAiResults } from './tax-treatment-ai-result'
import {
  evaluateVatTaxTreatmentRule,
  type VatTaxTreatmentDeductionContext,
  type VatTaxTreatmentRuleRow,
} from './tax-treatment-rules'

export type VatTaxTreatmentClassificationRow = Pick<
  typeof bookkeepingTransactionClassification.$inferSelect,
  | 'id'
  | 'tenantId'
  | 'classificationRunId'
  | 'sourceType'
  | 'transactionDate'
  | 'merchantName'
  | 'description'
  | 'amountKrw'
  | 'finalAccount'
  | 'staffMemo'
  | 'status'
  | 'vatDirection'
  | 'vatTaxType'
  | 'vatSupplyAmountKrw'
  | 'vatTaxAmountKrw'
  | 'vatGrossAmountKrw'
  | 'vatFactSource'
  | 'vatFactSourceRef'
  | 'vatFactStatus'
  | 'confirmedByStaffId'
  | 'confirmedAt'
>

export type VatTaxTreatmentDeductionRow = Pick<
  typeof vatDeductionReview.$inferSelect,
  | 'id'
  | 'periodKey'
  | 'classificationRowId'
  | 'kind'
  | 'decision'
  | 'reason'
  | 'prorationRateBps'
  | 'confirmedByStaffId'
  | 'confirmedAt'
  | 'updatedAt'
>

export type VatTaxTreatmentAuditRow = Pick<
  typeof vatTaxTreatmentReview.$inferSelect,
  | 'classificationRowId'
  | 'recommendationFingerprint'
  | 'status'
  | 'finalDecision'
  | 'finalReason'
  | 'confirmedByStaffId'
  | 'confirmedAt'
>

export type VatTaxTreatmentEvidenceAttestationRow = Pick<
  typeof vatTaxTreatmentEvidenceAttestation.$inferSelect,
  | 'classificationRowId'
  | 'evidenceCode'
  | 'status'
  | 'confirmedAt'
>

type ExactVatTaxTreatmentRow = VatTaxTreatmentClassificationRow & {
  sourceType: 'tax_invoice' | 'card' | 'receipt'
  transactionDate: string
  vatDirection: 'sale' | 'purchase'
  vatTaxType: 'taxable' | 'zero_rated' | 'exempt' | 'non_taxable'
  vatSupplyAmountKrw: number
  vatTaxAmountKrw: number
  vatGrossAmountKrw: number
  vatFactSource: 'parser' | 'manual'
  vatFactStatus: 'derived' | 'confirmed'
  vatFactSourceRef: string
}

function exactVatTaxTreatmentRow(row: VatTaxTreatmentClassificationRow): ExactVatTaxTreatmentRow | null {
  if (row.status !== 'confirmed') return null
  if (!['tax_invoice', 'card', 'receipt'].includes(row.sourceType)) return null
  if (!row.transactionDate || !/^20\d{2}-\d{2}-\d{2}$/.test(row.transactionDate)) return null
  if (row.vatDirection !== 'sale' && row.vatDirection !== 'purchase') return null
  if (!['taxable', 'zero_rated', 'exempt', 'non_taxable'].includes(row.vatTaxType ?? '')) return null
  if (row.vatFactSource !== 'parser' && row.vatFactSource !== 'manual') return null
  if (row.vatFactStatus !== 'derived' && row.vatFactStatus !== 'confirmed') return null
  if (!row.vatFactSourceRef) return null

  const parsed = parsedVatFactSchema.safeParse({
    direction: row.vatDirection,
    taxType: row.vatTaxType,
    supplyAmountKrw: row.vatSupplyAmountKrw,
    taxAmountKrw: row.vatTaxAmountKrw,
    grossAmountKrw: row.vatGrossAmountKrw,
    sourceReference: row.vatFactSourceRef,
  })
  if (!parsed.success || row.amountKrw === null || Math.abs(row.amountKrw) !== parsed.data.grossAmountKrw) {
    return null
  }

  return row as ExactVatTaxTreatmentRow
}

function monthInPeriod(transactionDate: string, period: Pick<CompanyHomePeriod, 'startMonth' | 'endMonth'>) {
  const month = transactionDate.slice(0, 7)
  return month >= period.startMonth && month <= period.endMonth
}

function latestDeductionByClassificationRow(
  reviews: VatTaxTreatmentDeductionRow[],
  periodKey?: string,
) {
  const latest = new Map<string, VatTaxTreatmentDeductionRow>()
  for (const review of reviews) {
    if (!review.classificationRowId || (periodKey && review.periodKey !== periodKey)) continue
    if (!latest.has(review.classificationRowId)) latest.set(review.classificationRowId, review)
  }
  return latest
}

function deductionContext(
  review: VatTaxTreatmentDeductionRow | undefined,
): VatTaxTreatmentDeductionContext {
  if (!review) return null
  return {
    kind: review.kind,
    decision: review.decision,
    reason: review.reason,
    prorationRateBps: review.prorationRateBps,
  }
}

function priorPatternRows(params: {
  rows: ExactVatTaxTreatmentRow[]
  reviews: VatTaxTreatmentDeductionRow[]
  beforeMonth: string
}): VatTaxTreatmentPatternRow[] {
  const reviewByRow = latestDeductionByClassificationRow(params.reviews)
  const patterns: VatTaxTreatmentPatternRow[] = []

  for (const row of params.rows) {
    if (row.transactionDate.slice(0, 7) >= params.beforeMonth) continue

    let finalDecision: VatTaxTreatmentFinalDecision | null = null
    if (row.vatDirection === 'purchase') {
      const review = reviewByRow.get(row.id)
      if (
        review
        && review.decision !== 'pending'
        && review.confirmedByStaffId
        && review.confirmedAt
      ) finalDecision = review.decision
    } else if (row.vatFactStatus === 'confirmed' && row.confirmedByStaffId && row.confirmedAt) {
      finalDecision = row.vatTaxType
    }
    if (!finalDecision) continue

    patterns.push({
      classificationRowId: row.id,
      transactionDate: row.transactionDate,
      counterparty: row.merchantName,
      direction: row.vatDirection,
      finalAccount: row.finalAccount,
      finalDecision,
    })
  }

  return patterns
}

function currentFinalDecision(params: {
  row: ExactVatTaxTreatmentRow
  review: VatTaxTreatmentDeductionRow | undefined
}) {
  if (
    params.row.vatDirection === 'purchase'
    && params.review
    && params.review.decision !== 'pending'
    && params.review.confirmedByStaffId
    && params.review.confirmedAt
  ) {
    return {
      finalDecision: params.review.decision as VatTaxTreatmentFinalDecision,
      confirmedByStaffId: params.review.confirmedByStaffId,
      confirmedAt: params.review.confirmedAt,
    }
  }
  if (
    params.row.vatDirection === 'sale'
    && params.row.vatFactStatus === 'confirmed'
    && params.row.confirmedByStaffId
    && params.row.confirmedAt
  ) {
    return {
      finalDecision: params.row.vatTaxType as VatTaxTreatmentFinalDecision,
      confirmedByStaffId: params.row.confirmedByStaffId,
      confirmedAt: params.row.confirmedAt,
    }
  }
  return { finalDecision: null, confirmedByStaffId: null, confirmedAt: null }
}

function ruleRow(row: ExactVatTaxTreatmentRow): VatTaxTreatmentRuleRow {
  return {
    id: row.id,
    sourceType: row.sourceType,
    merchantName: row.merchantName,
    description: row.description,
    finalAccount: row.finalAccount,
    staffMemo: row.staffMemo,
    vatDirection: row.vatDirection,
    vatTaxType: row.vatTaxType,
  }
}

export function buildVatTaxTreatmentDisplayRows(params: {
  tenantId: string
  businessEntityId: string
  period: Pick<CompanyHomePeriod, 'key' | 'startMonth' | 'endMonth'>
  classificationRows: VatTaxTreatmentClassificationRow[]
  deductionReviews: VatTaxTreatmentDeductionRow[]
}): VatTaxTreatmentDisplayRow[] {
  const exactRows = params.classificationRows
    .map(exactVatTaxTreatmentRow)
    .filter((row): row is ExactVatTaxTreatmentRow => row !== null)
  const priorRows = priorPatternRows({
    rows: exactRows,
    reviews: params.deductionReviews,
    beforeMonth: params.period.startMonth,
  })
  const currentReviewByRow = latestDeductionByClassificationRow(params.deductionReviews, params.period.key)

  return exactRows
    .filter((row) => monthInPeriod(row.transactionDate, params.period))
    .map((row) => {
      const review = currentReviewByRow.get(row.id)
      const deterministic = evaluateVatTaxTreatmentRule({
        row: ruleRow(row),
        deduction: deductionContext(review),
      })
      const decision = applyPriorConfirmedVatPattern({
        target: {
          classificationRowId: row.id,
          transactionDate: row.transactionDate,
          counterparty: row.merchantName,
          direction: row.vatDirection,
          finalAccount: row.finalAccount,
        },
        priorRows,
        base: deterministic,
      })
      const finalState = currentFinalDecision({ row, review })

      return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
        rowId: row.id,
        classificationRowId: row.id,
        tenantId: params.tenantId,
        businessEntityId: params.businessEntityId,
        periodKey: params.period.key,
        direction: row.vatDirection,
        currentVatFact: {
          taxType: row.vatTaxType,
          supplyAmountKrw: row.vatSupplyAmountKrw,
          taxAmountKrw: row.vatTaxAmountKrw,
          grossAmountKrw: row.vatGrossAmountKrw,
          source: row.vatFactSource,
          status: row.vatFactStatus,
        },
        ...decision,
        ruleVersion: VAT_TAX_TREATMENT_RULE_VERSION,
        hometaxComparisonMode: 'expected_prefill',
        aiTrace: null,
        aiRuntimeStatus: 'not_requested',
        ...finalState,
        userActionStatus: finalState.finalDecision ? 'confirmed' : 'pending',
        userActionReason: finalState.finalDecision && row.vatDirection === 'purchase'
          ? review?.reason || null
          : null,
        transactionDate: row.transactionDate,
        counterparty: row.merchantName?.trim() || '상대처 미확인',
        description: row.description?.trim() || row.merchantName?.trim() || '거래 내용 미확인',
        sourceType: row.sourceType,
        accountLabel: row.finalAccount ? labelForBookkeepingAccountCategory(row.finalAccount) || row.finalAccount : null,
      }))
    })
    .sort((left, right) => (
      right.transactionDate.localeCompare(left.transactionDate)
      || right.currentVatFact.grossAmountKrw - left.currentVatFact.grossAmountKrw
      || left.rowId.localeCompare(right.rowId)
    ))
}

export function applyVatTaxTreatmentAuditStates(params: {
  rows: VatTaxTreatmentDisplayRow[]
  auditRows: VatTaxTreatmentAuditRow[]
}) {
  const auditByRowId = new Map(params.auditRows.map((row) => [row.classificationRowId, row]))

  return params.rows.map((row) => {
    const audit = auditByRowId.get(row.classificationRowId)
    if (row.finalDecision) {
      const matchingConfirmedAudit = audit?.status === 'confirmed'
        && audit.recommendationFingerprint === row.recommendationFingerprint
      return vatTaxTreatmentDisplayRowSchema.parse({
        ...row,
        userActionStatus: 'confirmed',
        userActionReason: matchingConfirmedAudit ? audit.finalReason : row.userActionReason,
      })
    }
    if (
      audit?.recommendationFingerprint === row.recommendationFingerprint
      && (audit.status === 'held' || audit.status === 'expert_review')
    ) {
      return vatTaxTreatmentDisplayRowSchema.parse({
        ...row,
        userActionStatus: audit.status,
        userActionReason: audit.finalReason,
      })
    }
    return vatTaxTreatmentDisplayRowSchema.parse({
      ...row,
      userActionStatus: 'pending',
      userActionReason: null,
    })
  })
}

export function applyVatTaxTreatmentEvidenceAttestations(params: {
  rows: VatTaxTreatmentDisplayRow[]
  attestations: VatTaxTreatmentEvidenceAttestationRow[]
}) {
  const activeByEvidence = new Map(
    params.attestations
      .filter((attestation) => attestation.status === 'present')
      .map((attestation) => [
        `${attestation.classificationRowId}:${attestation.evidenceCode}`,
        attestation,
      ]),
  )

  return params.rows.map((row) => {
    let changed = false
    const requiredEvidence = row.requiredEvidence.map((item) => {
      const attestation = activeByEvidence.get(`${row.classificationRowId}:${item.code}`)
      if (!attestation) return item
      changed = true
      return {
        ...item,
        status: 'present' as const,
        attestedAt: attestation.confirmedAt,
      }
    })
    if (!changed) return row

    return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
      ...row,
      requiredEvidence,
    }))
  })
}

export async function loadVatTaxTreatmentDisplayRows(params: {
  tenantId: string
  businessEntityId: string
  period: Pick<CompanyHomePeriod, 'key' | 'startMonth' | 'endMonth'>
  includeStoredAi?: boolean
}): Promise<VatTaxTreatmentDisplayRow[]> {
  const { db } = await import('@/lib/db')
  const sessions = await listActiveSourceBatchSessions({
    tenantId: params.tenantId,
    clientId: params.businessEntityId,
  })
  const sessionIds = sessions.map((session) => session.id)
  if (sessionIds.length === 0) return []

  const runRows = await db
    .select({
      id: bookkeepingClassificationRun.id,
      uploadSessionId: bookkeepingClassificationRun.uploadSessionId,
      status: bookkeepingClassificationRun.status,
      createdAt: bookkeepingClassificationRun.createdAt,
    })
    .from(bookkeepingClassificationRun)
    .where(and(
      eq(bookkeepingClassificationRun.tenantId, params.tenantId),
      eq(bookkeepingClassificationRun.status, 'completed'),
      inArray(bookkeepingClassificationRun.uploadSessionId, sessionIds),
    ))
    .orderBy(desc(bookkeepingClassificationRun.createdAt), desc(bookkeepingClassificationRun.id))
  const latestRunIds = pickLatestCompletedRunIdsBySession(runRows)
  if (latestRunIds.length === 0) return []

  const classificationRows = await db
    .select({
      id: bookkeepingTransactionClassification.id,
      tenantId: bookkeepingTransactionClassification.tenantId,
      classificationRunId: bookkeepingTransactionClassification.classificationRunId,
      sourceType: bookkeepingTransactionClassification.sourceType,
      transactionDate: bookkeepingTransactionClassification.transactionDate,
      merchantName: bookkeepingTransactionClassification.merchantName,
      description: bookkeepingTransactionClassification.description,
      amountKrw: bookkeepingTransactionClassification.amountKrw,
      finalAccount: bookkeepingTransactionClassification.finalAccount,
      staffMemo: bookkeepingTransactionClassification.staffMemo,
      status: bookkeepingTransactionClassification.status,
      vatDirection: bookkeepingTransactionClassification.vatDirection,
      vatTaxType: bookkeepingTransactionClassification.vatTaxType,
      vatSupplyAmountKrw: bookkeepingTransactionClassification.vatSupplyAmountKrw,
      vatTaxAmountKrw: bookkeepingTransactionClassification.vatTaxAmountKrw,
      vatGrossAmountKrw: bookkeepingTransactionClassification.vatGrossAmountKrw,
      vatFactSource: bookkeepingTransactionClassification.vatFactSource,
      vatFactSourceRef: bookkeepingTransactionClassification.vatFactSourceRef,
      vatFactStatus: bookkeepingTransactionClassification.vatFactStatus,
      confirmedByStaffId: bookkeepingTransactionClassification.confirmedByStaffId,
      confirmedAt: bookkeepingTransactionClassification.confirmedAt,
    })
    .from(bookkeepingTransactionClassification)
    .where(and(
      eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
      inArray(bookkeepingTransactionClassification.classificationRunId, latestRunIds),
    ))

  const classificationRowIds = classificationRows.map((row) => row.id)
  const deductionReviews = classificationRowIds.length > 0
    ? await db
      .select({
        id: vatDeductionReview.id,
        periodKey: vatDeductionReview.periodKey,
        classificationRowId: vatDeductionReview.classificationRowId,
        kind: vatDeductionReview.kind,
        decision: vatDeductionReview.decision,
        reason: vatDeductionReview.reason,
        prorationRateBps: vatDeductionReview.prorationRateBps,
        confirmedByStaffId: vatDeductionReview.confirmedByStaffId,
        confirmedAt: vatDeductionReview.confirmedAt,
        updatedAt: vatDeductionReview.updatedAt,
      })
      .from(vatDeductionReview)
      .where(and(
        eq(vatDeductionReview.tenantId, params.tenantId),
        eq(vatDeductionReview.clientId, params.businessEntityId),
        inArray(vatDeductionReview.classificationRowId, classificationRowIds),
      ))
      .orderBy(desc(vatDeductionReview.updatedAt), desc(vatDeductionReview.id))
    : []

  const auditRows = classificationRowIds.length > 0
    ? await db
      .select({
        classificationRowId: vatTaxTreatmentReview.classificationRowId,
        recommendationFingerprint: vatTaxTreatmentReview.recommendationFingerprint,
        status: vatTaxTreatmentReview.status,
        finalDecision: vatTaxTreatmentReview.finalDecision,
        finalReason: vatTaxTreatmentReview.finalReason,
        confirmedByStaffId: vatTaxTreatmentReview.confirmedByStaffId,
        confirmedAt: vatTaxTreatmentReview.confirmedAt,
      })
      .from(vatTaxTreatmentReview)
      .where(and(
        eq(vatTaxTreatmentReview.tenantId, params.tenantId),
        eq(vatTaxTreatmentReview.clientId, params.businessEntityId),
        eq(vatTaxTreatmentReview.periodKey, params.period.key),
        inArray(vatTaxTreatmentReview.classificationRowId, classificationRowIds),
      ))
    : []

  const evidenceAttestations = classificationRowIds.length > 0
    ? await db
      .select({
        classificationRowId: vatTaxTreatmentEvidenceAttestation.classificationRowId,
        evidenceCode: vatTaxTreatmentEvidenceAttestation.evidenceCode,
        status: vatTaxTreatmentEvidenceAttestation.status,
        confirmedAt: vatTaxTreatmentEvidenceAttestation.confirmedAt,
      })
      .from(vatTaxTreatmentEvidenceAttestation)
      .where(and(
        eq(vatTaxTreatmentEvidenceAttestation.tenantId, params.tenantId),
        eq(vatTaxTreatmentEvidenceAttestation.clientId, params.businessEntityId),
        eq(vatTaxTreatmentEvidenceAttestation.periodKey, params.period.key),
        eq(vatTaxTreatmentEvidenceAttestation.status, 'present'),
        inArray(vatTaxTreatmentEvidenceAttestation.classificationRowId, classificationRowIds),
      ))
    : []

  const rows = buildVatTaxTreatmentDisplayRows({
    tenantId: params.tenantId,
    businessEntityId: params.businessEntityId,
    period: params.period,
    classificationRows,
    deductionReviews,
  })
  const rowsWithAttestations = applyVatTaxTreatmentEvidenceAttestations({
    rows,
    attestations: evidenceAttestations,
  })
  const recommendedRows = params.includeStoredAi === true
    ? await applyStoredVatTaxTreatmentAiResults({
      tenantId: params.tenantId,
      businessEntityId: params.businessEntityId,
      periodKey: params.period.key,
      rows: rowsWithAttestations,
    })
    : rowsWithAttestations
  return applyVatTaxTreatmentAuditStates({ rows: recommendedRows, auditRows })
}
