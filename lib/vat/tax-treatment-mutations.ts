import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import { db } from '@/lib/db'
import {
  bookkeepingTransactionClassification,
  uploadSession,
  vatDeductionReview,
  vatTaxTreatmentReview,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import {
  type VatTaxTreatmentDisplayRow,
  type VatTaxTreatmentFinalDecision,
  type VatTaxTreatmentMutationInput,
} from '@/lib/validations/vat-tax-treatment'
import { manualVatFactInputSchema } from './facts'
import { finalDecisionForVatRecommendation } from './tax-treatment-actions'
import { enhanceVatTaxTreatmentRowsWithSingleAi } from './tax-treatment-ai'
import { loadVatTaxTreatmentDisplayRows } from './tax-treatment-summary'
import {
  hashVatTaxTreatmentUndoToken,
  vatTaxTreatmentUndoActionStateSchema,
  vatTaxTreatmentUndoCanonicalStateSchema,
  type VatTaxTreatmentUndoActionState,
  type VatTaxTreatmentUndoCanonicalState,
} from './tax-treatment-undo'
import {
  loadVatTaxTreatmentAudit,
  undoVatTaxTreatmentMutation,
  type VatTaxTreatmentAuditRow,
} from './tax-treatment-mutation-undo'

type MutationFailure = {
  ok: false
  status: 400 | 404 | 409
  error: string
}

type MutationSuccess = {
  ok: true
  status: 'pending' | 'confirmed' | 'held' | 'expert_review'
  finalDecision: VatTaxTreatmentFinalDecision | null
  undoToken: string | null
}

type RecommendationLoader = (params: {
  tenantId: string
  businessEntityId: string
  periodKey: string
  rowId: string
  expectedFingerprint: string
}) => Promise<VatTaxTreatmentDisplayRow | null>

type VatTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type ClassificationRow = typeof bookkeepingTransactionClassification.$inferSelect
type DeductionReviewRow = typeof vatDeductionReview.$inferSelect
type VatTaxTreatmentWriteInput = Exclude<VatTaxTreatmentMutationInput, { action: 'undo' }>
type ResolvedMutationDecision = {
  status: 'confirmed' | 'held' | 'expert_review'
  finalDecision: VatTaxTreatmentFinalDecision | null
  reason: string | null
  prorationRateBps: number | null
}

class VatTaxTreatmentMutationConflict extends Error {}

function mutationDecision(params: {
  input: VatTaxTreatmentWriteInput
  recommendation: VatTaxTreatmentDisplayRow
}): ResolvedMutationDecision | MutationFailure {
  if (params.input.action === 'hold') {
    return {
      status: 'held',
      finalDecision: null,
      reason: params.input.reason?.trim() || null,
      prorationRateBps: null,
    }
  }
  if (params.input.action === 'expert_review') {
    return {
      status: 'expert_review',
      finalDecision: null,
      reason: params.input.reason?.trim() || null,
      prorationRateBps: null,
    }
  }

  const finalDecision = params.input.action === 'apply_recommendation'
    ? finalDecisionForVatRecommendation(params.recommendation.recommendation)
    : params.input.finalDecision
  if (!finalDecision) {
    return {
      ok: false,
      status: 400,
      error: '이 추천은 추가 정보가 필요해 바로 확정할 수 없습니다.',
    }
  }

  const purchaseDecision = ['deductible', 'non_deductible', 'prorated'].includes(finalDecision)
  if (
    (params.recommendation.direction === 'purchase' && !purchaseDecision)
    || (params.recommendation.direction === 'sale' && purchaseDecision)
  ) {
    return {
      ok: false,
      status: 400,
      error: '매입·매출 방향과 최종 부가세 판단이 일치하지 않습니다.',
    }
  }

  const prorationRateBps = params.input.action === 'confirm_different'
    ? params.input.prorationRateBps ?? null
    : null
  if (finalDecision === 'prorated' && prorationRateBps === null) {
    return {
      ok: false,
      status: 400,
      error: '안분 확정에는 안분율과 근거가 필요합니다.',
    }
  }

  const requiredEvidenceCode = finalDecision === 'zero_rated'
    ? 'export_or_zero_rate_documents'
    : finalDecision === 'exempt'
      ? 'exemption_qualification'
      : null
  if (
    requiredEvidenceCode
    && !params.recommendation.requiredEvidence.some((item) => (
      item.code === requiredEvidenceCode && item.status === 'present'
    ))
  ) {
    return {
      ok: false,
      status: 409,
      error: '영세율·면세 확정에 필요한 증빙을 먼저 확인해 주세요.',
    }
  }

  return {
    status: 'confirmed',
    finalDecision,
    reason: params.input.action === 'confirm_different'
      ? params.input.reason
      : params.recommendation.basisLabel,
    prorationRateBps,
  }
}

async function defaultRecommendationLoader(params: Parameters<RecommendationLoader>[0]) {
  const period = buildCompanyHomePeriod({ periodKey: params.periodKey })
  const rows = await loadVatTaxTreatmentDisplayRows({
    tenantId: params.tenantId,
    businessEntityId: params.businessEntityId,
    period,
  })
  const base = rows.find((row) => row.rowId === params.rowId) ?? null
  if (!base || base.recommendationFingerprint === params.expectedFingerprint) return base
  if (base.recommendation !== 'needs_review') return base

  const [enhanced] = await enhanceVatTaxTreatmentRowsWithSingleAi({ rows: [base] })
  return enhanced ?? base
}

function exactFactStillMatches(
  row: typeof bookkeepingTransactionClassification.$inferSelect,
  recommendation: VatTaxTreatmentDisplayRow,
) {
  return row.status === 'confirmed'
    && row.vatDirection === recommendation.direction
    && row.vatTaxType === recommendation.currentVatFact.taxType
    && row.vatSupplyAmountKrw === recommendation.currentVatFact.supplyAmountKrw
    && row.vatTaxAmountKrw === recommendation.currentVatFact.taxAmountKrw
    && row.vatGrossAmountKrw === recommendation.currentVatFact.grossAmountKrw
    && row.vatFactSource === recommendation.currentVatFact.source
    && row.vatFactStatus === recommendation.currentVatFact.status
}

function deductionKind(finalDecision: 'deductible' | 'non_deductible' | 'prorated') {
  if (finalDecision === 'non_deductible') return 'non_deductible_candidate' as const
  if (finalDecision === 'prorated') return 'proration_required' as const
  return 'deductible' as const
}

function captureCanonicalUndoState(params: {
  recommendation: VatTaxTreatmentDisplayRow
  liveRow: ClassificationRow
  existingReview: DeductionReviewRow | null
}): VatTaxTreatmentUndoCanonicalState {
  if (params.recommendation.direction === 'purchase') {
    if (!params.existingReview) return { kind: 'purchase_missing' }
    return vatTaxTreatmentUndoCanonicalStateSchema.parse({
      kind: 'purchase_existing',
      reviewId: params.existingReview.id,
      reviewKind: params.existingReview.kind,
      decision: params.existingReview.decision,
      reason: params.existingReview.reason,
      prorationRateBps: params.existingReview.prorationRateBps,
      confirmedByStaffId: params.existingReview.confirmedByStaffId,
      confirmedAt: params.existingReview.confirmedAt,
      updatedAt: params.existingReview.updatedAt,
    })
  }

  return vatTaxTreatmentUndoCanonicalStateSchema.parse({
    kind: 'sale',
    vatTaxType: params.liveRow.vatTaxType,
    vatFactSource: params.liveRow.vatFactSource,
    vatFactSourceRef: params.liveRow.vatFactSourceRef,
    vatFactStatus: params.liveRow.vatFactStatus,
    confirmedByStaffId: params.liveRow.confirmedByStaffId,
    confirmedAt: params.liveRow.confirmedAt,
    updatedAt: params.liveRow.updatedAt,
  })
}

function captureActionUndoState(params: {
  recommendation: VatTaxTreatmentDisplayRow
  existingReview: DeductionReviewRow | null
  existingAudit: VatTaxTreatmentAuditRow | null
}): VatTaxTreatmentUndoActionState {
  if (params.existingAudit) {
    return vatTaxTreatmentUndoActionStateSchema.parse({
      status: params.existingAudit.status,
      finalDecision: params.existingAudit.finalDecision,
      finalReason: params.existingAudit.finalReason,
      prorationRateBps: params.existingAudit.prorationRateBps,
      confirmedByStaffId: params.existingAudit.confirmedByStaffId,
      confirmedAt: params.existingAudit.confirmedAt,
    })
  }

  return vatTaxTreatmentUndoActionStateSchema.parse({
    status: params.recommendation.finalDecision ? 'confirmed' : 'pending',
    finalDecision: params.recommendation.finalDecision,
    finalReason: params.recommendation.direction === 'purchase'
      ? params.existingReview?.reason || null
      : null,
    prorationRateBps: params.recommendation.direction === 'purchase'
      ? params.existingReview?.prorationRateBps ?? null
      : null,
    confirmedByStaffId: params.recommendation.confirmedByStaffId,
    confirmedAt: params.recommendation.confirmedAt,
  })
}

async function assertCanonicalStateStillMatches(params: {
  tx: VatTransaction
  tenantId: string
  clientId: string
  periodKey: string
  rowId: string
  recommendation: VatTaxTreatmentDisplayRow
}) {
  const [liveRow] = await params.tx
    .select()
    .from(bookkeepingTransactionClassification)
    .where(and(
      eq(bookkeepingTransactionClassification.id, params.rowId),
      eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
    ))
    .limit(1)
  if (!liveRow || !exactFactStillMatches(liveRow, params.recommendation)) {
    throw new VatTaxTreatmentMutationConflict('원천 VAT fact가 변경되었습니다.')
  }

  let existingReview: DeductionReviewRow | null = null
  if (params.recommendation.direction === 'purchase') {
    const [review] = await params.tx
      .select()
      .from(vatDeductionReview)
      .where(and(
        eq(vatDeductionReview.tenantId, params.tenantId),
        eq(vatDeductionReview.clientId, params.clientId),
        eq(vatDeductionReview.periodKey, params.periodKey),
        eq(vatDeductionReview.classificationRowId, params.rowId),
      ))
      .orderBy(desc(vatDeductionReview.updatedAt), desc(vatDeductionReview.id))
      .limit(1)
    existingReview = review ?? null

    const liveFinalDecision = review?.decision !== 'pending'
      && review?.confirmedByStaffId
      && review?.confirmedAt
      ? review.decision
      : null
    if (liveFinalDecision !== params.recommendation.finalDecision) {
      throw new VatTaxTreatmentMutationConflict('매입 공제 결정이 변경되었습니다.')
    }
  }

  return { liveRow, existingReview }
}

async function writePurchaseDecision(params: {
  tx: VatTransaction
  tenantId: string
  clientId: string
  periodKey: string
  rowId: string
  staffId: string
  timestamp: string
  recommendation: VatTaxTreatmentDisplayRow
  decision: ResolvedMutationDecision
  liveRow: ClassificationRow
  existingReview: DeductionReviewRow | null
}) {
  const purchaseDecision = params.decision.finalDecision as 'deductible' | 'non_deductible' | 'prorated'
  if (params.existingReview) {
    await params.tx
      .update(vatDeductionReview)
      .set({
        kind: deductionKind(purchaseDecision),
        decision: purchaseDecision,
        reason: params.decision.reason ?? '',
        prorationRateBps: params.decision.prorationRateBps,
        confirmedByStaffId: params.staffId,
        confirmedAt: params.timestamp,
        updatedAt: params.timestamp,
      })
      .where(and(
        eq(vatDeductionReview.id, params.existingReview.id),
        eq(vatDeductionReview.tenantId, params.tenantId),
      ))
    return
  }

  await params.tx.insert(vatDeductionReview).values({
    id: randomUUID(),
    tenantId: params.tenantId,
    clientId: params.clientId,
    periodKey: params.periodKey,
    sourceVoucherId: null,
    sourceVoucherLineId: null,
    classificationRowId: params.rowId,
    description: params.liveRow.description?.trim() || params.liveRow.merchantName?.trim() || '거래 내용 미확인',
    counterparty: params.liveRow.merchantName,
    supplyAmountKrw: params.recommendation.currentVatFact.supplyAmountKrw,
    inputTaxKrw: params.recommendation.currentVatFact.taxAmountKrw,
    kind: deductionKind(purchaseDecision),
    decision: purchaseDecision,
    reason: params.decision.reason ?? '',
    prorationRateBps: params.decision.prorationRateBps,
    confirmedByStaffId: params.staffId,
    confirmedAt: params.timestamp,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  })
}

async function writeSaleDecision(params: {
  tx: VatTransaction
  tenantId: string
  rowId: string
  staffId: string
  timestamp: string
  recommendation: VatTaxTreatmentDisplayRow
  decision: ResolvedMutationDecision
}) {
  const saleDecision = params.decision.finalDecision as 'taxable' | 'zero_rated' | 'exempt' | 'non_taxable'
  const exactFact = manualVatFactInputSchema.safeParse({
    direction: 'sale',
    taxType: saleDecision,
    supplyAmountKrw: params.recommendation.currentVatFact.supplyAmountKrw,
    taxAmountKrw: params.recommendation.currentVatFact.taxAmountKrw,
    grossAmountKrw: params.recommendation.currentVatFact.grossAmountKrw,
  })
  if (!exactFact.success) {
    throw new VatTaxTreatmentMutationConflict('변경한 과세유형과 현재 공급가액·세액이 일치하지 않습니다.')
  }

  await params.tx
    .update(bookkeepingTransactionClassification)
    .set({
      vatTaxType: saleDecision,
      vatFactSource: 'manual',
      vatFactSourceRef: `staff:${params.staffId}:${params.rowId}`,
      vatFactStatus: 'confirmed',
      confirmedByStaffId: params.staffId,
      confirmedAt: params.timestamp,
      updatedAt: params.timestamp,
    })
    .where(and(
      eq(bookkeepingTransactionClassification.id, params.rowId),
      eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
    ))
}

async function writeCanonicalDecision(params: {
  tx: VatTransaction
  tenantId: string
  clientId: string
  periodKey: string
  rowId: string
  staffId: string
  timestamp: string
  recommendation: VatTaxTreatmentDisplayRow
  decision: ResolvedMutationDecision
  liveRow: ClassificationRow
  existingReview: DeductionReviewRow | null
}) {
  if (params.decision.status !== 'confirmed' || !params.decision.finalDecision) return
  if (params.recommendation.direction === 'purchase') {
    await writePurchaseDecision(params)
  } else {
    await writeSaleDecision(params)
  }
}

async function writeAuditSnapshot(params: {
  tx: VatTransaction
  tenantId: string
  clientId: string
  periodKey: string
  rowId: string
  staffId: string
  timestamp: string
  recommendation: VatTaxTreatmentDisplayRow
  decision: ResolvedMutationDecision
  undoTokenHash: string
  undoCanonicalState: VatTaxTreatmentUndoCanonicalState
  undoActionState: VatTaxTreatmentUndoActionState
}) {
  const snapshot = {
    direction: params.recommendation.direction,
    recommendation: params.recommendation.recommendation,
    recommendationSource: params.recommendation.source,
    confidence: params.recommendation.confidence,
    basisLabel: params.recommendation.basisLabel,
    ruleReference: params.recommendation.ruleReference,
    ruleVersion: params.recommendation.ruleVersion,
    aiProvider: params.recommendation.aiTrace?.provider ?? null,
    aiModelName: params.recommendation.aiTrace?.modelName ?? null,
    aiPromptVersion: params.recommendation.aiTrace?.promptVersion ?? null,
    requiredEvidenceJson: JSON.stringify(params.recommendation.requiredEvidence),
    missingFactsJson: JSON.stringify(params.recommendation.missingFacts),
    hometaxComparisonMode: params.recommendation.hometaxComparisonMode,
    hometaxAction: params.recommendation.hometaxAction,
    recommendationFingerprint: params.recommendation.recommendationFingerprint,
    status: params.decision.status,
    finalDecision: params.decision.finalDecision,
    finalReason: params.decision.reason,
    prorationRateBps: params.decision.prorationRateBps,
    confirmedByStaffId: params.decision.status === 'confirmed' ? params.staffId : null,
    confirmedAt: params.decision.status === 'confirmed' ? params.timestamp : null,
    undoTokenHash: params.undoTokenHash,
    undoCanonicalStateJson: JSON.stringify(params.undoCanonicalState),
    undoActionStateJson: JSON.stringify(params.undoActionState),
    recommendedAt: params.timestamp,
    updatedAt: params.timestamp,
  }

  await params.tx
    .insert(vatTaxTreatmentReview)
    .values({
      id: randomUUID(),
      tenantId: params.tenantId,
      clientId: params.clientId,
      periodKey: params.periodKey,
      classificationRowId: params.rowId,
      ...snapshot,
      createdAt: params.timestamp,
    })
    .onConflictDoUpdate({
      target: [
        vatTaxTreatmentReview.tenantId,
        vatTaxTreatmentReview.clientId,
        vatTaxTreatmentReview.periodKey,
        vatTaxTreatmentReview.classificationRowId,
      ],
      set: snapshot,
    })
}

export async function applyVatTaxTreatmentMutation(params: {
  tenantId: string
  staffId: string
  rowId: string
  input: VatTaxTreatmentMutationInput
  loadRecommendation?: RecommendationLoader
}): Promise<MutationFailure | MutationSuccess> {
  const [scope] = await db
    .select({
      rowId: bookkeepingTransactionClassification.id,
      clientId: uploadSession.clientId,
    })
    .from(bookkeepingTransactionClassification)
    .innerJoin(uploadSession, and(
      eq(uploadSession.id, bookkeepingTransactionClassification.uploadSessionId),
      eq(uploadSession.tenantId, params.tenantId),
    ))
    .where(and(
      eq(bookkeepingTransactionClassification.id, params.rowId),
      eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
    ))
    .limit(1)
  if (!scope) {
    return { ok: false, status: 404, error: '부가세 판단 거래를 찾을 수 없습니다.' }
  }

  if (params.input.action === 'undo') {
    return undoVatTaxTreatmentMutation({
      tenantId: params.tenantId,
      clientId: scope.clientId,
      rowId: params.rowId,
      periodKey: params.input.periodKey,
      undoToken: params.input.undoToken,
    })
  }

  const loadRecommendation = params.loadRecommendation ?? defaultRecommendationLoader
  const recommendation = await loadRecommendation({
    tenantId: params.tenantId,
    businessEntityId: scope.clientId,
    periodKey: params.input.periodKey,
    rowId: params.rowId,
    expectedFingerprint: params.input.recommendationFingerprint,
  })
  if (!recommendation || recommendation.businessEntityId !== scope.clientId) {
    return { ok: false, status: 409, error: '현재 신고 기간의 부가세 판단 행이 아닙니다.' }
  }
  if (recommendation.recommendationFingerprint !== params.input.recommendationFingerprint) {
    return { ok: false, status: 409, error: '거래 또는 판단 기준이 변경되었습니다. 최신 내용을 다시 확인해 주세요.' }
  }

  const decision = mutationDecision({ input: params.input, recommendation })
  if ('ok' in decision) return decision

  const timestamp = toDBString(now())
  const undoToken = randomUUID()
  const undoTokenHash = hashVatTaxTreatmentUndoToken(undoToken)
  try {
    await db.transaction(async (tx) => {
      const canonicalState = await assertCanonicalStateStillMatches({
        tx,
        tenantId: params.tenantId,
        clientId: scope.clientId,
        periodKey: params.input.periodKey,
        rowId: params.rowId,
        recommendation,
      })
      const existingAudit = await loadVatTaxTreatmentAudit({
        tx,
        tenantId: params.tenantId,
        clientId: scope.clientId,
        periodKey: params.input.periodKey,
        rowId: params.rowId,
      })
      const undoCanonicalState = captureCanonicalUndoState({
        recommendation,
        ...canonicalState,
      })
      const undoActionState = captureActionUndoState({
        recommendation,
        existingReview: canonicalState.existingReview,
        existingAudit,
      })
      await writeCanonicalDecision({
        tx,
        tenantId: params.tenantId,
        clientId: scope.clientId,
        periodKey: params.input.periodKey,
        rowId: params.rowId,
        staffId: params.staffId,
        timestamp,
        recommendation,
        decision,
        ...canonicalState,
      })
      await writeAuditSnapshot({
        tx,
        tenantId: params.tenantId,
        clientId: scope.clientId,
        periodKey: params.input.periodKey,
        rowId: params.rowId,
        staffId: params.staffId,
        timestamp,
        recommendation,
        decision,
        undoTokenHash,
        undoCanonicalState,
        undoActionState,
      })
    })
  } catch (error) {
    if (error instanceof VatTaxTreatmentMutationConflict) {
      return { ok: false, status: 409, error: error.message }
    }
    throw error
  }

  return {
    ok: true,
    status: decision.status,
    finalDecision: decision.finalDecision,
    undoToken,
  }
}
