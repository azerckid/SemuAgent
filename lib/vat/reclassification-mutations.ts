import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingTransactionClassification,
  vatDeductionReview,
  vatPeriodSummary,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import type { VatReclassificationMutationInput } from '@/lib/validations/vat-reclassification'
import { resolveReclassificationCandidates, resolveEligibleReclassificationEvidence } from './reclassification-evidence-resolver'
import type { ReclassificationSavingsCandidate } from './reclassification-savings'
import { buildVatPeriodRecalculation } from './summary'

type ReclassificationMutationFailure = {
  ok: false
  status: 400 | 404 | 409
  error: string
}

type ReclassificationMutationSuccess = {
  ok: true
  decision: 'reclassified' | 'kept_as_is'
  reviewId: string
  pendingDeductionCount: number
}

type VatTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

class ReclassificationMutationConflict extends Error {}

export function validateReclassificationConfirmation(params: {
  candidate: ReclassificationSavingsCandidate
  input: VatReclassificationMutationInput
}): string | null {
  if (params.candidate.userDecision !== 'pending') {
    return '이미 처리된 재분류 후보입니다.'
  }
  if (params.candidate.candidateFingerprint !== params.input.expectedFingerprint) {
    return '후보 정보가 변경되었습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.'
  }
  if (params.input.action === 'reclassify') {
    if (!params.candidate.eligibleEvidence.present) {
      return '공제로 재분류하려면 연결된 세금계산서·현금영수증·카드 증빙이 필요합니다.'
    }
    if (params.input.businessContext.trim().length < 2) {
      return '업무 목적 또는 참석자를 입력해 주세요.'
    }
  }
  return null
}

function targetCategoryLabel(value: 'welfare_expense' | 'meeting_expense') {
  return value === 'welfare_expense' ? '복리후생비' : '회의비'
}

function buildDecisionReason(params: {
  previousReason: string
  input: VatReclassificationMutationInput
}) {
  const base = params.previousReason.trim() || '접대비 관련 매입세액'
  if (params.input.action === 'keep_as_is') {
    const note = params.input.reason?.trim()
    return note ? `${base} · 접대비 유지 확정: ${note}` : `${base} · 접대비 유지 확정`
  }
  return [
    base,
    `접대비 재분류 확정(${targetCategoryLabel(params.input.targetCategory)})`,
    `업무 목적/참석자: ${params.input.businessContext.trim()}`,
  ].join(' · ')
}

async function recalculatePeriodSummary(params: {
  tx: VatTransaction
  tenantId: string
  clientId: string
  periodKey: string
  timestamp: string
}) {
  const [summaryRows, reviewRows] = await Promise.all([
    params.tx
      .select({
        id: vatPeriodSummary.id,
        outputTaxKrw: vatPeriodSummary.outputTaxKrw,
        inputTaxKrw: vatPeriodSummary.inputTaxKrw,
      })
      .from(vatPeriodSummary)
      .where(and(
        eq(vatPeriodSummary.tenantId, params.tenantId),
        eq(vatPeriodSummary.clientId, params.clientId),
        eq(vatPeriodSummary.periodKey, params.periodKey),
        eq(vatPeriodSummary.filingType, 'final'),
      ))
      .limit(1),
    params.tx
      .select({
        decision: vatDeductionReview.decision,
        inputTaxKrw: vatDeductionReview.inputTaxKrw,
        prorationRateBps: vatDeductionReview.prorationRateBps,
      })
      .from(vatDeductionReview)
      .where(and(
        eq(vatDeductionReview.tenantId, params.tenantId),
        eq(vatDeductionReview.clientId, params.clientId),
        eq(vatDeductionReview.periodKey, params.periodKey),
      )),
  ])

  const summary = summaryRows[0]
  const recalculation = buildVatPeriodRecalculation({
    outputTaxKrw: summary?.outputTaxKrw ?? 0,
    inputTaxKrw: summary?.inputTaxKrw ?? 0,
  }, reviewRows)

  if (summary) {
    await params.tx
      .update(vatPeriodSummary)
      .set({
        inputTaxDeductibleKrw: recalculation.inputTaxDeductibleKrw,
        payableTaxKrw: recalculation.payableTaxKrw,
        pendingDeductionCount: recalculation.pendingDeductionCount,
        packageStatus: recalculation.packageStatus,
        updatedAt: params.timestamp,
      })
      .where(and(
        eq(vatPeriodSummary.id, summary.id),
        eq(vatPeriodSummary.tenantId, params.tenantId),
      ))
  }

  return recalculation
}

export async function applyVatReclassificationMutation(params: {
  tenantId: string
  staffId: string
  reviewId: string
  input: VatReclassificationMutationInput
}): Promise<ReclassificationMutationFailure | ReclassificationMutationSuccess> {
  const [scope] = await db
    .select({
      clientId: vatDeductionReview.clientId,
      periodKey: vatDeductionReview.periodKey,
    })
    .from(vatDeductionReview)
    .where(and(
      eq(vatDeductionReview.id, params.reviewId),
      eq(vatDeductionReview.tenantId, params.tenantId),
    ))
    .limit(1)

  if (!scope || scope.periodKey !== params.input.periodKey) {
    return { ok: false, status: 404, error: '재분류 후보를 찾을 수 없습니다.' }
  }

  const candidates = await resolveReclassificationCandidates({
    tenantId: params.tenantId,
    clientId: scope.clientId,
    periodKey: scope.periodKey,
  })
  const candidate = candidates.find((item) => item.reviewRowId === params.reviewId)
  if (!candidate) {
    return { ok: false, status: 404, error: '재분류 후보를 찾을 수 없습니다.' }
  }

  const validationError = validateReclassificationConfirmation({
    candidate,
    input: params.input,
  })
  if (validationError) {
    return {
      ok: false,
      status: candidate.candidateFingerprint === params.input.expectedFingerprint ? 400 : 409,
      error: validationError,
    }
  }

  const timestamp = toDBString(now())
  try {
    const recalculation = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: vatDeductionReview.id,
          decision: vatDeductionReview.decision,
          reason: vatDeductionReview.reason,
          sourceVoucherId: vatDeductionReview.sourceVoucherId,
          sourceVoucherLineId: vatDeductionReview.sourceVoucherLineId,
          sourceType: bookkeepingTransactionClassification.sourceType,
          linkedEvidenceRowId: bookkeepingTransactionClassification.linkedEvidenceRowId,
        })
        .from(vatDeductionReview)
        .leftJoin(
          bookkeepingTransactionClassification,
          eq(bookkeepingTransactionClassification.id, vatDeductionReview.classificationRowId),
        )
        .where(and(
          eq(vatDeductionReview.id, params.reviewId),
          eq(vatDeductionReview.tenantId, params.tenantId),
          eq(vatDeductionReview.clientId, scope.clientId),
          eq(vatDeductionReview.periodKey, scope.periodKey),
        ))
        .limit(1)

      if (!current || current.decision !== 'pending') {
        throw new ReclassificationMutationConflict('이미 처리된 재분류 후보입니다.')
      }

      const liveEvidence = resolveEligibleReclassificationEvidence({
        sourceVoucherId: current.sourceVoucherId,
        sourceVoucherLineId: current.sourceVoucherLineId,
        sourceType: current.sourceType,
        linkedEvidenceRowId: current.linkedEvidenceRowId,
      })
      if (params.input.action === 'reclassify' && !liveEvidence.present) {
        throw new ReclassificationMutationConflict('연결된 적격증빙이 없어 공제로 재분류할 수 없습니다.')
      }

      await tx
        .update(vatDeductionReview)
        .set({
          decision: params.input.action === 'reclassify' ? 'deductible' : 'non_deductible',
          reason: buildDecisionReason({
            previousReason: current.reason,
            input: params.input,
          }),
          prorationRateBps: null,
          confirmedByStaffId: params.staffId,
          confirmedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(and(
          eq(vatDeductionReview.id, params.reviewId),
          eq(vatDeductionReview.tenantId, params.tenantId),
          eq(vatDeductionReview.decision, 'pending'),
        ))

      return recalculatePeriodSummary({
        tx,
        tenantId: params.tenantId,
        clientId: scope.clientId,
        periodKey: scope.periodKey,
        timestamp,
      })
    })

    return {
      ok: true,
      decision: params.input.action === 'reclassify' ? 'reclassified' : 'kept_as_is',
      reviewId: params.reviewId,
      pendingDeductionCount: recalculation.pendingDeductionCount,
    }
  } catch (error) {
    if (error instanceof ReclassificationMutationConflict) {
      return { ok: false, status: 409, error: error.message }
    }
    throw error
  }
}
