import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./classification-service', () => ({
  executeBookkeepingClassification: vi.fn(),
}))

vi.mock('./fiscal-year-ledger', () => ({
  mergeIncludedAttributionIntoLedger: vi.fn(),
}))

vi.mock('./journal-entry-service', () => ({
  startBookkeepingJournalEntry: vi.fn(),
}))

import {
  runBookkeepingLedgerDraftPipeline,
  type BookkeepingLedgerDraftPipelineDeps,
} from './fiscal-year-ledger-pipeline'

const STAFF = { id: 'staff-1', role: 'TENANT_ADMIN' as const }
const PARAMS = { tenantId: 'tenant-1', sessionId: 'session-1', staffRecord: STAFF }

function createDeps(overrides: Partial<BookkeepingLedgerDraftPipelineDeps> = {}): BookkeepingLedgerDraftPipelineDeps {
  return {
    mergeIncludedAttributionIntoLedger: vi.fn<BookkeepingLedgerDraftPipelineDeps['mergeIncludedAttributionIntoLedger']>(async () => ({
      ok: true as const,
      linkedCount: 1,
      supersededCount: 0,
      staleCount: 0,
      skippedUnknownPeriodCount: 0,
    })),
    executeBookkeepingClassification: vi.fn<BookkeepingLedgerDraftPipelineDeps['executeBookkeepingClassification']>(async () => ({
      ok: true as const,
      runId: '11111111-1111-4111-8111-111111111111',
      rowCount: 3,
      unclassifiedRowCount: 0,
    })),
    startBookkeepingJournalEntry: vi.fn<BookkeepingLedgerDraftPipelineDeps['startBookkeepingJournalEntry']>(async () => ({
      ok: true as const,
      runId: '22222222-2222-4222-8222-222222222222',
      rowCount: 3,
      unresolvedRowCount: 0,
    })),
    ...overrides,
  }
}

describe('runBookkeepingLedgerDraftPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs ledger merge, classification draft, and journal draft in order', async () => {
    const deps = createDeps()

    const result = await runBookkeepingLedgerDraftPipeline(PARAMS, deps)

    expect(result).toMatchObject({
      ok: true,
      status: 'completed',
      classificationRunId: '11111111-1111-4111-8111-111111111111',
      journalEntryRunId: '22222222-2222-4222-8222-222222222222',
    })
    expect(result.steps.map((step) => [step.key, step.status])).toEqual([
      ['ledger_merge', 'completed'],
      ['classification_draft', 'completed'],
      ['journal_draft', 'completed'],
    ])
    expect(deps.mergeIncludedAttributionIntoLedger).toHaveBeenCalledTimes(1)
    expect(deps.executeBookkeepingClassification).toHaveBeenCalledTimes(1)
    expect(deps.startBookkeepingJournalEntry).toHaveBeenCalledTimes(1)
  })

  it('stops when ledger merge cannot find the session', async () => {
    const deps = createDeps({
      mergeIncludedAttributionIntoLedger: vi.fn<BookkeepingLedgerDraftPipelineDeps['mergeIncludedAttributionIntoLedger']>(async () => ({
        ok: false as const,
        status: 404,
        error: '세션을 찾을 수 없습니다.',
      })),
    })

    const result = await runBookkeepingLedgerDraftPipeline(PARAMS, deps)

    expect(result).toMatchObject({
      ok: false,
      status: 404,
      error: '세션을 찾을 수 없습니다.',
    })
    expect(result.steps).toHaveLength(1)
    expect(deps.executeBookkeepingClassification).not.toHaveBeenCalled()
    expect(deps.startBookkeepingJournalEntry).not.toHaveBeenCalled()
  })

  it('stops before classification when included material has unknown period', async () => {
    const deps = createDeps({
      mergeIncludedAttributionIntoLedger: vi.fn<BookkeepingLedgerDraftPipelineDeps['mergeIncludedAttributionIntoLedger']>(async () => ({
        ok: true as const,
        linkedCount: 1,
        supersededCount: 0,
        staleCount: 0,
        skippedUnknownPeriodCount: 1,
      })),
    })

    const result = await runBookkeepingLedgerDraftPipeline(PARAMS, deps)

    expect(result).toMatchObject({
      ok: true,
      status: 'stopped',
      stopReason: '귀속기간을 확정할 수 없는 자료가 있어 계정항목 초안 생성을 중단했습니다.',
    })
    expect(result.steps.map((step) => [step.key, step.status])).toEqual([
      ['ledger_merge', 'completed'],
      ['classification_draft', 'stopped'],
      ['journal_draft', 'skipped'],
    ])
    expect(deps.executeBookkeepingClassification).not.toHaveBeenCalled()
    expect(deps.startBookkeepingJournalEntry).not.toHaveBeenCalled()
  })

  it('still refreshes drafts when merge is already idempotently up to date', async () => {
    const deps = createDeps({
      mergeIncludedAttributionIntoLedger: vi.fn<BookkeepingLedgerDraftPipelineDeps['mergeIncludedAttributionIntoLedger']>(async () => ({
        ok: true as const,
        linkedCount: 0,
        supersededCount: 0,
        staleCount: 0,
        skippedUnknownPeriodCount: 0,
      })),
    })

    const result = await runBookkeepingLedgerDraftPipeline(PARAMS, deps)

    expect(result).toMatchObject({
      ok: true,
      status: 'completed',
    })
    expect(deps.executeBookkeepingClassification).toHaveBeenCalledTimes(1)
    expect(deps.startBookkeepingJournalEntry).toHaveBeenCalledTimes(1)
  })

  it('stops before journal draft when classification fails', async () => {
    const deps = createDeps({
      executeBookkeepingClassification: vi.fn<BookkeepingLedgerDraftPipelineDeps['executeBookkeepingClassification']>(async () => ({
        ok: false as const,
        status: 409,
        error: '귀속기간 검토에서 포함된 업로드 파일이 없습니다.',
      })),
    })

    const result = await runBookkeepingLedgerDraftPipeline(PARAMS, deps)

    expect(result).toMatchObject({
      ok: true,
      status: 'stopped',
      stopReason: '귀속기간 검토에서 포함된 업로드 파일이 없습니다.',
    })
    expect(result.steps.map((step) => [step.key, step.status])).toEqual([
      ['ledger_merge', 'completed'],
      ['classification_draft', 'stopped'],
      ['journal_draft', 'skipped'],
    ])
    expect(deps.startBookkeepingJournalEntry).not.toHaveBeenCalled()
  })

  it('stops before journal draft when every classification row is unclassified', async () => {
    const deps = createDeps({
      executeBookkeepingClassification: vi.fn<BookkeepingLedgerDraftPipelineDeps['executeBookkeepingClassification']>(async () => ({
        ok: true as const,
        runId: '33333333-3333-4333-8333-333333333333',
        rowCount: 2,
        unclassifiedRowCount: 2,
      })),
    })

    const result = await runBookkeepingLedgerDraftPipeline(PARAMS, deps)

    expect(result).toMatchObject({
      ok: true,
      status: 'stopped',
      stopReason: '계정항목 초안의 모든 거래 행이 미분류 상태라 전표 초안 생성을 중단했습니다.',
    })
    expect(result.steps.map((step) => [step.key, step.status])).toEqual([
      ['ledger_merge', 'completed'],
      ['classification_draft', 'stopped'],
      ['journal_draft', 'skipped'],
    ])
    expect(deps.startBookkeepingJournalEntry).not.toHaveBeenCalled()
  })

  it('stops when journal draft cannot be generated', async () => {
    const deps = createDeps({
      startBookkeepingJournalEntry: vi.fn<BookkeepingLedgerDraftPipelineDeps['startBookkeepingJournalEntry']>(async () => ({
        ok: false as const,
        status: 409,
        error: '전표 분개표에 반영할 계정항목 행이 없습니다.',
      })),
    })

    const result = await runBookkeepingLedgerDraftPipeline(PARAMS, deps)

    expect(result).toMatchObject({
      ok: true,
      status: 'stopped',
      stopReason: '전표 분개표에 반영할 계정항목 행이 없습니다.',
    })
    expect(result.steps.map((step) => [step.key, step.status])).toEqual([
      ['ledger_merge', 'completed'],
      ['classification_draft', 'completed'],
      ['journal_draft', 'stopped'],
    ])
  })
})
