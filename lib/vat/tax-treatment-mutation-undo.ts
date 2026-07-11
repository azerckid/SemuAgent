import { timingSafeEqual } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingTransactionClassification,
  vatDeductionReview,
  vatTaxTreatmentReview,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import type { VatTaxTreatmentFinalDecision } from '@/lib/validations/vat-tax-treatment'
import {
  hashVatTaxTreatmentUndoToken,
  vatTaxTreatmentUndoActionStateSchema,
  vatTaxTreatmentUndoCanonicalStateSchema,
  type VatTaxTreatmentUndoCanonicalState,
} from './tax-treatment-undo'

type VatTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type ClassificationRow = typeof bookkeepingTransactionClassification.$inferSelect
type DeductionReviewRow = typeof vatDeductionReview.$inferSelect

export type VatTaxTreatmentAuditRow = typeof vatTaxTreatmentReview.$inferSelect

type VatTaxTreatmentUndoResult =
  | {
      ok: true
      status: 'pending' | 'confirmed' | 'held' | 'expert_review'
      finalDecision: VatTaxTreatmentFinalDecision | null
      undoToken: null
    }
  | { ok: false; status: 409; error: string }

class VatTaxTreatmentUndoConflict extends Error {}

export async function loadVatTaxTreatmentAudit(params: {
  tx: VatTransaction
  tenantId: string
  clientId: string
  periodKey: string
  rowId: string
}) {
  const [audit] = await params.tx
    .select()
    .from(vatTaxTreatmentReview)
    .where(and(
      eq(vatTaxTreatmentReview.tenantId, params.tenantId),
      eq(vatTaxTreatmentReview.clientId, params.clientId),
      eq(vatTaxTreatmentReview.periodKey, params.periodKey),
      eq(vatTaxTreatmentReview.classificationRowId, params.rowId),
    ))
    .limit(1)
  return audit ?? null
}

export async function undoVatTaxTreatmentMutation(params: {
  tenantId: string
  clientId: string
  rowId: string
  periodKey: string
  undoToken: string
}): Promise<VatTaxTreatmentUndoResult> {
  const timestamp = toDBString(now())
  try {
    const restored = await db.transaction(async (tx) => {
      const audit = await loadVatTaxTreatmentAudit({ tx, ...params })
      if (
        !audit?.undoTokenHash
        || !audit.undoCanonicalStateJson
        || !audit.undoActionStateJson
        || !undoTokenMatches(audit.undoTokenHash, params.undoToken)
      ) {
        throw new VatTaxTreatmentUndoConflict('가장 최근 부가세 판단만 되돌릴 수 있습니다.')
      }

      const canonicalSnapshot = vatTaxTreatmentUndoCanonicalStateSchema.safeParse(
        parseUndoJson(audit.undoCanonicalStateJson),
      )
      const actionSnapshot = vatTaxTreatmentUndoActionStateSchema.safeParse(
        parseUndoJson(audit.undoActionStateJson),
      )
      if (!canonicalSnapshot.success || !actionSnapshot.success) {
        throw new VatTaxTreatmentUndoConflict('되돌리기 상태를 확인할 수 없습니다.')
      }

      const canonicalRows = await loadUndoCanonicalRows({ tx, ...params })
      const stillCurrent = audit.status === 'confirmed'
        ? canonicalStateMatchesCurrentAction({ audit, ...canonicalRows })
        : canonicalStateMatchesSnapshot({ snapshot: canonicalSnapshot.data, ...canonicalRows })
      if (!stillCurrent) {
        throw new VatTaxTreatmentUndoConflict('확정값이 다시 변경되어 되돌릴 수 없습니다.')
      }

      await restoreCanonicalUndoState({
        tx,
        ...params,
        snapshot: canonicalSnapshot.data,
        currentReview: canonicalRows.currentReview,
      })
      await tx
        .update(vatTaxTreatmentReview)
        .set({
          status: actionSnapshot.data.status,
          finalDecision: actionSnapshot.data.finalDecision,
          finalReason: actionSnapshot.data.finalReason,
          prorationRateBps: actionSnapshot.data.prorationRateBps,
          confirmedByStaffId: actionSnapshot.data.confirmedByStaffId,
          confirmedAt: actionSnapshot.data.confirmedAt,
          undoTokenHash: null,
          undoCanonicalStateJson: null,
          undoActionStateJson: null,
          updatedAt: timestamp,
        })
        .where(and(
          eq(vatTaxTreatmentReview.id, audit.id),
          eq(vatTaxTreatmentReview.tenantId, params.tenantId),
        ))
      return actionSnapshot.data
    })

    return {
      ok: true,
      status: restored.status,
      finalDecision: restored.finalDecision,
      undoToken: null,
    }
  } catch (error) {
    if (error instanceof VatTaxTreatmentUndoConflict) {
      return { ok: false, status: 409, error: error.message }
    }
    throw error
  }
}

async function loadUndoCanonicalRows(params: {
  tx: VatTransaction
  tenantId: string
  clientId: string
  periodKey: string
  rowId: string
}) {
  const [liveRow] = await params.tx
    .select()
    .from(bookkeepingTransactionClassification)
    .where(and(
      eq(bookkeepingTransactionClassification.id, params.rowId),
      eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
    ))
    .limit(1)
  if (!liveRow) throw new VatTaxTreatmentUndoConflict('되돌릴 부가세 판단 거래가 없습니다.')

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

  return { liveRow, currentReview: review ?? null }
}

function canonicalStateMatchesSnapshot(params: {
  snapshot: VatTaxTreatmentUndoCanonicalState
  liveRow: ClassificationRow
  currentReview: DeductionReviewRow | null
}) {
  const { snapshot } = params
  if (snapshot.kind === 'purchase_missing') return params.currentReview === null
  if (snapshot.kind === 'purchase_existing') {
    const review = params.currentReview
    return review?.id === snapshot.reviewId
      && review.kind === snapshot.reviewKind
      && review.decision === snapshot.decision
      && review.reason === snapshot.reason
      && review.prorationRateBps === snapshot.prorationRateBps
      && review.confirmedByStaffId === snapshot.confirmedByStaffId
      && review.confirmedAt === snapshot.confirmedAt
      && review.updatedAt === snapshot.updatedAt
  }
  return params.liveRow.vatTaxType === snapshot.vatTaxType
    && params.liveRow.vatFactSource === snapshot.vatFactSource
    && params.liveRow.vatFactSourceRef === snapshot.vatFactSourceRef
    && params.liveRow.vatFactStatus === snapshot.vatFactStatus
    && params.liveRow.confirmedByStaffId === snapshot.confirmedByStaffId
    && params.liveRow.confirmedAt === snapshot.confirmedAt
    && params.liveRow.updatedAt === snapshot.updatedAt
}

function canonicalStateMatchesCurrentAction(params: {
  audit: VatTaxTreatmentAuditRow
  liveRow: ClassificationRow
  currentReview: DeductionReviewRow | null
}) {
  if (params.audit.status !== 'confirmed' || !params.audit.finalDecision) return false
  if (params.audit.direction === 'purchase') {
    const review = params.currentReview
    return review?.decision === params.audit.finalDecision
      && review.confirmedByStaffId === params.audit.confirmedByStaffId
      && review.confirmedAt === params.audit.confirmedAt
  }
  return params.liveRow.vatTaxType === params.audit.finalDecision
    && params.liveRow.vatFactSource === 'manual'
    && params.liveRow.vatFactStatus === 'confirmed'
    && params.liveRow.confirmedByStaffId === params.audit.confirmedByStaffId
    && params.liveRow.confirmedAt === params.audit.confirmedAt
}

async function restoreCanonicalUndoState(params: {
  tx: VatTransaction
  tenantId: string
  clientId: string
  periodKey: string
  rowId: string
  snapshot: VatTaxTreatmentUndoCanonicalState
  currentReview: DeductionReviewRow | null
}) {
  if (params.snapshot.kind === 'purchase_missing') {
    if (!params.currentReview) return
    await params.tx
      .delete(vatDeductionReview)
      .where(and(
        eq(vatDeductionReview.id, params.currentReview.id),
        eq(vatDeductionReview.tenantId, params.tenantId),
        eq(vatDeductionReview.clientId, params.clientId),
        eq(vatDeductionReview.periodKey, params.periodKey),
      ))
    return
  }
  if (params.snapshot.kind === 'purchase_existing') {
    await params.tx
      .update(vatDeductionReview)
      .set({
        kind: params.snapshot.reviewKind,
        decision: params.snapshot.decision,
        reason: params.snapshot.reason,
        prorationRateBps: params.snapshot.prorationRateBps,
        confirmedByStaffId: params.snapshot.confirmedByStaffId,
        confirmedAt: params.snapshot.confirmedAt,
        updatedAt: params.snapshot.updatedAt,
      })
      .where(and(
        eq(vatDeductionReview.id, params.snapshot.reviewId),
        eq(vatDeductionReview.tenantId, params.tenantId),
      ))
    return
  }

  await params.tx
    .update(bookkeepingTransactionClassification)
    .set({
      vatTaxType: params.snapshot.vatTaxType,
      vatFactSource: params.snapshot.vatFactSource,
      vatFactSourceRef: params.snapshot.vatFactSourceRef,
      vatFactStatus: params.snapshot.vatFactStatus,
      confirmedByStaffId: params.snapshot.confirmedByStaffId,
      confirmedAt: params.snapshot.confirmedAt,
      updatedAt: params.snapshot.updatedAt,
    })
    .where(and(
      eq(bookkeepingTransactionClassification.id, params.rowId),
      eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
    ))
}

function undoTokenMatches(storedHash: string, token: string) {
  const actual = Buffer.from(storedHash, 'hex')
  const expected = Buffer.from(hashVatTaxTreatmentUndoToken(token), 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function parseUndoJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}
