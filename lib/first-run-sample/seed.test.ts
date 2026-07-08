import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
import {
  buildFirstRunSampleSeedPlan,
  firstRunSampleId,
  resolveExistingFirstRunSampleDataset,
  summarizeSeedPlanForTests,
} from './seed'

function buildPlan() {
  return buildFirstRunSampleSeedPlan({
    tenantId: 'tenant-1',
    clientId: 'client-1',
    staffId: 'staff-1',
    userId: 'user-1',
    datasetId: 'dataset-1',
    timestamp: '2026-07-04T00:00:00.000+09:00',
    createdClient: true,
    businessEntityName: '테스트회사(주)',
  })
}

describe('first-run sample seed plan', () => {
  it('uses deterministic ids for idempotent retry boundaries', () => {
    expect(firstRunSampleId('tenant-1', 'dataset')).toBe(firstRunSampleId('tenant-1', 'dataset'))
    expect(firstRunSampleId('tenant-1', 'dataset')).not.toBe(firstRunSampleId('tenant-2', 'dataset'))
  })


  it('uses the onboarding company name for a sample-created first business entity', () => {
    const plan = buildPlan()

    expect(plan.clientRow?.name).toBe('테스트회사(주)')
    expect(plan.clientRow?.analysisNotes).toContain('첫 가입 샘플 사업장')
  })

  it('matches the approved preview headline counts (S-10~S-17)', () => {
    const summary = summarizeSeedPlanForTests(buildPlan())

    expect(summary.material).toEqual({ total: 24, missing: 1, uncertain: 3 })
    expect(summary.bookkeeping.total).toBeGreaterThanOrEqual(650)
    expect(summary.bookkeeping.bankSampleCount).toBe(245)
    expect(summary.bookkeeping.taxInvoiceSampleCount).toBeGreaterThanOrEqual(330)
    expect(summary.bookkeeping.pending).toBeGreaterThan(0)
    expect(summary.bookkeeping.lowConfidence).toBeGreaterThan(0)
    expect(summary.vat).toEqual({
      outputTaxKrw: 32_000_000,
      inputTaxDeductibleKrw: 18_000_000,
      payableTaxKrw: 14_000_000,
      pendingDeductionCount: 3,
    })
    expect(summary.payroll).toEqual({
      employeeCount: 12,
      grossPayKrw: 42_600_000,
      deductionTotalKrw: 5_840_000,
      netPayKrw: 36_760_000,
      issueCount: 1,
    })
    expect(summary.employees).toEqual({
      total: 14,
      active: 12,
      terminated: 2,
      payrollEligible: 11,
      insuranceNeedsReview: 1,
    })
    expect(summary.refs).toBeGreaterThan(400)
  })


  it('does not auto-regenerate visible or deleted sample datasets (S-03/S-04)', () => {
    expect(resolveExistingFirstRunSampleDataset([
      { id: 'dataset-active', clientId: 'client-1', status: 'active' },
    ], 'first_run_onboarding')).toEqual({
      datasetId: 'dataset-active',
      clientId: 'client-1',
      status: 'active',
      created: false,
    })

    expect(resolveExistingFirstRunSampleDataset([
      { id: 'dataset-deleted', clientId: 'client-1', status: 'deleted' },
    ], 'first_run_onboarding')).toEqual({
      datasetId: 'dataset-deleted',
      clientId: 'client-1',
      status: 'deleted',
      created: false,
    })
  })

  it('keeps failed onboarding samples visible until manual retry (S-05)', () => {
    expect(resolveExistingFirstRunSampleDataset([
      { id: 'dataset-failed', clientId: 'client-1', status: 'failed', errorMessage: 'boom' },
    ], 'first_run_onboarding')).toEqual({
      datasetId: 'dataset-failed',
      clientId: 'client-1',
      status: 'failed',
      created: false,
      errorMessage: 'boom',
    })

    expect(resolveExistingFirstRunSampleDataset([
      { id: 'dataset-failed', clientId: 'client-1', status: 'failed', errorMessage: 'boom' },
    ], 'manual_retry')).toBeNull()
  })

  it('does not create real Blob URLs or raw sensitive employee fields (S-50/S-51)', () => {
    const plan = buildPlan()
    const summary = summarizeSeedPlanForTests(plan)

    expect(summary.storageKeys.every((key) => key.startsWith('sample://'))).toBe(true)
    expect(plan.employeeRows.every((row) => !('phone' in row) && !('bankAccount' in row) && !('residentRegistrationNumber' in row))).toBe(true)
    expect(plan.clientRow?.phone).toBeNull()
  })
})
