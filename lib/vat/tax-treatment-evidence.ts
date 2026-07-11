import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import { db } from '@/lib/db'
import {
  bookkeepingTransactionClassification,
  uploadSession,
  vatTaxTreatmentEvidenceAttestation,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'
import type {
  VatTaxTreatmentDisplayRow,
  VatTaxTreatmentEvidenceMutationInput,
} from '@/lib/validations/vat-tax-treatment'
import { enhanceVatTaxTreatmentRowsWithAi } from './tax-treatment-ai'
import { loadVatTaxTreatmentDisplayRows } from './tax-treatment-summary'

type EvidenceMutationFailure = {
  ok: false
  status: 400 | 404 | 409
  error: string
}

type EvidenceMutationSuccess = {
  ok: true
  evidenceCode: VatTaxTreatmentEvidenceMutationInput['evidenceCode']
  status: 'present' | 'revoked'
  confirmedAt: string | null
}

type RecommendationLoader = (params: {
  tenantId: string
  businessEntityId: string
  periodKey: string
  rowId: string
  expectedFingerprint: string
}) => Promise<VatTaxTreatmentDisplayRow | null>

async function defaultRecommendationLoader(params: Parameters<RecommendationLoader>[0]) {
  const period = buildCompanyHomePeriod({ periodKey: params.periodKey })
  const rows = await loadVatTaxTreatmentDisplayRows({
    tenantId: params.tenantId,
    businessEntityId: params.businessEntityId,
    period,
  })
  const base = rows.find((row) => row.rowId === params.rowId) ?? null
  if (!base || base.recommendationFingerprint === params.expectedFingerprint) return base

  const [enhanced] = await enhanceVatTaxTreatmentRowsWithAi({ rows: [base] })
  return enhanced ?? base
}

type ExactVatFactState = Pick<
  typeof bookkeepingTransactionClassification.$inferSelect,
  | 'status'
  | 'vatDirection'
  | 'vatTaxType'
  | 'vatSupplyAmountKrw'
  | 'vatTaxAmountKrw'
  | 'vatGrossAmountKrw'
  | 'vatFactSource'
  | 'vatFactStatus'
>

function exactFactStillMatches(
  row: ExactVatFactState,
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

export async function applyVatTaxTreatmentEvidenceMutation(params: {
  tenantId: string
  staffId: string
  rowId: string
  input: VatTaxTreatmentEvidenceMutationInput
  loadRecommendation?: RecommendationLoader
}): Promise<EvidenceMutationFailure | EvidenceMutationSuccess> {
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
  if (recommendation.direction !== 'sale') {
    return { ok: false, status: 400, error: '영세율·면세 증빙 확인은 매출 거래에서만 가능합니다.' }
  }
  if (
    params.input.action === 'confirm'
    && !recommendation.requiredEvidence.some((item) => item.code === params.input.evidenceCode)
  ) {
    return { ok: false, status: 400, error: '이 거래에 필요한 영세율·면세 증빙 항목이 아닙니다.' }
  }

  const timestamp = toDBString(now())
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          status: bookkeepingTransactionClassification.status,
          vatDirection: bookkeepingTransactionClassification.vatDirection,
          vatTaxType: bookkeepingTransactionClassification.vatTaxType,
          vatSupplyAmountKrw: bookkeepingTransactionClassification.vatSupplyAmountKrw,
          vatTaxAmountKrw: bookkeepingTransactionClassification.vatTaxAmountKrw,
          vatGrossAmountKrw: bookkeepingTransactionClassification.vatGrossAmountKrw,
          vatFactSource: bookkeepingTransactionClassification.vatFactSource,
          vatFactStatus: bookkeepingTransactionClassification.vatFactStatus,
          clientId: uploadSession.clientId,
        })
        .from(bookkeepingTransactionClassification)
        .innerJoin(uploadSession, and(
          eq(uploadSession.id, bookkeepingTransactionClassification.uploadSessionId),
          eq(uploadSession.tenantId, params.tenantId),
          eq(uploadSession.clientId, scope.clientId),
        ))
        .where(and(
          eq(bookkeepingTransactionClassification.id, params.rowId),
          eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
        ))
        .limit(1)
      if (!current || !exactFactStillMatches(current, recommendation)) {
        throw new Error('STALE_VAT_EVIDENCE_SCOPE')
      }

      const [existing] = await tx
        .select()
        .from(vatTaxTreatmentEvidenceAttestation)
        .where(and(
          eq(vatTaxTreatmentEvidenceAttestation.tenantId, params.tenantId),
          eq(vatTaxTreatmentEvidenceAttestation.clientId, scope.clientId),
          eq(vatTaxTreatmentEvidenceAttestation.periodKey, params.input.periodKey),
          eq(vatTaxTreatmentEvidenceAttestation.classificationRowId, params.rowId),
          eq(vatTaxTreatmentEvidenceAttestation.evidenceCode, params.input.evidenceCode),
        ))
        .limit(1)

      if (params.input.action === 'confirm') {
        if (existing?.status === 'present') {
          return {
            ok: true as const,
            evidenceCode: params.input.evidenceCode,
            status: 'present' as const,
            confirmedAt: existing.confirmedAt,
          }
        }
        await tx
          .insert(vatTaxTreatmentEvidenceAttestation)
          .values({
            id: existing?.id ?? randomUUID(),
            tenantId: params.tenantId,
            clientId: scope.clientId,
            periodKey: params.input.periodKey,
            classificationRowId: params.rowId,
            evidenceCode: params.input.evidenceCode,
            status: 'present',
            confirmedByStaffId: params.staffId,
            confirmedAt: timestamp,
            revokedByStaffId: null,
            revokedAt: null,
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp,
          })
          .onConflictDoUpdate({
            target: [
              vatTaxTreatmentEvidenceAttestation.tenantId,
              vatTaxTreatmentEvidenceAttestation.clientId,
              vatTaxTreatmentEvidenceAttestation.periodKey,
              vatTaxTreatmentEvidenceAttestation.classificationRowId,
              vatTaxTreatmentEvidenceAttestation.evidenceCode,
            ],
            set: {
              status: 'present',
              confirmedByStaffId: params.staffId,
              confirmedAt: timestamp,
              revokedByStaffId: null,
              revokedAt: null,
              updatedAt: timestamp,
            },
          })
        return {
          ok: true as const,
          evidenceCode: params.input.evidenceCode,
          status: 'present' as const,
          confirmedAt: timestamp,
        }
      }

      if (!existing || existing.status !== 'present') {
        return {
          ok: true as const,
          evidenceCode: params.input.evidenceCode,
          status: 'revoked' as const,
          confirmedAt: null,
        }
      }
      await tx
        .update(vatTaxTreatmentEvidenceAttestation)
        .set({
          status: 'revoked',
          revokedByStaffId: params.staffId,
          revokedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(and(
          eq(vatTaxTreatmentEvidenceAttestation.id, existing.id),
          eq(vatTaxTreatmentEvidenceAttestation.tenantId, params.tenantId),
        ))
      return {
        ok: true as const,
        evidenceCode: params.input.evidenceCode,
        status: 'revoked' as const,
        confirmedAt: null,
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE_VAT_EVIDENCE_SCOPE') {
      return { ok: false, status: 409, error: '거래의 부가세 원천값이 변경되었습니다. 최신 내용을 다시 확인해 주세요.' }
    }
    throw error
  }
}
