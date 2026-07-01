import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingClassificationRun,
  bookkeepingJournalEntryRun,
  bookkeepingMaterialAttribution,
  outboundEmail,
  requestItemValidation,
  requestItemValidationFile,
  uploadSession,
} from '@/lib/db/schema'
import { now, toDBString } from '@/lib/time'

const REVISION_STATUSES = ['submitted', 'ai_checking', 'needs_resubmission', 'ready_for_accountant'] as const
const MUTABLE_STATUSES = ['requested', 'active', ...REVISION_STATUSES] as const

export function isMutableUploadSessionStatus(status: string) {
  return (MUTABLE_STATUSES as readonly string[]).includes(status)
}

export async function markSessionFilesRevised(params: {
  sessionId: string
  tenantId: string
  hasFiles: boolean
}) {
  const { sessionId, tenantId, hasFiles } = params

  const sessionRows = await db
    .select({
      status: uploadSession.status,
      requestKind: uploadSession.requestKind,
    })
    .from(uploadSession)
    .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))
    .limit(1)

  const session = sessionRows[0]
  if (!session) return null
  if (session.requestKind !== 'general') return session.status
  if (!(REVISION_STATUSES as readonly string[]).includes(session.status)) return session.status

  const validationRows = await db
    .select({ id: requestItemValidation.id })
    .from(requestItemValidation)
    .where(
      and(
        eq(requestItemValidation.uploadSessionId, sessionId),
        eq(requestItemValidation.tenantId, tenantId),
      ),
    )

  const validationIds = validationRows.map((row) => row.id)
  const nextStatus = hasFiles ? 'submitted' : 'active'

  await db.transaction(async (tx) => {
    if (validationIds.length > 0) {
      await tx
        .delete(requestItemValidationFile)
        .where(
          and(
            eq(requestItemValidationFile.tenantId, tenantId),
            inArray(requestItemValidationFile.validationId, validationIds),
          ),
        )
      await tx
        .delete(requestItemValidation)
        .where(
          and(
            eq(requestItemValidation.tenantId, tenantId),
            eq(requestItemValidation.uploadSessionId, sessionId),
          ),
        )
    }

    await tx
      .update(uploadSession)
      .set({
        status: nextStatus,
        sessionEvaluation: null,
      })
      .where(and(eq(uploadSession.id, sessionId), eq(uploadSession.tenantId, tenantId)))

    await tx
      .update(outboundEmail)
      .set({ status: 'rejected' })
      .where(
        and(
          eq(outboundEmail.uploadSessionId, sessionId),
          eq(outboundEmail.tenantId, tenantId),
          eq(outboundEmail.type, 'missing_request'),
          eq(outboundEmail.status, 'draft'),
        ),
      )

    await tx
      .update(bookkeepingClassificationRun)
      .set({
        status: 'superseded',
        updatedAt: toDBString(now()),
      })
      .where(
        and(
          eq(bookkeepingClassificationRun.uploadSessionId, sessionId),
          eq(bookkeepingClassificationRun.tenantId, tenantId),
          inArray(bookkeepingClassificationRun.status, ['draft', 'running', 'completed']),
        ),
      )

    await tx
      .update(bookkeepingMaterialAttribution)
      .set({
        status: 'superseded',
        updatedAt: toDBString(now()),
      })
      .where(
        and(
          eq(bookkeepingMaterialAttribution.uploadSessionId, sessionId),
          eq(bookkeepingMaterialAttribution.tenantId, tenantId),
          eq(bookkeepingMaterialAttribution.status, 'active'),
        ),
      )

    await tx
      .update(bookkeepingJournalEntryRun)
      .set({
        status: 'superseded',
        updatedAt: toDBString(now()),
      })
      .where(
        and(
          eq(bookkeepingJournalEntryRun.uploadSessionId, sessionId),
          eq(bookkeepingJournalEntryRun.tenantId, tenantId),
          inArray(bookkeepingJournalEntryRun.status, ['draft', 'completed']),
        ),
      )
  })

  return nextStatus
}
