import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReconciliationLedgerDisplayModel } from './reconciliation-display-model'
import { buildLiveReconciliationLedgerDisplayModel } from './reconciliation-live-display-model'
import {
  buildReconciliationPath1Gate,
  loadReconciliationPath1Gate,
  RECONCILIATION_PATH1_GATE_ROUTE,
} from './reconciliation-path1-gate'
import { loadBookkeepingReviewSummary, type BookkeepingReviewSummary } from './summary'

vi.mock('./reconciliation-live-display-model', () => ({
  buildLiveReconciliationLedgerDisplayModel: vi.fn(),
}))

vi.mock('./summary', () => ({
  loadBookkeepingReviewSummary: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildReconciliationPath1Gate', () => {
  it('copies closing-checklist categories and defines blockerCount as their sum', () => {
    const gate = buildReconciliationPath1Gate('2026-H1', {
      evidenceRequiredCount: 7,
      explanationRequiredCount: 5,
      accountUnconfirmedCount: 11,
      exclusionReasonRequiredCount: 2,
      taxBlockerCount: 99,
      isReadyForPath1: false,
    })

    expect(gate).toEqual({
      periodKey: '2026-H1',
      isReady: false,
      blockerCount: 25,
      evidenceRequiredCount: 7,
      explanationRequiredCount: 5,
      accountUnconfirmedCount: 11,
      exclusionReasonRequiredCount: 2,
      taxBlockerCount: 99,
      targetRoute: RECONCILIATION_PATH1_GATE_ROUTE,
    })
  })

  it('is ready only when both the shared checklist and all category counts are ready', () => {
    const ready = buildReconciliationPath1Gate('2026-07', {
      evidenceRequiredCount: 0,
      explanationRequiredCount: 0,
      accountUnconfirmedCount: 0,
      exclusionReasonRequiredCount: 0,
      taxBlockerCount: 0,
      isReadyForPath1: true,
    })
    const inconsistent = buildReconciliationPath1Gate('2026-07', {
      evidenceRequiredCount: 0,
      explanationRequiredCount: 0,
      accountUnconfirmedCount: 0,
      exclusionReasonRequiredCount: 0,
      taxBlockerCount: 0,
      isReadyForPath1: false,
    })

    expect(ready.isReady).toBe(true)
    expect(inconsistent.isReady).toBe(false)
  })

  it('loads the same all-row tenant/period summary used by the live reconciliation ledger', async () => {
    const summary: BookkeepingReviewSummary = {
      tenant: { id: 'tenant-1', name: '테스트 회사', timezone: 'Asia/Seoul' },
      businessEntity: { id: 'business-1', name: '테스트 사업장' },
      period: {
        key: '2026-H1',
        label: '2026년 부가세 1기',
        startMonth: '2026-01',
        endMonth: '2026-06',
        filingDeadline: '2026-07-25',
        dDay: 0,
        progressPercent: 100,
      },
      tab: 'all',
      counts: { pending: 0, lowConfidence: 0, confirmed: 0, total: 0 },
      rows: [],
      selected: null,
    }
    const closingChecklist = {
      evidenceRequiredCount: 1,
      explanationRequiredCount: 2,
      accountUnconfirmedCount: 3,
      exclusionReasonRequiredCount: 4,
      taxBlockerCount: 10,
      isReadyForPath1: false,
    }
    vi.mocked(loadBookkeepingReviewSummary).mockResolvedValue(summary)
    vi.mocked(buildLiveReconciliationLedgerDisplayModel).mockReturnValue({
      closingChecklist,
    } as ReconciliationLedgerDisplayModel)

    const gate = await loadReconciliationPath1Gate({ tenantId: 'tenant-1', periodKey: '2026-H1' })

    expect(loadBookkeepingReviewSummary).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      periodKey: '2026-H1',
      today: undefined,
      tab: 'all',
      includeExcluded: true,
    })
    expect(buildLiveReconciliationLedgerDisplayModel).toHaveBeenCalledWith(summary)
    expect(gate.blockerCount).toBe(10)
  })
})
