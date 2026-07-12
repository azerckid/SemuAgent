import { createHash } from 'node:crypto'
import type { VatTaxTreatmentRecommendation } from '@/lib/validations/vat-tax-treatment'
import { deriveVatTaxTreatmentJudgmentContract } from './tax-treatment-judgment'

type VatTaxTreatmentFingerprintInput = Pick<
  VatTaxTreatmentRecommendation,
  | 'tenantId'
  | 'businessEntityId'
  | 'periodKey'
  | 'classificationRowId'
  | 'currentVatFact'
  | 'recommendation'
  | 'source'
  | 'requiredEvidence'
  | 'ruleVersion'
>

export function buildVatTaxTreatmentRecommendationFingerprint(
  row: VatTaxTreatmentFingerprintInput,
) {
  const canonical = {
    tenantId: row.tenantId,
    businessEntityId: row.businessEntityId,
    periodKey: row.periodKey,
    classificationRowId: row.classificationRowId,
    currentVatFact: {
      taxType: row.currentVatFact.taxType,
      supplyAmountKrw: row.currentVatFact.supplyAmountKrw,
      taxAmountKrw: row.currentVatFact.taxAmountKrw,
      grossAmountKrw: row.currentVatFact.grossAmountKrw,
      source: row.currentVatFact.source,
      status: row.currentVatFact.status,
    },
    recommendation: row.recommendation,
    source: row.source,
    requiredEvidence: [...row.requiredEvidence]
      .map(({ code, status }) => ({ code, status }))
      .sort((left, right) => (
        left.code.localeCompare(right.code) || left.status.localeCompare(right.status)
      )),
    ruleVersion: row.ruleVersion,
  }

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

export function withVatTaxTreatmentRecommendationFingerprint<
  T extends VatTaxTreatmentFingerprintInput & Pick<
    VatTaxTreatmentRecommendation,
    'aiRuntimeStatus' | 'finalDecision'
  >,
>(row: T) {
  return {
    ...row,
    ...deriveVatTaxTreatmentJudgmentContract(row),
    recommendationFingerprint: buildVatTaxTreatmentRecommendationFingerprint(row),
  }
}
