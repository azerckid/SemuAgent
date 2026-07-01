import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { client, outboundEmail, uploadSession } from '@/lib/db/schema'
import { getOrCreateFiscalYearLedgerSummary } from '@/lib/bookkeeping/fiscal-year-ledger'
import { listAccumulatedJournalVouchers, toJournalEntryExportLines } from '@/lib/bookkeeping/fiscal-year-ledger-journal-view'
import { resolveBookkeepingPeriodRangeSnapshot } from '@/lib/bookkeeping/period-range'
import { dedupeApprovalEmailRowsBySession } from '@/lib/email/approval-email-dedupe'
import type { ApprovalEmailRow } from '../../_components/approval-queue-section'
import { ApprovalQueueSection } from '../../_components/approval-queue-section'
import { ReviewJournalEntryPreview } from './review-journal-entry-preview'
import { ReviewWorkspaceDeactivatedLedgerPanel } from './review-workspace-deactivated-ledger-panels'
import { ReviewWorkspaceCollapsibleSection } from './review-workspace-collapsible-section'
import { ReviewWorkspaceDeferredError } from './review-workspace-deferred-error'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

const approvalEmailStatusOrder = sql`case ${outboundEmail.status}
  when 'draft' then 0
  when 'failed' then 1
  when 'sent' then 2
  when 'rejected' then 3
  else 4
end`

type ApprovalEmailQueryRow = {
  id: string
  type: string
  subject: string
  body: string
  toEmail: string
  status: ApprovalEmailRow['status']
  appliedAnalysisNotes: string | null
  criteriaSummary: string | null
  sentAt: string | null
  createdAt: string
  sessionId: string
  accountingPeriod: string
  clientName: string
  clientEmail: string
}

async function queryApprovalEmailRows(
  tenantId: string,
  options?: { sessionId?: string; limit?: number },
): Promise<ApprovalEmailQueryRow[]> {
  const filters = [
    eq(outboundEmail.tenantId, tenantId),
    eq(uploadSession.requestKind, 'general'),
    eq(uploadSession.status, 'needs_resubmission'),
    eq(outboundEmail.type, 'missing_request'),
    inArray(outboundEmail.status, ['draft', 'sent', 'failed', 'rejected']),
    isNull(uploadSession.deletedAt),
  ]
  if (options?.sessionId) {
    filters.push(eq(uploadSession.id, options.sessionId))
  }

  let query = db
    .select({
      id: outboundEmail.id,
      type: outboundEmail.type,
      subject: outboundEmail.subject,
      body: outboundEmail.body,
      toEmail: outboundEmail.toEmail,
      status: outboundEmail.status,
      appliedAnalysisNotes: outboundEmail.appliedAnalysisNotes,
      criteriaSummary: outboundEmail.criteriaSummary,
      sentAt: outboundEmail.sentAt,
      createdAt: outboundEmail.createdAt,
      sessionId: uploadSession.id,
      accountingPeriod: uploadSession.accountingPeriod,
      clientName: client.name,
      clientEmail: client.email,
    })
    .from(outboundEmail)
    .innerJoin(uploadSession, and(eq(outboundEmail.uploadSessionId, uploadSession.id), eq(uploadSession.tenantId, tenantId)))
    .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
    .where(and(...filters))
    .orderBy(approvalEmailStatusOrder, desc(outboundEmail.createdAt))

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query
  }

  return query as Promise<ApprovalEmailQueryRow[]>
}

function sortApprovalEmailRows(rows: ApprovalEmailQueryRow[]) {
  const statusRank: Record<ApprovalEmailRow['status'], number> = {
    draft: 0,
    failed: 1,
    sent: 2,
    rejected: 3,
  }

  return [...rows].sort((a, b) => {
    const statusDelta = statusRank[a.status] - statusRank[b.status]
    if (statusDelta !== 0) return statusDelta
    return b.createdAt.localeCompare(a.createdAt)
  })
}

function mapApprovalEmailRows(
  rows: ApprovalEmailQueryRow[],
  clientDisplayNameBySessionId: Record<string, string>,
): ApprovalEmailRow[] {
  return rows.map((row) => ({
    ...row,
    clientDisplayName: clientDisplayNameBySessionId[row.sessionId] ?? row.clientName,
  }))
}

async function loadApprovalEmailRows(
  tenantId: string,
  clientDisplayNameBySessionId: Record<string, string>,
  selectedSessionId?: string | null,
): Promise<ApprovalEmailRow[]> {
  const recentRows = await queryApprovalEmailRows(tenantId, { limit: 100 })
  const selectedRows = selectedSessionId
    ? await queryApprovalEmailRows(tenantId, { sessionId: selectedSessionId })
    : []

  const mergedById = new Map<string, ApprovalEmailQueryRow>()
  for (const row of selectedRows) mergedById.set(row.id, row)
  for (const row of recentRows) mergedById.set(row.id, row)

  // 최근 목록은 전체 보충요청 큐로 유지하되, 선택 세션 초안은 오래된 경우에도 포함한다.
  return mapApprovalEmailRows(
    dedupeApprovalEmailRowsBySession([...mergedById.values()], sortApprovalEmailRows),
    clientDisplayNameBySessionId,
  )
}

async function loadPreviewData(
  tenantId: string,
  selectedSession: ReviewSession | null,
  options: { showJournalEntry: boolean },
) {
  if (!options.showJournalEntry || !selectedSession || selectedSession.workType !== 'bookkeeping') {
    return {
      journalEntryPreviewLines: [] as ReturnType<typeof toJournalEntryExportLines>,
    }
  }

  const range = resolveBookkeepingPeriodRangeSnapshot(selectedSession)
  if (!range) {
    return {
      journalEntryPreviewLines: [] as ReturnType<typeof toJournalEntryExportLines>,
    }
  }

  const fiscalYear = Number(range.start.slice(0, 4))
  const ledgerSummary = await getOrCreateFiscalYearLedgerSummary({
    tenantId,
    clientId: selectedSession.clientId,
    fiscalYear,
  })

  if (!ledgerSummary) {
    return {
      journalEntryPreviewLines: [] as ReturnType<typeof toJournalEntryExportLines>,
    }
  }

  const journalResult = options.showJournalEntry
    ? await listAccumulatedJournalVouchers({ tenantId, ledgerId: ledgerSummary.ledger.id, period: range.label })
    : null

  return {
    journalEntryPreviewLines: journalResult?.ok
      ? toJournalEntryExportLines(journalResult.vouchers.filter((item) => !item.stale))
      : ([] as ReturnType<typeof toJournalEntryExportLines>),
  }
}

function buildMailStatusSummary(drafts: ApprovalEmailRow[]) {
  const draftCount = drafts.filter((draft) => draft.status === 'draft').length
  const sentCount = drafts.filter((draft) => draft.status === 'sent').length
  const rejectedCount = drafts.filter((draft) => draft.status === 'rejected').length
  const failedCount = drafts.filter((draft) => draft.status === 'failed').length
  const mailStatusSummary = [
    draftCount > 0 ? `초안 ${draftCount}` : null,
    sentCount > 0 ? `발송 ${sentCount}` : null,
    rejectedCount > 0 ? `거부 ${rejectedCount}` : null,
    failedCount > 0 ? `실패 ${failedCount}` : null,
  ].filter(Boolean).join(' · ')

  return {
    draftCount,
    failedCount,
    mailStatusSummary,
  }
}

export async function ReviewWorkspaceDeferredPreviews({
  tenantId,
  selectedSession,
  refreshHref,
  showJournalEntry = true,
}: {
  tenantId: string
  selectedSession: ReviewSession | null
  refreshHref: string
  showJournalEntry?: boolean
}) {
  let journalEntryPreviewLines: ReturnType<typeof toJournalEntryExportLines>

  try {
    const previewData = await loadPreviewData(tenantId, selectedSession, {
      showJournalEntry,
    })
    journalEntryPreviewLines = previewData.journalEntryPreviewLines
  } catch {
    return <ReviewWorkspaceDeferredError section="previews" refreshHref={refreshHref} />
  }

  return (
    <>
      {showJournalEntry ? (
        <ReviewWorkspaceCollapsibleSection
          title="전표분개 미리보기"
          description="선택한 요청의 기간이 걸치는 달에 대해 fiscal-year ledger에 누적된 전표분개 초안을 확인합니다."
          defaultOpen
          badge={{
            label: `${journalEntryPreviewLines.length}줄`,
            variant: journalEntryPreviewLines.length > 0 ? 'success' : 'secondary',
          }}
        >
          <div className="p-4 pt-3">
            <ReviewJournalEntryPreview lines={journalEntryPreviewLines} />
          </div>
        </ReviewWorkspaceCollapsibleSection>
      ) : (
        <ReviewWorkspaceDeactivatedLedgerPanel title="전표분개 미리보기" />
      )}
    </>
  )
}

export async function ReviewWorkspaceDeferredApprovalQueue({
  tenantId,
  selectedSessionId,
  clientDisplayNameBySessionId,
  refreshHref,
}: {
  tenantId: string
  selectedSessionId: string | null
  clientDisplayNameBySessionId: Record<string, string>
  refreshHref: string
}) {
  let drafts: ApprovalEmailRow[]

  try {
    if (selectedSessionId) {
      const { generateMissingRequestDraft } = await import('@/lib/email/missing-request')
      await generateMissingRequestDraft(selectedSessionId, tenantId)
    }
    drafts = await loadApprovalEmailRows(tenantId, clientDisplayNameBySessionId, selectedSessionId)
  } catch (err) {
    console.error('[ReviewWorkspaceDeferredApprovalQueue]', err)
    return <ReviewWorkspaceDeferredError section="approval" refreshHref={refreshHref} />
  }

  const { draftCount, failedCount, mailStatusSummary } = buildMailStatusSummary(drafts)

  return (
    <ReviewWorkspaceCollapsibleSection
      title="보충 요청 메일"
      description="자료가 부족한 세션의 고객 답메일 초안과 발송 상태를 확인합니다."
      badge={{
        label: mailStatusSummary || '메일 없음',
        variant: draftCount > 0 || failedCount > 0 ? 'warning' : 'success',
      }}
    >
      <div className="p-4 pt-3">
        <ApprovalQueueSection drafts={drafts} initialSessionId={selectedSessionId ?? undefined} />
      </div>
    </ReviewWorkspaceCollapsibleSection>
  )
}
