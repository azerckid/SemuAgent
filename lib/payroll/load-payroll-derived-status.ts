import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  outboundEmail,
  payrollExcelDraft,
  payrollExtractionBatch,
  payrollExtractionRow,
  uploadSession,
} from '@/lib/db/schema'
import { now } from '@/lib/time'
import { derivePayrollDisplayStatus, type PayrollDisplayStatus } from './payroll-status'

export async function loadPayrollDerivedStatusBySessionId(params: {
  tenantId: string
  clientId: string
  sessionIds: string[]
}): Promise<Map<string, PayrollDisplayStatus>> {
  const { tenantId, clientId, sessionIds } = params
  if (sessionIds.length === 0) return new Map()

  const sessions = await db
    .select({
      id: uploadSession.id,
      status: uploadSession.status,
      requestEventId: uploadSession.requestEventId,
    })
    .from(uploadSession)
    .where(and(
      eq(uploadSession.tenantId, tenantId),
      eq(uploadSession.clientId, clientId),
      eq(uploadSession.requestKind, 'payroll'),
      isNull(uploadSession.deletedAt),
      inArray(uploadSession.id, sessionIds),
    ))

  if (sessions.length === 0) return new Map()

  const scopedSessionIds = sessions.map((session) => session.id)
  const requestEventIds = sessions
    .map((session) => session.requestEventId)
    .filter((id): id is string => Boolean(id))

  const [emails, batches, drafts] = await Promise.all([
    scopedSessionIds.length > 0
      ? db
        .select({
          uploadSessionId: outboundEmail.uploadSessionId,
          requestEventId: outboundEmail.requestEventId,
          status: outboundEmail.status,
        })
        .from(outboundEmail)
        .where(and(
          eq(outboundEmail.tenantId, tenantId),
          requestEventIds.length > 0
            ? or(
              inArray(outboundEmail.requestEventId, requestEventIds),
              inArray(outboundEmail.uploadSessionId, scopedSessionIds),
            )
            : inArray(outboundEmail.uploadSessionId, scopedSessionIds),
        ))
        .orderBy(desc(outboundEmail.createdAt))
      : [],
    db
      .select({
        id: payrollExtractionBatch.id,
        uploadSessionId: payrollExtractionBatch.uploadSessionId,
        status: payrollExtractionBatch.status,
        errorMessage: payrollExtractionBatch.errorMessage,
        createdAt: payrollExtractionBatch.createdAt,
      })
      .from(payrollExtractionBatch)
      .where(and(
        eq(payrollExtractionBatch.tenantId, tenantId),
        inArray(payrollExtractionBatch.uploadSessionId, scopedSessionIds),
      ))
      .orderBy(desc(payrollExtractionBatch.createdAt)),
    db
      .select({
        id: payrollExcelDraft.id,
        uploadSessionId: payrollExcelDraft.uploadSessionId,
        batchId: payrollExcelDraft.batchId,
        status: payrollExcelDraft.status,
        generatedAt: payrollExcelDraft.generatedAt,
      })
      .from(payrollExcelDraft)
      .where(and(
        eq(payrollExcelDraft.tenantId, tenantId),
        inArray(payrollExcelDraft.uploadSessionId, scopedSessionIds),
      ))
      .orderBy(desc(payrollExcelDraft.generatedAt)),
  ])

  const latestBatchBySessionId = new Map<string, typeof batches[number]>()
  for (const batch of batches) {
    if (!latestBatchBySessionId.has(batch.uploadSessionId)) {
      latestBatchBySessionId.set(batch.uploadSessionId, batch)
    }
  }

  const latestBatchIds = Array.from(latestBatchBySessionId.values()).map((batch) => batch.id)
  const rows = latestBatchIds.length > 0
    ? await db
      .select({
        batchId: payrollExtractionRow.batchId,
        aiVerdict: payrollExtractionRow.aiVerdict,
      })
      .from(payrollExtractionRow)
      .where(and(
        eq(payrollExtractionRow.tenantId, tenantId),
        inArray(payrollExtractionRow.batchId, latestBatchIds),
      ))
    : []

  const rowsByBatchId = new Map<string, typeof rows>()
  for (const row of rows) {
    const batchRows = rowsByBatchId.get(row.batchId) ?? []
    batchRows.push(row)
    rowsByBatchId.set(row.batchId, batchRows)
  }

  const latestGeneratedDraftByBatchId = new Set<string>()
  for (const draft of drafts) {
    if (draft.status !== 'generated') continue
    if (!latestGeneratedDraftByBatchId.has(draft.batchId)) {
      latestGeneratedDraftByBatchId.add(draft.batchId)
    }
  }

  const latestEmailBySessionId = new Map<string, string>()
  const sessionIdByEventId = new Map(sessions.map((session) => [session.requestEventId, session.id]))
  for (const email of emails) {
    const sessionId = email.uploadSessionId ?? (email.requestEventId ? sessionIdByEventId.get(email.requestEventId) : undefined)
    if (sessionId && !latestEmailBySessionId.has(sessionId)) {
      latestEmailBySessionId.set(sessionId, email.status)
    }
  }

  const referenceTime = now()
  const result = new Map<string, PayrollDisplayStatus>()
  for (const session of sessions) {
    const batch = latestBatchBySessionId.get(session.id) ?? null
    const batchRows = batch ? rowsByBatchId.get(batch.id) ?? [] : []
    const passCount = batchRows.filter((row) => row.aiVerdict === 'pass').length
    const failCount = batchRows.filter((row) => row.aiVerdict === 'fail').length
    result.set(session.id, derivePayrollDisplayStatus({
      failCount,
      passCount,
      generatedDraft: Boolean(batch && latestGeneratedDraftByBatchId.has(batch.id)),
      batch,
      sessionStatus: session.status,
      emailStatus: latestEmailBySessionId.get(session.id) ?? null,
      eventStatus: 'sent',
      referenceTime,
    }))
  }

  return result
}
