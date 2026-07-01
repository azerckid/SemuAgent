import { executeBookkeepingClassification } from './classification-service'
import { mergeIncludedAttributionIntoLedger } from './fiscal-year-ledger'
import { startBookkeepingJournalEntry } from './journal-entry-service'

type StaffRecord = {
  id: string
  role: 'TENANT_ADMIN' | 'STAFF'
}

type PipelineStepKey = 'ledger_merge' | 'classification_draft' | 'journal_draft'
type PipelineStepStatus = 'completed' | 'stopped' | 'skipped'

export type BookkeepingLedgerDraftPipelineStep = {
  key: PipelineStepKey
  status: PipelineStepStatus
  message: string
  detail?: Record<string, unknown>
}

export type BookkeepingLedgerDraftPipelineResult =
  | {
    ok: true
    status: 'completed'
    steps: BookkeepingLedgerDraftPipelineStep[]
    classificationRunId: string
    journalEntryRunId: string
  }
  | {
    ok: true
    status: 'stopped'
    steps: BookkeepingLedgerDraftPipelineStep[]
    stopReason: string
  }
  | {
    ok: false
    status: number
    error: string
    steps: BookkeepingLedgerDraftPipelineStep[]
  }

type PipelineParams = {
  tenantId: string
  sessionId: string
  staffRecord: StaffRecord
}

export type BookkeepingLedgerDraftPipelineDeps = {
  mergeIncludedAttributionIntoLedger: typeof mergeIncludedAttributionIntoLedger
  executeBookkeepingClassification: typeof executeBookkeepingClassification
  startBookkeepingJournalEntry: typeof startBookkeepingJournalEntry
}

const defaultDeps: BookkeepingLedgerDraftPipelineDeps = {
  mergeIncludedAttributionIntoLedger,
  executeBookkeepingClassification,
  startBookkeepingJournalEntry,
}

function mergeDetail(result: Awaited<ReturnType<typeof mergeIncludedAttributionIntoLedger>>) {
  if (!result.ok) return undefined
  return {
    linkedCount: result.linkedCount,
    supersededCount: result.supersededCount,
    staleCount: result.staleCount,
    skippedUnknownPeriodCount: result.skippedUnknownPeriodCount,
  }
}

export async function runBookkeepingLedgerDraftPipeline(
  params: PipelineParams,
  deps: BookkeepingLedgerDraftPipelineDeps = defaultDeps,
): Promise<BookkeepingLedgerDraftPipelineResult> {
  const steps: BookkeepingLedgerDraftPipelineStep[] = []

  const mergeResult = await deps.mergeIncludedAttributionIntoLedger(params)
  if (!mergeResult.ok) {
    steps.push({
      key: 'ledger_merge',
      status: 'stopped',
      message: mergeResult.error,
    })
    return { ok: false, status: mergeResult.status, error: mergeResult.error, steps }
  }

  steps.push({
    key: 'ledger_merge',
    status: 'completed',
    message: '귀속기간 검토에서 포함된 자료를 회계연도 장부에 반영했습니다.',
    detail: mergeDetail(mergeResult),
  })

  if (mergeResult.skippedUnknownPeriodCount > 0) {
    const stopReason = '귀속기간을 확정할 수 없는 자료가 있어 계정항목 초안 생성을 중단했습니다.'
    steps.push({
      key: 'classification_draft',
      status: 'stopped',
      message: stopReason,
      detail: mergeDetail(mergeResult),
    })
    steps.push({
      key: 'journal_draft',
      status: 'skipped',
      message: '계정항목 초안 생성이 중단되어 전표 초안 생성을 건너뛰었습니다.',
    })
    return { ok: true, status: 'stopped', steps, stopReason }
  }

  const classificationResult = await deps.executeBookkeepingClassification(params)
  if (!classificationResult.ok) {
    steps.push({
      key: 'classification_draft',
      status: 'stopped',
      message: classificationResult.error,
    })
    steps.push({
      key: 'journal_draft',
      status: 'skipped',
      message: '계정항목 초안 생성이 중단되어 전표 초안 생성을 건너뛰었습니다.',
    })
    return {
      ok: true,
      status: 'stopped',
      steps,
      stopReason: classificationResult.error,
    }
  }

  if (classificationResult.rowCount === 0) {
    const stopReason = '계정항목 초안에 반영할 거래 행이 없어 전표 초안 생성을 중단했습니다.'
    steps.push({
      key: 'classification_draft',
      status: 'stopped',
      message: stopReason,
      detail: {
        runId: classificationResult.runId,
        rowCount: classificationResult.rowCount,
      },
    })
    steps.push({
      key: 'journal_draft',
      status: 'skipped',
      message: '계정항목 초안 생성이 중단되어 전표 초안 생성을 건너뛰었습니다.',
    })
    return { ok: true, status: 'stopped', steps, stopReason }
  }

  if (classificationResult.unclassifiedRowCount === classificationResult.rowCount) {
    const stopReason = '계정항목 초안의 모든 거래 행이 미분류 상태라 전표 초안 생성을 중단했습니다.'
    steps.push({
      key: 'classification_draft',
      status: 'stopped',
      message: stopReason,
      detail: {
        runId: classificationResult.runId,
        rowCount: classificationResult.rowCount,
        unclassifiedRowCount: classificationResult.unclassifiedRowCount,
      },
    })
    steps.push({
      key: 'journal_draft',
      status: 'skipped',
      message: '계정항목 초안 생성이 중단되어 전표 초안 생성을 건너뛰었습니다.',
    })
    return { ok: true, status: 'stopped', steps, stopReason }
  }

  steps.push({
    key: 'classification_draft',
    status: 'completed',
    message: '계정항목 초안을 생성했습니다.',
    detail: {
      runId: classificationResult.runId,
      rowCount: classificationResult.rowCount,
      unclassifiedRowCount: classificationResult.unclassifiedRowCount,
    },
  })

  const journalResult = await deps.startBookkeepingJournalEntry(params)
  if (!journalResult.ok) {
    steps.push({
      key: 'journal_draft',
      status: 'stopped',
      message: journalResult.error,
    })
    return {
      ok: true,
      status: 'stopped',
      steps,
      stopReason: journalResult.error,
    }
  }

  steps.push({
    key: 'journal_draft',
    status: 'completed',
    message: '전표 분개표 초안을 생성했습니다.',
    detail: {
      runId: journalResult.runId,
      rowCount: journalResult.rowCount,
      unresolvedRowCount: journalResult.unresolvedRowCount,
    },
  })

  return {
    ok: true,
    status: 'completed',
    steps,
    classificationRunId: classificationResult.runId,
    journalEntryRunId: journalResult.runId,
  }
}
