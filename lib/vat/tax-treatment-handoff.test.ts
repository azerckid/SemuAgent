import { describe, expect, it } from 'vitest'
import {
  vatTaxTreatmentDisplayRowSchema,
  type VatTaxTreatmentDisplayRow,
} from '@/lib/validations/vat-tax-treatment'
import { withVatTaxTreatmentRecommendationFingerprint } from './tax-treatment-fingerprint'
import {
  applyVatTaxTreatmentAutomaticHandoffs,
  applyVatTaxTreatmentHumanHandoff,
  findUnresolvedVatTaxTreatmentHandoff,
  resolveVatTaxTreatmentAutomaticHandoff,
} from './tax-treatment-handoff'

function displayRow(overrides: Partial<VatTaxTreatmentDisplayRow> = {}) {
  return vatTaxTreatmentDisplayRowSchema.parse(withVatTaxTreatmentRecommendationFingerprint({
    rowId: 'row-1',
    classificationRowId: 'row-1',
    tenantId: 'tenant-1',
    businessEntityId: 'client-1',
    periodKey: '2026-H1',
    direction: 'purchase',
    currentVatFact: {
      taxType: 'taxable',
      supplyAmountKrw: 100_000,
      taxAmountKrw: 10_000,
      grossAmountKrw: 110_000,
      source: 'parser',
      status: 'derived',
    },
    recommendation: 'likely_deductible',
    source: 'deterministic_rule',
    confidence: 'low',
    basisLabel: '적격 증빙과 업무 목적을 확인했습니다.',
    ruleReference: 'P-01',
    ruleVersion: 'vat-kr-2026.07-v1',
    requiredEvidence: [
      { code: 'exact_vat_fact', label: '정확한 VAT fact', status: 'present' },
      { code: 'qualified_purchase_evidence', label: '적격 증빙', status: 'present' },
      { code: 'business_purpose', label: '업무 목적', status: 'present' },
    ],
    missingFacts: [],
    hometaxComparisonMode: 'expected_prefill',
    hometaxAction: 'expected_no_change',
    aiTrace: null,
    aiRuntimeStatus: 'not_requested',
    finalDecision: null,
    confirmedByStaffId: null,
    confirmedAt: null,
    transactionDate: '2026-06-15',
    counterparty: '테스트 거래처',
    description: '업무용 결제',
    sourceType: 'tax_invoice',
    accountLabel: '지급수수료',
    userActionStatus: 'pending',
    userActionReason: null,
    ...overrides,
  }))
}

describe('VAT human handoff gate', () => {
  it('does not hand off merely because confidence is low', () => {
    const row = displayRow({ confidence: 'low' })
    expect(resolveVatTaxTreatmentAutomaticHandoff(row)).toBeNull()
    expect(applyVatTaxTreatmentAutomaticHandoffs([row])[0]).toBe(row)
  })

  it('creates one exact question for a missing proration fact', () => {
    const row = displayRow({
      recommendation: 'proration_required',
      requiredEvidence: [
        { code: 'exact_vat_fact', label: '정확한 VAT fact', status: 'present' },
        { code: 'taxable_exempt_attribution', label: '실지귀속', status: 'needs_review' },
        { code: 'proration_basis', label: '안분 기준', status: 'needs_review' },
      ],
      missingFacts: ['실지귀속 또는 안분 기준·비율 확인'],
      hometaxAction: 'review_proration',
    })
    const [result] = applyVatTaxTreatmentAutomaticHandoffs([row])

    expect(result).toMatchObject({
      recommendation: 'proration_required',
      judgmentWorkflowStatus: 'human_resolution_required',
      humanHandoff: {
        reason: 'essential_fact_missing',
        provisionalJudgment: 'proration_required',
        question: '이 매입은 과세사업과 면세사업에 각각 어떤 비율과 기준으로 사용됐습니까?',
      },
    })
  })

  it('uses rule-gap handoff only when the completed evidence search found no official rule', () => {
    const base = displayRow()
    const row = displayRow({
      ruleReference: null,
      evidenceTrace: base.evidenceTrace.map((item) => (
        item.source === 'official_rule'
          ? { ...item, status: 'not_found' as const, reference: null, summary: '적용 규칙 없음' }
          : item
      )),
      searchedSources: base.searchedSources,
    })
    const [result] = applyVatTaxTreatmentAutomaticHandoffs([row])

    expect(result).toMatchObject({
      judgmentWorkflowStatus: 'human_resolution_required',
      humanHandoff: { reason: 'rule_gap' },
    })
  })

  it('deduplicates actual reviewed references and fingerprints the handoff payload', () => {
    const row = displayRow()
    const result = applyVatTaxTreatmentHumanHandoff(row, {
      reason: 'evidence_conflict',
      reviewedEvidenceReferences: ['classification:prior-1', 'classification:prior-1'],
      evidenceIssue: '과거 확정이 충돌합니다.',
      missingEssentialFact: '이번 거래의 실제 업무 목적',
      question: '이번 거래는 어떤 업무 목적으로 사용했습니까?',
      decisionImpact: '업무 목적이 입증되면 공제, 아니면 불공제입니다.',
    })

    expect(result.humanHandoff!.reviewedEvidenceReferences).toEqual(expect.arrayContaining([
      'classification:row-1',
      'classification:prior-1',
    ]))
    expect(new Set(result.humanHandoff!.reviewedEvidenceReferences).size)
      .toBe(result.humanHandoff!.reviewedEvidenceReferences.length)
    expect(result.recommendationFingerprint).not.toBe(row.recommendationFingerprint)
  })

  it('never replaces a canonical final decision with a handoff', () => {
    const row = displayRow({
      finalDecision: 'deductible',
      confirmedByStaffId: 'staff-1',
      confirmedAt: '2026-07-13T00:00:00.000Z',
      userActionStatus: 'confirmed',
    })
    expect(applyVatTaxTreatmentHumanHandoff(row, {
      reason: 'essential_fact_missing',
      evidenceIssue: '부족 사실',
      missingEssentialFact: '업무 목적',
      question: '업무 목적입니까?',
      decisionImpact: '답변에 따라 재검토합니다.',
    })).toBe(row)
  })

  it('finds an unresolved handoff only for the linked classification row', () => {
    const handoffRow = applyVatTaxTreatmentHumanHandoff(displayRow(), {
      reason: 'evidence_conflict',
      evidenceIssue: '과거 확정이 충돌합니다.',
      missingEssentialFact: '이번 거래의 실제 업무 목적',
      question: '이번 거래는 어떤 업무 목적으로 사용했습니까?',
      decisionImpact: '업무 목적이 입증되면 공제, 아니면 불공제입니다.',
    })

    expect(findUnresolvedVatTaxTreatmentHandoff([handoffRow], 'row-1'))
      .toEqual(handoffRow.humanHandoff)
    expect(findUnresolvedVatTaxTreatmentHandoff([handoffRow], 'another-row')).toBeNull()
    expect(findUnresolvedVatTaxTreatmentHandoff([handoffRow], null)).toBeNull()
  })
})
