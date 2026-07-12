import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  applyVatTaxTreatmentEvidenceAttestations,
  applyVatTaxTreatmentAuditStates,
  buildVatTaxTreatmentDisplayRows,
  type VatTaxTreatmentAuditRow,
  type VatTaxTreatmentClassificationRow,
  type VatTaxTreatmentDeductionRow,
} from './tax-treatment-summary'

const period = { key: '2026-H1', startMonth: '2026-01', endMonth: '2026-06' } as const

function classification(
  overrides: Partial<VatTaxTreatmentClassificationRow> = {},
): VatTaxTreatmentClassificationRow {
  return {
    id: 'row-current',
    tenantId: 'tenant-1',
    classificationRunId: 'run-1',
    sourceType: 'tax_invoice',
    transactionDate: '2026-06-15',
    merchantName: '클라우드서비스',
    description: '업무용 SaaS 이용료',
    amountKrw: -110_000,
    finalAccount: 'fees',
    staffMemo: '업무용',
    status: 'confirmed',
    vatDirection: 'purchase',
    vatTaxType: 'taxable',
    vatSupplyAmountKrw: 100_000,
    vatTaxAmountKrw: 10_000,
    vatGrossAmountKrw: 110_000,
    vatFactSource: 'parser',
    vatFactSourceRef: 'source-1',
    vatFactStatus: 'derived',
    confirmedByStaffId: 'staff-1',
    confirmedAt: '2026-06-16T00:00:00.000Z',
    ...overrides,
  }
}

function review(overrides: Partial<VatTaxTreatmentDeductionRow> = {}): VatTaxTreatmentDeductionRow {
  return {
    id: 'review-1',
    periodKey: '2026-H1',
    classificationRowId: 'row-current',
    kind: 'deductible',
    decision: 'pending',
    reason: '',
    prorationRateBps: null,
    confirmedByStaffId: null,
    confirmedAt: null,
    updatedAt: '2026-06-16T00:00:00.000Z',
    ...overrides,
  }
}

function build(params: {
  classificationRows?: VatTaxTreatmentClassificationRow[]
  deductionReviews?: VatTaxTreatmentDeductionRow[]
} = {}) {
  return buildVatTaxTreatmentDisplayRows({
    tenantId: 'tenant-1',
    businessEntityId: 'client-1',
    period,
    classificationRows: params.classificationRows ?? [classification()],
    deductionReviews: params.deductionReviews ?? [],
  })
}

describe('VAT tax treatment read model', () => {
  it('maps an exact confirmed VAT fact to the validated display model', () => {
    expect(build()).toEqual([
      expect.objectContaining({
        classificationRowId: 'row-current',
        tenantId: 'tenant-1',
        businessEntityId: 'client-1',
        recommendation: 'likely_deductible',
        source: 'deterministic_rule',
        hometaxComparisonMode: 'expected_prefill',
        finalDecision: null,
        userActionStatus: 'pending',
      }),
    ])
  })

  it('excludes unconfirmed, bank, out-of-period, and arithmetically inconsistent rows (VAI-S04 boundary)', () => {
    expect(build({
      classificationRows: [
        classification({ id: 'suggested', status: 'suggested' }),
        classification({ id: 'bank', sourceType: 'bank' }),
        classification({ id: 'old', transactionDate: '2025-12-31' }),
        classification({ id: 'bad-total', vatGrossAmountKrw: 120_000 }),
      ],
    })).toEqual([])
  })

  it('uses a same-business prior confirmed decision only when deterministic facts remain unresolved', () => {
    const rows = build({
      classificationRows: [
        classification({ id: 'row-current', finalAccount: 'vehicle', merchantName: '렌터카 회사' }),
        classification({
          id: 'row-prior',
          transactionDate: '2025-12-15',
          finalAccount: 'vehicle',
          merchantName: '렌터카회사',
          vatFactStatus: 'confirmed',
        }),
      ],
      deductionReviews: [review({
        id: 'review-prior',
        periodKey: '2025-H2',
        classificationRowId: 'row-prior',
        decision: 'non_deductible',
        confirmedByStaffId: 'staff-1',
        confirmedAt: '2025-12-16T00:00:00.000Z',
      })],
    })

    expect(rows[0]).toMatchObject({
      recommendation: 'likely_non_deductible',
      source: 'prior_confirmed_pattern',
      confidence: 'medium',
    })
  })

  it('keeps recommendation and an existing user decision consistent (P1 regression)', () => {
    const rows = build({
      deductionReviews: [review({
        decision: 'non_deductible',
        confirmedByStaffId: 'staff-1',
        confirmedAt: '2026-06-17T00:00:00.000Z',
      })],
    })

    expect(rows[0]).toMatchObject({
      recommendation: 'likely_non_deductible',
      finalDecision: 'non_deductible',
      confirmedByStaffId: 'staff-1',
      userActionStatus: 'confirmed',
    })
  })

  it('keeps a canonical purchase reason when no matching audit snapshot exists', () => {
    const [row] = build({
      deductionReviews: [review({
        decision: 'non_deductible',
        reason: '업무무관 지출로 확인',
        confirmedByStaffId: 'staff-1',
        confirmedAt: '2026-07-11 00:00:00',
      })],
    })

    const [result] = applyVatTaxTreatmentAuditStates({ rows: [row!], auditRows: [] })

    expect(result).toMatchObject({
      userActionStatus: 'confirmed',
      finalDecision: 'non_deductible',
      userActionReason: '업무무관 지출로 확인',
    })
  })

  it('applies a matching hold or expert-review audit state after recommendation calculation', () => {
    const [row] = build()
    const audit: VatTaxTreatmentAuditRow = {
      classificationRowId: row.classificationRowId,
      recommendationFingerprint: row.recommendationFingerprint,
      status: 'held',
      finalDecision: null,
      finalReason: '거래처 확인서 대기',
      confirmedByStaffId: null,
      confirmedAt: null,
    }

    expect(applyVatTaxTreatmentAuditStates({ rows: [row], auditRows: [audit] })[0]).toMatchObject({
      userActionStatus: 'held',
      userActionReason: '거래처 확인서 대기',
      finalDecision: null,
    })
  })

  it('ignores a held audit when its recommendation fingerprint is stale', () => {
    const [row] = build()
    const audit: VatTaxTreatmentAuditRow = {
      classificationRowId: row.classificationRowId,
      recommendationFingerprint: 'f'.repeat(64),
      status: 'expert_review',
      finalDecision: null,
      finalReason: '과거 판단',
      confirmedByStaffId: null,
      confirmedAt: null,
    }

    expect(applyVatTaxTreatmentAuditStates({ rows: [row], auditRows: [audit] })[0]).toMatchObject({
      userActionStatus: 'pending',
      userActionReason: null,
    })
  })

  it('merges only active evidence attestations and recalculates the fingerprint', () => {
    const [base] = build({
      classificationRows: [classification({
        vatDirection: 'sale',
        vatTaxType: 'zero_rated',
        vatSupplyAmountKrw: 110_000,
        vatTaxAmountKrw: 0,
        vatGrossAmountKrw: 110_000,
        amountKrw: 110_000,
      })],
    })
    const [confirmed] = applyVatTaxTreatmentEvidenceAttestations({
      rows: [base!],
      attestations: [{
        classificationRowId: base!.classificationRowId,
        evidenceCode: 'export_or_zero_rate_documents',
        status: 'present',
        confirmedAt: '2026-07-11 15:00:00',
      }],
    })

    expect(confirmed!.requiredEvidence).toContainEqual(expect.objectContaining({
      code: 'export_or_zero_rate_documents',
      status: 'present',
      attestedAt: '2026-07-11 15:00:00',
    }))
    expect(confirmed!.recommendationFingerprint).not.toBe(base!.recommendationFingerprint)

    const [revoked] = applyVatTaxTreatmentEvidenceAttestations({
      rows: [base!],
      attestations: [{
        classificationRowId: base!.classificationRowId,
        evidenceCode: 'export_or_zero_rate_documents',
        status: 'revoked',
        confirmedAt: '2026-07-11 15:00:00',
      }],
    })
    expect(revoked!.requiredEvidence).toContainEqual(expect.objectContaining({
      code: 'export_or_zero_rate_documents',
      status: 'needs_review',
    }))
    expect(revoked!.requiredEvidence.find((item) => item.code === 'export_or_zero_rate_documents'))
      .not.toHaveProperty('attestedAt')
  })
})

describe('VAT tax treatment loader boundaries', () => {
  const source = readFileSync(new URL('./tax-treatment-summary.ts', import.meta.url), 'utf8')

  it('keeps every DB read tenant/business scoped and performs no writes', () => {
    expect(source).toContain('tenantId: params.tenantId')
    expect(source).toContain('clientId: params.businessEntityId')
    expect(source).toContain('eq(bookkeepingTransactionClassification.tenantId, params.tenantId)')
    expect(source).toContain('eq(vatDeductionReview.tenantId, params.tenantId)')
    expect(source).toContain('eq(vatDeductionReview.clientId, params.businessEntityId)')
    expect(source).toContain('eq(vatTaxTreatmentReview.tenantId, params.tenantId)')
    expect(source).toContain('eq(vatTaxTreatmentReview.clientId, params.businessEntityId)')
    expect(source).toContain('eq(vatTaxTreatmentEvidenceAttestation.tenantId, params.tenantId)')
    expect(source).toContain('eq(vatTaxTreatmentEvidenceAttestation.clientId, params.businessEntityId)')
    expect(source).not.toContain('.insert(')
    expect(source).not.toContain('.update(')
    expect(source).not.toContain('.delete(')
  })

  it('reuses stored AI results after evidence state and before user audit state', () => {
    expect(source).toContain('applyVatTaxTreatmentEvidenceAttestations')
    expect(source).toContain('applyStoredVatTaxTreatmentAiResults')
    expect(source).toContain('params.includeStoredAi === true')
    expect(source).toContain('applyVatTaxTreatmentAuditStates({ rows: recommendedRows, auditRows })')
  })

  it('keeps stored AI opt-in and excludes package gates from recommendation cache', () => {
    const gateSource = readFileSync(new URL('./tax-treatment-gate.ts', import.meta.url), 'utf8')
    const mutationSource = readFileSync(new URL('./tax-treatment-mutations.ts', import.meta.url), 'utf8')
    const evidenceSource = readFileSync(new URL('./tax-treatment-evidence.ts', import.meta.url), 'utf8')

    expect(gateSource).toContain('includeStoredAi: false')
    expect(mutationSource).toContain('includeStoredAi: true')
    expect(evidenceSource).toContain('includeStoredAi: true')
  })
})
