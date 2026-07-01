import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, staff, uploadSession } from '@/lib/db/schema'
import { buildReviewSessions } from '@/lib/reviews/build-review-sessions'
import { loadReviewSessionById, loadSessionDependents } from '@/lib/reviews/load-review-session-by-id'
import { deriveMaterialAttributionDisplayStatus } from '@/lib/reviews/period-attribution-status'
import {
  DEACTIVATED_ACCOUNT_CLASSIFICATION_STATUS,
  DEACTIVATED_JOURNAL_ENTRY_STATUS,
  REVIEW_ACCOUNT_CLASSIFICATION_DEACTIVATED_V1,
  REVIEW_JOURNAL_ENTRY_DEACTIVATED_V1,
} from '@/lib/reviews/review-ledger-deactivation'
import { getOrCreateFiscalYearLedgerSummary, type FiscalLedgerMonthSummary } from '@/lib/bookkeeping/fiscal-year-ledger'
import {
  deriveAccountClassificationDisplayStatus,
  deriveJournalEntryDisplayStatus,
  pickLeastAdvancedLedgerStatus,
  resolveSessionLedgerMonths,
} from '@/lib/bookkeeping/ledger-status'
import type { DisplayStatus } from '@/lib/status-tone'
import { ReviewWorkspace } from './_components/review-workspace'
import { ReviewAttributionSavedPromptCard } from './_components/review-attribution-saved-prompt-card'
import { ReviewWorkspaceDeferredFallback } from './_components/review-workspace-deferred-fallback'
import {
  ReviewWorkspaceDeferredApprovalQueue,
  ReviewWorkspaceDeferredPreviews,
} from './_components/review-workspace-deferred-panels'
import { deriveReviewAdaptiveStructuringEligibility } from '@/lib/reviews/adaptive-structuring-eligibility'
import { getReviewRequestMethodLabel } from './_components/review-request-method'
import { sortReviewSessions } from '@/lib/reviews/review-session-order'
import type { ReviewRequestListItem } from './_components/review-request-list'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

const REVIEWS_PAGE_SIZE = 50

const NOT_BOOKKEEPING_STATUS: DisplayStatus = {
  label: '해당없음',
  detail: '기장 업무가 아닌 요청입니다',
  tone: 'default',
}

const reviewsSearchParamsSchema = z.object({
  sessionId: z.string().trim().min(1).max(200).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z
    .preprocess((value) => (typeof value === 'string' ? Number(value) : 1), z.number().int().min(1))
    .catch(1),
})

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function singleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

// 요청 방식 라벨("메일업로드"/"직접업로드")을 검색어로 찾을 수 있도록 두 라벨
// 문자열에 대해 직접 LIKE 매칭한다. payroll의 동일 패턴과 라벨을 맞춘다.
function buildSessionSearchCondition(query: string | undefined) {
  if (!query) return undefined

  const pattern = `%${query.toLowerCase()}%`
  return or(
    sql`lower(${client.name}) like ${pattern}`,
    sql`lower(coalesce(${staff.name}, '')) like ${pattern}`,
    sql`lower(${uploadSession.accountingPeriod}) like ${pattern}`,
    sql`lower(coalesce(${uploadSession.staffDirectLabel}, '')) like ${pattern}`,
    sql`lower(case when ${uploadSession.source} = 'staff_direct' then '직접업로드' else '메일업로드' end) like ${pattern}`,
  )
}

function formatAccountingPeriodLabel(period: string) {
  const [year, month] = period.split('-')
  if (!year || !month) return period
  return `${year}.${month}`
}

async function loadLedgerStatusesBySessionId(
  tenantId: string,
  sessions: ReviewSession[],
): Promise<Map<string, { accountClassification: DisplayStatus; journalEntry: DisplayStatus }>> {
  const bookkeepingSessions = sessions.filter((session) => session.workType === 'bookkeeping')
  const ledgerKeyBySessionId = new Map<string, string>()
  const monthsBySessionId = new Map<string, string[]>()
  const fiscalYearByKey = new Map<string, { clientId: string; fiscalYear: number }>()

  for (const session of bookkeepingSessions) {
    const resolved = resolveSessionLedgerMonths(session)
    if (!resolved) continue
    const key = `${session.clientId}__${resolved.fiscalYear}`
    ledgerKeyBySessionId.set(session.id, key)
    monthsBySessionId.set(session.id, resolved.months)
    fiscalYearByKey.set(key, { clientId: session.clientId, fiscalYear: resolved.fiscalYear })
  }

  const uniqueKeys = Array.from(fiscalYearByKey.entries())
  const summaries = await Promise.all(
    uniqueKeys.map(([, params]) => getOrCreateFiscalYearLedgerSummary({ tenantId, ...params })),
  )
  const monthsByKey = new Map<string, Map<string, FiscalLedgerMonthSummary>>()
  uniqueKeys.forEach(([key], index) => {
    const summary = summaries[index]
    if (!summary) return
    monthsByKey.set(key, new Map(summary.months.map((month) => [month.periodMonth, month])))
  })

  const result = new Map<string, { accountClassification: DisplayStatus; journalEntry: DisplayStatus }>()
  for (const session of sessions) {
    if (session.workType !== 'bookkeeping') {
      result.set(session.id, { accountClassification: NOT_BOOKKEEPING_STATUS, journalEntry: NOT_BOOKKEEPING_STATUS })
      continue
    }

    const key = ledgerKeyBySessionId.get(session.id)
    const months = monthsBySessionId.get(session.id) ?? []
    const monthMap = key ? monthsByKey.get(key) : undefined
    const coveredStatuses = months
      .map((month) => monthMap?.get(month)?.status)
      .filter((status): status is NonNullable<typeof status> => Boolean(status))
    const combinedStatus = pickLeastAdvancedLedgerStatus(coveredStatuses)

    result.set(session.id, {
      accountClassification: deriveAccountClassificationDisplayStatus(combinedStatus),
      journalEntry: deriveJournalEntryDisplayStatus(combinedStatus),
    })
  }

  return result
}

function buildReviewHref(params: { sessionId?: string; q?: string; page?: number }) {
  const searchParams = new URLSearchParams()
  if (params.sessionId) searchParams.set('sessionId', params.sessionId)
  if (params.q) searchParams.set('q', params.q)
  if (params.page && params.page > 1) searchParams.set('page', String(params.page))
  const query = searchParams.toString()
  return query ? `/dashboard/reviews?${query}` : '/dashboard/reviews'
}

export default async function ReviewsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const parsedSearchParams = reviewsSearchParamsSchema.safeParse({
    sessionId: singleSearchParam(resolvedSearchParams.sessionId),
    q: singleSearchParam(resolvedSearchParams.q),
    page: singleSearchParam(resolvedSearchParams.page),
  })
  const filters = parsedSearchParams.success
    ? parsedSearchParams.data
    : { sessionId: undefined, q: undefined, page: 1 }

  let tenantId: string
  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const sessionConditions: SQL[] = [
    eq(uploadSession.tenantId, tenantId),
    eq(uploadSession.requestKind, 'general'),
    isNull(uploadSession.deletedAt),
  ]
  const searchCondition = buildSessionSearchCondition(filters.q)
  if (searchCondition) sessionConditions.push(searchCondition)

  const baseSessionQuery = db
    .select({
      session: uploadSession,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      staffName: staff.name,
    })
    .from(uploadSession)
    .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
    .leftJoin(staff, and(eq(uploadSession.createdByStaffId, staff.id), eq(staff.tenantId, tenantId)))
    .where(and(...sessionConditions))
    .orderBy(desc(uploadSession.createdAt))

  const baseCountQuery = db
    .select({ value: sql<number>`count(*)` })
    .from(uploadSession)
    .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
    .leftJoin(staff, and(eq(uploadSession.createdByStaffId, staff.id), eq(staff.tenantId, tenantId)))
    .where(and(...sessionConditions))

  const totalSessions = Number((await baseCountQuery)[0]?.value ?? 0)
  const lastPage = Math.max(1, Math.ceil(totalSessions / REVIEWS_PAGE_SIZE))
  const page = Math.min(filters.page, lastPage)

  const sessionRows = await baseSessionQuery.limit(REVIEWS_PAGE_SIZE).offset((page - 1) * REVIEWS_PAGE_SIZE)

  const sessionIds = sessionRows.map((row) => row.session.id)
  const dependents = await loadSessionDependents(tenantId, sessionIds)

  const reviewSessions = sortReviewSessions(buildReviewSessions({ rows: sessionRows, ...dependents }))
  const clientDisplayNameBySessionId = Object.fromEntries(
    reviewSessions.map((reviewSession) => [reviewSession.id, reviewSession.clientName]),
  )

  const matchedSession = filters.sessionId
    ? reviewSessions.find((reviewSession) => reviewSession.id === filters.sessionId) ?? null
    : null

  let selectedSession = matchedSession
  let sessionNotFound = false

  if (!filters.sessionId) {
    selectedSession = reviewSessions[0] ?? null
  } else if (!matchedSession) {
    // sessionId was requested but isn't in the currently loaded page — resolve it directly
    // instead of silently falling back to reviewSessions[0] (a different client's session).
    selectedSession = await loadReviewSessionById(tenantId, filters.sessionId)
    sessionNotFound = selectedSession === null
  }

  const selectedSessionId = selectedSession?.id ?? null

  if (reviewSessions.length > 0) {
    try {
      const { generateMissingRequestDraft } = await import('@/lib/email/missing-request')
      const { shouldCreatePeriodGapMissingRequestDraft } = await import('@/lib/reviews/period-scope-presentation')

      const periodGapDraftTargets = reviewSessions.filter((session) => (
        session.materialAttributionSummary
        && shouldCreatePeriodGapMissingRequestDraft(session.materialAttributionSummary, session.files.length)
      ))

      const backfillResults = await Promise.allSettled(
        periodGapDraftTargets.map((session) => generateMissingRequestDraft(session.id, tenantId)),
      )

      for (const [index, result] of backfillResults.entries()) {
        if (result.status === 'rejected') {
          console.error(
            '[dashboard/reviews] period-gap missing-request draft backfill failed',
            { sessionId: periodGapDraftTargets[index]?.id, reason: result.reason },
          )
        }
      }
    } catch (err) {
      console.error('[dashboard/reviews] period-gap missing-request draft backfill setup failed', err)
    }
  }

  const refreshHref = buildReviewHref({
    sessionId: selectedSessionId ?? undefined,
    q: filters.q,
    page,
  })

  const shouldLoadLedgerStatuses = !REVIEW_ACCOUNT_CLASSIFICATION_DEACTIVATED_V1 || !REVIEW_JOURNAL_ENTRY_DEACTIVATED_V1
  const ledgerStatusBySessionId = shouldLoadLedgerStatuses
    ? await loadLedgerStatusesBySessionId(tenantId, reviewSessions)
    : new Map<string, { accountClassification: DisplayStatus; journalEntry: DisplayStatus }>()

  const journalEntryPreviewEnabled = !REVIEW_JOURNAL_ENTRY_DEACTIVATED_V1

  const items: ReviewRequestListItem[] = reviewSessions.map((reviewSession) => {
    const sourceLedgerStatus = ledgerStatusBySessionId.get(reviewSession.id) ?? {
      accountClassification: NOT_BOOKKEEPING_STATUS,
      journalEntry: NOT_BOOKKEEPING_STATUS,
    }
    const ledgerStatus = {
      accountClassification: REVIEW_ACCOUNT_CLASSIFICATION_DEACTIVATED_V1
        ? DEACTIVATED_ACCOUNT_CLASSIFICATION_STATUS
        : sourceLedgerStatus.accountClassification,
      journalEntry: REVIEW_JOURNAL_ENTRY_DEACTIVATED_V1
        ? DEACTIVATED_JOURNAL_ENTRY_STATUS
        : sourceLedgerStatus.journalEntry,
    }

    return {
      session: reviewSession,
      href: buildReviewHref({ sessionId: reviewSession.id, q: filters.q, page }),
      displayClientName: reviewSession.clientName,
      staffName: reviewSession.staffName ?? '미지정',
      accountingPeriodLabel: formatAccountingPeriodLabel(reviewSession.accountingPeriod),
      requestMethodLabel: getReviewRequestMethodLabel(reviewSession),
      isSelected: reviewSession.id === selectedSessionId,
      materialStatus: reviewSession.derivedStatus,
      adaptiveStructuring: {
        eligibility: deriveReviewAdaptiveStructuringEligibility(reviewSession),
      },
      periodAttributionStatus: deriveMaterialAttributionDisplayStatus(reviewSession.materialAttributionSummary),
      accountClassificationStatus: ledgerStatus.accountClassification,
      journalEntryStatus: ledgerStatus.journalEntry,
      fileCount: reviewSession.files.length,
      transactionCount: reviewSession.materialAttributionSummary?.total ?? 0,
      accountClassificationDeactivated: REVIEW_ACCOUNT_CLASSIFICATION_DEACTIVATED_V1,
      journalEntryDeactivated: REVIEW_JOURNAL_ENTRY_DEACTIVATED_V1,
    }
  })

  const selectedAttributionRowCount = selectedSession?.materialAttributionSummary?.total ?? 0

  return (
    <ReviewWorkspace
      items={items}
      query={filters.q ?? ''}
      page={page}
      pageSize={REVIEWS_PAGE_SIZE}
      totalSessions={totalSessions}
      selectedSession={selectedSession}
      selectedSessionId={selectedSessionId}
      sessionNotFound={sessionNotFound}
      attributionPromptCard={
        sessionNotFound ? null : (
          <ReviewAttributionSavedPromptCard
            sessionId={selectedSessionId}
            clientName={selectedSession?.clientName ?? null}
            accountingPeriodLabel={selectedSession ? formatAccountingPeriodLabel(selectedSession.accountingPeriod) : null}
            attributionRowCount={selectedAttributionRowCount}
            materialAttributionSummary={selectedSession?.materialAttributionSummary ?? null}
          />
        )
      }
      deferredPreviews={
        sessionNotFound ? null : (
          <Suspense key={`previews-${selectedSessionId ?? 'none'}`} fallback={<ReviewWorkspaceDeferredFallback section="previews" />}>
            <ReviewWorkspaceDeferredPreviews
              tenantId={tenantId}
              selectedSession={selectedSession}
              refreshHref={refreshHref}
              showJournalEntry={journalEntryPreviewEnabled}
            />
          </Suspense>
        )
      }
      deferredApprovalQueue={
        <Suspense
          key={`approval-${selectedSessionId ?? 'none'}`}
          fallback={<ReviewWorkspaceDeferredFallback section="approval" />}
        >
          <ReviewWorkspaceDeferredApprovalQueue
            tenantId={tenantId}
            selectedSessionId={selectedSessionId}
            clientDisplayNameBySessionId={clientDisplayNameBySessionId}
            refreshHref={refreshHref}
          />
        </Suspense>
      }
    />
  )
}
