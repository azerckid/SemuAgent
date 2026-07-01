import { and, desc, eq, inArray, lte, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bookkeepingClassificationRun,
  bookkeepingTransactionClassification,
  uploadFile,
} from '@/lib/db/schema'
import {
  CLASSIFICATION_RUNNING_STALE_MINUTES,
  isFreshClassificationRunningRun,
} from '@/lib/bookkeeping/classification-run-status'
import { isDisplayableClassificationRow } from '@/lib/bookkeeping/classification-rows'
import { now, toDBString, type DateTime } from '@/lib/time'

export const START_REPLACE_RUN_STATUSES = ['draft', 'running'] as const

export async function cleanupStaleBookkeepingClassificationRuns(params: {
  tenantId: string
  sessionId?: string
  referenceTime?: DateTime
}): Promise<number> {
  const referenceTime = params.referenceTime ?? now()
  const staleBefore = toDBString(referenceTime.minus({ minutes: CLASSIFICATION_RUNNING_STALE_MINUTES }))
  const conditions = [
    eq(bookkeepingClassificationRun.tenantId, params.tenantId),
    eq(bookkeepingClassificationRun.status, 'running'),
    lte(bookkeepingClassificationRun.updatedAt, staleBefore),
  ]

  if (params.sessionId) {
    conditions.push(eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId))
  }

  const staleRows = await db
    .select({ id: bookkeepingClassificationRun.id })
    .from(bookkeepingClassificationRun)
    .where(and(...conditions))

  if (staleRows.length === 0) return 0

  const ts = toDBString(referenceTime)
  await db
    .update(bookkeepingClassificationRun)
    .set({
      status: 'failed',
      errorMessage: [
        `계정항목 정리가 ${CLASSIFICATION_RUNNING_STALE_MINUTES}분 이상 완료되지 않아 중단된 것으로 처리했습니다.`,
        '다시 정리를 실행할 수 있습니다.',
      ].join('\n'),
      updatedAt: ts,
    })
    .where(inArray(bookkeepingClassificationRun.id, staleRows.map((row) => row.id)))

  return staleRows.length
}

export async function restoreSupersededCompletedAfterEmptyFailedRun(params: {
  tenantId: string
  sessionId: string
}): Promise<string | null> {
  const [latestRun] = await db
    .select()
    .from(bookkeepingClassificationRun)
    .where(
      and(
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId),
      ),
    )
    .orderBy(desc(bookkeepingClassificationRun.createdAt))
    .limit(1)

  if (!latestRun || latestRun.status !== 'failed' || latestRun.extractedRowCount > 0) {
    return null
  }

  const supersededRuns = await db
    .select({ id: bookkeepingClassificationRun.id })
    .from(bookkeepingClassificationRun)
    .where(
      and(
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId),
        eq(bookkeepingClassificationRun.status, 'superseded'),
      ),
    )
    .orderBy(desc(bookkeepingClassificationRun.createdAt))

  for (const candidate of supersededRuns) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookkeepingTransactionClassification)
      .where(
        and(
          eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
          eq(bookkeepingTransactionClassification.classificationRunId, candidate.id),
        ),
      )

    if ((countRow?.count ?? 0) === 0) continue

    const ts = toDBString(now())
    await db
      .update(bookkeepingClassificationRun)
      .set({ status: 'completed', errorMessage: null, updatedAt: ts })
      .where(
        and(
          eq(bookkeepingClassificationRun.id, candidate.id),
          eq(bookkeepingClassificationRun.tenantId, params.tenantId),
          eq(bookkeepingClassificationRun.status, 'superseded'),
        ),
      )

    return candidate.id
  }

  return null
}

export async function reconcileBookkeepingClassificationSession(params: {
  tenantId: string
  sessionId: string
  referenceTime?: DateTime
}) {
  await cleanupStaleBookkeepingClassificationRuns(params)
  await restoreSupersededCompletedAfterEmptyFailedRun(params)
}

export async function findFreshRunningClassificationRun(params: {
  tenantId: string
  sessionId: string
  referenceTime?: DateTime
}) {
  const referenceTime = params.referenceTime ?? now()
  const runs = await db
    .select()
    .from(bookkeepingClassificationRun)
    .where(
      and(
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId),
        eq(bookkeepingClassificationRun.status, 'running'),
      ),
    )
    .orderBy(desc(bookkeepingClassificationRun.createdAt))

  return runs.find((run) => isFreshClassificationRunningRun(run, referenceTime)) ?? null
}

export async function loadClassificationRowsForRun(params: {
  tenantId: string
  runId: string
}) {
  const rowResults = await db
    .select({
      row: bookkeepingTransactionClassification,
      sourceFilename: uploadFile.originalFilename,
    })
    .from(bookkeepingTransactionClassification)
    .leftJoin(uploadFile, and(
      eq(bookkeepingTransactionClassification.uploadFileId, uploadFile.id),
      eq(uploadFile.tenantId, params.tenantId),
    ))
    .where(
      and(
        eq(bookkeepingTransactionClassification.classificationRunId, params.runId),
        eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
      ),
    )
    .orderBy(bookkeepingTransactionClassification.transactionDate, bookkeepingTransactionClassification.createdAt)

  return rowResults
    .map(({ row, sourceFilename }) => ({ ...row, sourceFilename }))
    .filter(isDisplayableClassificationRow)
}

export async function resolveBookkeepingClassificationView(params: {
  tenantId: string
  sessionId: string
  referenceTime?: DateTime
}) {
  await reconcileBookkeepingClassificationSession(params)
  const referenceTime = params.referenceTime ?? now()

  const runs = await db
    .select()
    .from(bookkeepingClassificationRun)
    .where(
      and(
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId),
      ),
    )
    .orderBy(desc(bookkeepingClassificationRun.createdAt))

  const latestAttemptRun = runs[0] ?? null
  const progressRun = runs.find((run) => isFreshClassificationRunningRun(run, referenceTime)) ?? null
  const displayRun = runs.find((run) => run.status === 'completed') ?? null
  const rows = displayRun
    ? await loadClassificationRowsForRun({ tenantId: params.tenantId, runId: displayRun.id })
    : []

  return {
    latestAttemptRun,
    progressRun,
    displayRun,
    rows,
    run: displayRun ?? progressRun ?? latestAttemptRun,
  }
}

export async function supersedePreviousCompletedClassificationRuns(params: {
  tenantId: string
  sessionId: string
  exceptRunId: string
}) {
  const ts = toDBString(now())
  await db
    .update(bookkeepingClassificationRun)
    .set({ status: 'superseded', updatedAt: ts })
    .where(
      and(
        eq(bookkeepingClassificationRun.uploadSessionId, params.sessionId),
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.status, 'completed'),
        ne(bookkeepingClassificationRun.id, params.exceptRunId),
      ),
    )
}
