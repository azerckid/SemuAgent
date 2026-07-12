import { createHash } from 'node:crypto'
import {
  vatTaxTreatmentEvidenceSearchSchema,
  type VatTaxTreatmentRecommendation,
} from '@/lib/validations/vat-tax-treatment'
import { buildVatTaxTreatmentEvidenceSearch } from './tax-treatment-evidence-trace'
import { deriveVatTaxTreatmentJudgmentContract } from './tax-treatment-judgment'

type VatTaxTreatmentFingerprintBaseInput = Pick<
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
  | 'ruleReference'
>

type VatTaxTreatmentFingerprintInput = VatTaxTreatmentFingerprintBaseInput & Pick<
  VatTaxTreatmentRecommendation,
  | 'evidenceTrace'
  | 'searchedSources'
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
    evidenceTrace: row.evidenceTrace
      .map(({ source, status, reference }) => ({ source, status, reference }))
      .sort((left, right) => left.source.localeCompare(right.source)),
    searchedSources: [...row.searchedSources].sort(),
  }

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

export function withVatTaxTreatmentRecommendationFingerprint<
  T extends VatTaxTreatmentFingerprintBaseInput & Pick<
    VatTaxTreatmentRecommendation,
    'aiRuntimeStatus' | 'finalDecision'
  >,
>(row: T) {
  const candidate = row as T & Partial<VatTaxTreatmentRecommendation> & {
    sourceType?: 'bank' | 'card' | 'receipt' | 'tax_invoice' | 'other' | null
    linkedEvidenceRowId?: string | null
    priorConfirmedReferences?: string[]
    evidenceRuleReference?: string | null
  }
  const evidenceSearch = candidate.evidenceTrace || candidate.searchedSources
    ? vatTaxTreatmentEvidenceSearchSchema.parse({
      evidenceTrace: candidate.evidenceTrace,
      searchedSources: candidate.searchedSources,
    })
    : buildVatTaxTreatmentEvidenceSearch({
      classificationRowId: row.classificationRowId,
      sourceType: candidate.sourceType,
      linkedEvidenceRowId: candidate.linkedEvidenceRowId,
      priorConfirmedReferences: candidate.priorConfirmedReferences,
      ruleReference: candidate.evidenceRuleReference ?? row.ruleReference,
    })
  const enriched = {
    ...row,
    ...deriveVatTaxTreatmentJudgmentContract({
      ...row,
      noEvidenceDefaulted: candidate.judgmentWorkflowStatus === 'no_evidence_defaulted',
    }),
    ...evidenceSearch,
  }
  return {
    ...enriched,
    recommendationFingerprint: buildVatTaxTreatmentRecommendationFingerprint(enriched),
  }
}
