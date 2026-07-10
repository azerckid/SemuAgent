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

function buildGate(overrides: Partial<Parameters<typeof buildVatPackageGate>[0]> = {}) {
  return buildVatPackageGate({
    periodKey: '2026-H1',
    hasSummary: true,
    sourceCompleteness: readySource,
    reconciliationGate: readyReconciliation,
    pendingDeductionCount: 0,
    provenanceVerified: false,
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
    expect(buildGate({ provenanceVerified: true })).toMatchObject({
      isReady: true,
      blockerCount: 0,
      reasons: [],
    })
  })

  it('reports a missing VAT summary independently from the other gates', () => {
    const gate = buildGate({ hasSummary: false, provenanceVerified: true })

    expect(gate).toMatchObject({
      isReady: false,
      blockerCount: 1,
      summaryReady: false,
      reasons: [{ code: 'vat_summary_missing', count: 1 }],
    })
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
