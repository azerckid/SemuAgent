import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  client,
  clientRequestEvent,
  outboundEmail,
  payrollExcelDraft,
  payrollExtractionBatch,
  payrollExtractionRow,
  staff,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'
import {
  derivePayrollResultExcelDownloadState,
  derivePayrollSourceDownloadState,
  type PayrollResultExcelDownloadState,
  type PayrollSourceDownloadState,
} from '@/lib/sessions/payroll-source-download'
import { now } from '@/lib/time'
import { isPayrollRunningBatchStale } from '@/lib/payroll/extraction-status'
import { derivePayrollDisplayStatus, type PayrollDisplayStatus } from '@/lib/payroll/payroll-status'

export type PayrollEventRow = {
  id: string
  clientId: string
  clientName: string
  clientEmail: string
  staffName: string | null
  title: string
  accountingPeriod: string
  dueAt: string
  status: string
  uploadSessionId: string | null
  createdAt: string
}

export type PayrollSessionRow = typeof uploadSession.$inferSelect
export type PayrollEmailRow = typeof outboundEmail.$inferSelect
export type PayrollBatchRow = typeof payrollExtractionBatch.$inferSelect
export type PayrollRow = typeof payrollExtractionRow.$inferSelect
export type PayrollDraftRow = typeof payrollExcelDraft.$inferSelect
export type PayrollSourceFileRow = Pick<
  typeof uploadFile.$inferSelect,
  'id' | 'uploadSessionId' | 'originalFilename' | 'fileSize' | 'uploadedAt' | 'passwordStatus'
>

export type PayrollSummary = {
  event: PayrollEventRow
  session: PayrollSessionRow | null
  displayClientName: string
  email: PayrollEmailRow | null
  batch: PayrollBatchRow | null
  rows: PayrollRow[]
  drafts: PayrollDraftRow[]
  passCount: number
  failCount: number
  sourceFiles: PayrollSourceFileRow[]
  sourceFileCount: number
  sourceDownloadState: PayrollSourceDownloadState
  resultDownloadState: PayrollResultExcelDownloadState
  generatedDraft: PayrollDraftRow | null
  isBatchStale: boolean
  status: PayrollDisplayStatus
}

const PAYROLL_EVENT_SELECT = {
  id: clientRequestEvent.id,
  clientId: clientRequestEvent.clientId,
  clientName: client.name,
  clientEmail: client.email,
  staffName: staff.name,
  title: clientRequestEvent.title,
  accountingPeriod: clientRequestEvent.accountingPeriod,
  dueAt: clientRequestEvent.dueAt,
  status: clientRequestEvent.status,
  uploadSessionId: clientRequestEvent.uploadSessionId,
  createdAt: clientRequestEvent.createdAt,
} as const

function getLatestPayrollDraft(drafts: PayrollDraftRow[]): PayrollDraftRow | null {
  return drafts.reduce<PayrollDraftRow | null>((latest, draft) => {
    if (!latest) return draft
    return draft.generatedAt.localeCompare(latest.generatedAt) > 0 ? draft : latest
  }, null)
}

/**
 * Loads upload sessions, emails, batches, drafts, rows, and source files for
 * a known, bounded set of payroll request events, and shapes them into
 * PayrollSummary[] via buildSummaries. Shared by the main event-list page
 * flow and loadPayrollSummaryByEventId so both paths use one query shape.
 */
export async function loadPayrollSummaries(tenantId: string, events: PayrollEventRow[]): Promise<PayrollSummary[]> {
  if (events.length === 0) return []

  const eventIds = events.map((event) => event.id)
  const eventSessionIds = events
    .map((event) => event.uploadSessionId)
    .filter((id): id is string => Boolean(id))

  const sessionWhere = and(
    eq(uploadSession.tenantId, tenantId),
    eq(uploadSession.requestKind, 'payroll'),
    isNull(uploadSession.deletedAt),
    eventSessionIds.length > 0
      ? or(inArray(uploadSession.requestEventId, eventIds), inArray(uploadSession.id, eventSessionIds))
      : inArray(uploadSession.requestEventId, eventIds),
  )

  const payrollSessions = await db.select().from(uploadSession).where(sessionWhere).orderBy(desc(uploadSession.createdAt))

  const sessionIds = Array.from(new Set([
    ...eventSessionIds,
    ...payrollSessions.map((session) => session.id),
  ]))

  const [payrollEmails, payrollBatches, payrollDrafts, payrollSourceFiles] = await Promise.all([
    db
      .select()
      .from(outboundEmail)
      .where(
        and(
          eq(outboundEmail.tenantId, tenantId),
          sessionIds.length > 0
            ? or(inArray(outboundEmail.requestEventId, eventIds), inArray(outboundEmail.uploadSessionId, sessionIds))
            : inArray(outboundEmail.requestEventId, eventIds),
        ),
      )
      .orderBy(desc(outboundEmail.createdAt))
      .limit(300),
    sessionIds.length > 0
      ? db
        .select()
        .from(payrollExtractionBatch)
        .where(and(eq(payrollExtractionBatch.tenantId, tenantId), inArray(payrollExtractionBatch.uploadSessionId, sessionIds)))
        .orderBy(desc(payrollExtractionBatch.createdAt))
      : [],
    sessionIds.length > 0
      ? db
        .select()
        .from(payrollExcelDraft)
        .where(and(eq(payrollExcelDraft.tenantId, tenantId), inArray(payrollExcelDraft.uploadSessionId, sessionIds)))
        .orderBy(desc(payrollExcelDraft.generatedAt))
      : [],
    sessionIds.length > 0
      ? db
        .select({
          id: uploadFile.id,
          uploadSessionId: uploadFile.uploadSessionId,
          originalFilename: uploadFile.originalFilename,
          fileSize: uploadFile.fileSize,
          uploadedAt: uploadFile.uploadedAt,
          passwordStatus: uploadFile.passwordStatus,
        })
        .from(uploadFile)
        .where(and(eq(uploadFile.tenantId, tenantId), inArray(uploadFile.uploadSessionId, sessionIds)))
        .orderBy(desc(uploadFile.uploadedAt))
      : [],
  ])

  const latestBatchIds = Array.from(new Set(payrollBatches.map((batch) => batch.id)))
  const payrollRows = latestBatchIds.length > 0
    ? await db
      .select()
      .from(payrollExtractionRow)
      .where(and(eq(payrollExtractionRow.tenantId, tenantId), inArray(payrollExtractionRow.batchId, latestBatchIds)))
      .orderBy(payrollExtractionRow.createdAt)
    : []

  return buildSummaries({
    events,
    sessions: payrollSessions,
    emails: payrollEmails,
    batches: payrollBatches,
    rows: payrollRows,
    drafts: payrollDrafts,
    sourceFiles: payrollSourceFiles,
    referenceTime: now(),
  })
}

/**
 * Tenant-scoped lookup for exactly one payroll request event by id,
 * regardless of whether it's in any already-loaded recency-bounded page.
 * Used by /dashboard/payroll so a stale or shared ?eventId= link never
 * silently falls back to a different client's payroll request — it either
 * resolves to the exact requested summary or returns null for an explicit
 * not-found state. Excludes general (non-payroll) events and soft-deleted
 * events, matching the event-list query this page uses elsewhere.
 */
export async function loadPayrollSummaryByEventId(tenantId: string, eventId: string): Promise<PayrollSummary | null> {
  const eventRows = await db
    .select(PAYROLL_EVENT_SELECT)
    .from(clientRequestEvent)
    .innerJoin(client, and(eq(clientRequestEvent.clientId, client.id), eq(client.tenantId, tenantId)))
    .leftJoin(staff, and(eq(client.staffId, staff.id), eq(staff.tenantId, tenantId)))
    .where(
      and(
        eq(clientRequestEvent.id, eventId),
        eq(clientRequestEvent.tenantId, tenantId),
        eq(clientRequestEvent.requestKind, 'payroll'),
        isNull(clientRequestEvent.deletedAt),
      ),
    )
    .limit(1)

  if (eventRows.length === 0) return null

  const summaries = await loadPayrollSummaries(tenantId, eventRows)
  return summaries[0] ?? null
}

function buildSummaries({
  events,
  sessions,
  emails,
  batches,
  rows,
  drafts,
  sourceFiles,
  referenceTime,
}: {
  events: PayrollEventRow[]
  sessions: PayrollSessionRow[]
  emails: PayrollEmailRow[]
  batches: PayrollBatchRow[]
  rows: PayrollRow[]
  drafts: PayrollDraftRow[]
  sourceFiles: PayrollSourceFileRow[]
  referenceTime: ReturnType<typeof now>
}): PayrollSummary[] {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const sessionByEventId = new Map<string, PayrollSessionRow>()
  for (const session of sessions) {
    if (session.requestEventId && !sessionByEventId.has(session.requestEventId)) {
      sessionByEventId.set(session.requestEventId, session)
    }
  }

  const latestEmailByEventId = new Map<string, PayrollEmailRow>()
  const latestEmailBySessionId = new Map<string, PayrollEmailRow>()
  for (const email of emails) {
    if (email.requestEventId && !latestEmailByEventId.has(email.requestEventId)) {
      latestEmailByEventId.set(email.requestEventId, email)
    }
    if (email.uploadSessionId && !latestEmailBySessionId.has(email.uploadSessionId)) {
      latestEmailBySessionId.set(email.uploadSessionId, email)
    }
  }

  const latestBatchBySessionId = new Map<string, PayrollBatchRow>()
  for (const batch of batches) {
    if (!latestBatchBySessionId.has(batch.uploadSessionId)) {
      latestBatchBySessionId.set(batch.uploadSessionId, batch)
    }
  }

  const rowsByBatchId = new Map<string, PayrollRow[]>()
  for (const row of rows) {
    const batchRows = rowsByBatchId.get(row.batchId) ?? []
    batchRows.push(row)
    rowsByBatchId.set(row.batchId, batchRows)
  }

  const draftsBySessionId = new Map<string, PayrollDraftRow[]>()
  for (const draft of drafts) {
    const sessionDrafts = draftsBySessionId.get(draft.uploadSessionId) ?? []
    sessionDrafts.push(draft)
    draftsBySessionId.set(draft.uploadSessionId, sessionDrafts)
  }

  const sourceFilesBySessionId = new Map<string, PayrollSourceFileRow[]>()
  for (const sourceFile of sourceFiles) {
    const sessionFiles = sourceFilesBySessionId.get(sourceFile.uploadSessionId) ?? []
    sessionFiles.push(sourceFile)
    sourceFilesBySessionId.set(sourceFile.uploadSessionId, sessionFiles)
  }

  return events.map((event) => {
    const session = event.uploadSessionId
      ? sessionById.get(event.uploadSessionId) ?? sessionByEventId.get(event.id) ?? null
      : sessionByEventId.get(event.id) ?? null
    const displayClientName = session?.staffDirectLabel ?? event.clientName
    const email = latestEmailByEventId.get(event.id)
      ?? (session ? latestEmailBySessionId.get(session.id) : undefined)
      ?? null
    const batch = session ? latestBatchBySessionId.get(session.id) ?? null : null
    const summaryRows = batch ? rowsByBatchId.get(batch.id) ?? [] : []
    const sessionDrafts = session ? draftsBySessionId.get(session.id) ?? [] : []
    const batchDrafts = batch
      ? sessionDrafts.filter((draft) => draft.batchId === batch.id)
      : []
    const latestDraft = getLatestPayrollDraft(batchDrafts)
    const summaryDrafts = latestDraft ? [latestDraft] : []
    const passCount = summaryRows.filter((row) => row.aiVerdict === 'pass').length
    const failCount = summaryRows.filter((row) => row.aiVerdict === 'fail').length
    const generatedDraft = latestDraft?.status === 'generated' ? latestDraft : null
    const sessionSourceFiles = session ? sourceFilesBySessionId.get(session.id) ?? [] : []
    const sourceFileCount = sessionSourceFiles.length
    const sourceDownloadState = derivePayrollSourceDownloadState({
      batchStatus: batch?.status ?? null,
      rowVerdicts: summaryRows.map((row) => row.aiVerdict),
      sourceFileCount,
    })
    const resultDownloadState = derivePayrollResultExcelDownloadState({
      batchStatus: batch?.status ?? null,
      rowVerdicts: summaryRows.map((row) => row.aiVerdict),
    })
    const isBatchStale = isPayrollRunningBatchStale(batch, referenceTime)
    const withoutStatus = {
      event,
      session,
      displayClientName,
      email,
      batch,
      rows: summaryRows,
      drafts: summaryDrafts,
      passCount,
      failCount,
      sourceFiles: sessionSourceFiles,
      sourceFileCount,
      sourceDownloadState,
      resultDownloadState,
      generatedDraft,
      isBatchStale,
    }

    return {
      ...withoutStatus,
      status: derivePayrollDisplayStatus({
        failCount,
        passCount,
        generatedDraft: Boolean(generatedDraft),
        batch,
        sessionStatus: session?.status ?? null,
        emailStatus: email?.status ?? null,
        eventStatus: event.status,
        referenceTime,
      }),
    }
  })
}
