import { describe, expect, it } from 'vitest'
import { applyVatPackageGateToPreview, buildVatPackageGate } from './package-gate'

const readySource = {
  requiredCount: 4,
  missingCount: 0,
  normalizationPendingCount: 0,
}

const readyReconciliation = {
  isReady: true,
  blockerCount: 0,
  targetRoute: '/dashboard/bookkeeping/reconciliation-ledger' as const,
}

const blockedProvenance = {
  status: 'blocked' as const,
  isReady: false,
  canRebuild: false,
  issueCount: 1,
  message: '확정 VAT fact를 확인해야 합니다.',
}

const verifiedProvenance = {
  status: 'verified' as const,
  isReady: true,
  canRebuild: false,
  issueCount: 0,
  message: '현재 fingerprint가 일치합니다.',
}

const readyTaxTreatment = {
  isReady: true,
  blockerCount: 0,
  unconfirmedCount: 0,
  heldCount: 0,
  expertReviewCount: 0,
  evidenceIncompleteCount: 0,
  prorationIncompleteCount: 0,
  targetRoute: '/dashboard/vat' as const,
}

function buildGate(overrides: Partial<Parameters<typeof buildVatPackageGate>[0]> = {}) {
  return buildVatPackageGate({
    periodKey: '2026-H1',
    hasSummary: true,
    sourceCompleteness: readySource,
    reconciliationGate: readyReconciliation,
    pendingDeductionCount: 0,
    taxTreatmentGate: readyTaxTreatment,
    provenanceState: blockedProvenance,
    ...overrides,
  })
}

describe('VAT package composite gate', () => {
  it('keeps generation locked until confirmed-ledger provenance is verified', () => {
    expect(buildGate()).toMatchObject({
      isReady: false,
      blockerCount: 1,
      reasons: [{ code: 'confirmed_ledger_provenance_unverified', count: 1 }],
    })
  })

  it('reports source, reconciliation, deduction, and provenance blockers together', () => {
    const gate = buildGate({
      sourceCompleteness: {
        requiredCount: 4,
        missingCount: 2,
        normalizationPendingCount: 1,
      },
      reconciliationGate: {
        isReady: false,
        blockerCount: 5,
        targetRoute: '/dashboard/bookkeeping/reconciliation-ledger',
      },
      pendingDeductionCount: 3,
    })

    expect(gate.blockerCount).toBe(12)
    expect(gate.reasons.map((reason) => reason.code)).toEqual([
      'source_collection_missing',
      'source_collection_normalization_pending',
      'reconciliation_incomplete',
      'vat_deduction_incomplete',
      'confirmed_ledger_provenance_unverified',
    ])
    expect(gate.reasons[0]?.targetRoute).toBe('/dashboard/direct-upload?period=2026-H1')
    expect(gate.reasons[2]?.targetRoute).toBe('/dashboard/bookkeeping/reconciliation-ledger?period=2026-H1')
  })

  it('treats zero required sources as not applicable when nothing is pending', () => {
    expect(buildGate({
      sourceCompleteness: {
        requiredCount: 0,
        missingCount: 0,
        normalizationPendingCount: 0,
      },
    }).sourceCollection).toMatchObject({
      status: 'not_applicable',
      isReady: true,
    })
  })

  it('allows generation only when every gate including provenance is ready', () => {
    expect(buildGate({ provenanceState: verifiedProvenance })).toMatchObject({
      isReady: true,
      blockerCount: 0,
      reasons: [],
    })
  })

  it('blocks rebuild and package generation while VAT user decisions are unresolved', () => {
    const gate = buildGate({
      provenanceState: verifiedProvenance,
      taxTreatmentGate: {
        ...readyTaxTreatment,
        isReady: false,
        blockerCount: 2,
        unconfirmedCount: 2,
      },
    })

    expect(gate).toMatchObject({
      isReady: false,
      blockerCount: 2,
      taxTreatment: {
        isReady: false,
        blockerCount: 2,
      },
      reasons: [{
        code: 'vat_tax_treatment_incomplete',
        count: 2,
        targetRoute: '/dashboard/vat?period=2026-H1',
      }],
    })
  })

  it('reports a missing VAT summary independently from the other gates', () => {
    const gate = buildGate({ hasSummary: false, provenanceState: verifiedProvenance })

    expect(gate).toMatchObject({
      isReady: false,
      blockerCount: 1,
      summaryReady: false,
      reasons: [{ code: 'vat_summary_missing', count: 1 }],
    })
  })

  it('exposes an explicit rebuild action only when every non-provenance gate is ready', () => {
    const rebuildState = {
      status: 'rebuild_required' as const,
      isReady: false,
      canRebuild: true,
      issueCount: 1,
      message: '확정 원장 값으로 다시 계산해야 합니다.',
    }
    expect(buildGate({ provenanceState: rebuildState })).toMatchObject({
      isReady: false,
      provenance: { status: 'rebuild_required', canRebuild: true },
      reasons: [{ code: 'confirmed_ledger_provenance_rebuild_required' }],
    })
    expect(buildGate({
      provenanceState: rebuildState,
      reconciliationGate: { ...readyReconciliation, isReady: false, blockerCount: 2 },
    }).provenance.canRebuild).toBe(false)
    expect(buildGate({
      provenanceState: rebuildState,
      taxTreatmentGate: {
        ...readyTaxTreatment,
        isReady: false,
        blockerCount: 1,
        unconfirmedCount: 1,
      },
    }).provenance.canRebuild).toBe(false)
  })

  it('keeps the package action disabled when the composite gate is blocked', () => {
    expect(applyVatPackageGateToPreview({
      fileName: '부가세_2026-H1_신고패키지.pdf',
      description: '생성 가능',
      locked: false,
      lockReason: null,
      canGenerate: true,
    }, buildGate())).toMatchObject({
      locked: true,
      lockReason: '1개 생성 조건을 먼저 완료해 주세요.',
      canGenerate: false,
    })
  })
})
