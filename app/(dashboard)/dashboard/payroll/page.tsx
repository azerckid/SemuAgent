import { redirect } from 'next/navigation'
import { and, desc, eq, exists, isNull, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientRequestEvent, staff, uploadSession } from '@/lib/db/schema'
import {
  loadPayrollSummaries,
  loadPayrollSummaryByEventId,
  type PayrollEventRow,
  type PayrollSummary,
} from '@/lib/payroll/load-payroll-summary-by-event-id'
import { fromISO, now } from '@/lib/time'
import {
  formatPayrollExtractionReviewNoticeForDisplay,
} from '@/lib/payroll/extraction-message'
import { derivePayrollExcelStatus, derivePayrollExtractionStatus, derivePayrollMaterialStatus } from '@/lib/payroll/payroll-status'
import { getPayrollAdaptiveStructuringEligibility } from '@/lib/payroll/adaptive-structuring-eligibility'
import { getActiveClientPayrollRuleProfile } from '@/lib/payroll/rule-profile-registry'
import { PayrollWorkspace } from './_components/payroll-workspace'
import { type PayrollRequestListItem } from './_components/payroll-request-list'

const PAYROLL_PAGE_SIZE = 50

const payrollSearchParamsSchema = z.object({
  eventId: z.string().trim().min(1).max(200).optional().catch(undefined),
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
// 문자열에 대해 직접 LIKE 매칭한다. 이 라벨은 isStaffDirect 계산과 동일한 기준이어야
// 검색 결과와 화면에 보이는 "요청 방식" 컬럼이 어긋나지 않는다.
function buildPayrollSearchCondition(query: string | undefined, tenantId: string) {
  if (!query) return undefined

  const pattern = `%${query.toLowerCase()}%`
  return or(
    sql`lower(${client.name}) like ${pattern}`,
    sql`lower(coalesce(${staff.name}, '')) like ${pattern}`,
    sql`lower(${clientRequestEvent.accountingPeriod}) like ${pattern}`,
    exists(
      db
        .select({ value: sql`1` })
        .from(uploadSession)
        .where(and(
          eq(uploadSession.tenantId, tenantId),
          eq(uploadSession.requestKind, 'payroll'),
          or(
            eq(uploadSession.requestEventId, clientRequestEvent.id),
            eq(uploadSession.id, clientRequestEvent.uploadSessionId),
          ),
          or(
            sql`lower(coalesce(${uploadSession.staffDirectLabel}, '')) like ${pattern}`,
            sql`lower(case when ${uploadSession.source} = 'staff_direct' then '직접업로드' else '메일업로드' end) like ${pattern}`,
          ),
        )),
    ),
  )
}

function buildPayrollHref(params: { eventId?: string; q?: string; page?: number }) {
  const searchParams = new URLSearchParams()
  if (params.eventId) searchParams.set('eventId', params.eventId)
  if (params.q) searchParams.set('q', params.q)
  if (params.page && params.page > 1) searchParams.set('page', String(params.page))
  const query = searchParams.toString()
  return query ? `/dashboard/payroll?${query}` : '/dashboard/payroll'
}

const STAFF_DIRECT_INCOMPLETE_UPLOAD_STATUSES = new Set(['draft', 'requested', 'active'])

function getStaffDirectContinueUploadHref(summary: PayrollSummary): string | null {
  const session = summary.session
  if (!session || session.source !== 'staff_direct') return null
  if (summary.sourceFiles.length > 0) return null
  if (!STAFF_DIRECT_INCOMPLETE_UPLOAD_STATUSES.has(session.status)) return null
  return `/dashboard/direct-upload?sessionId=${session.id}`
}

// 추출 상태 팝업의 안내 문구와 "세션 상세" 링크 노출 여부. 이전에는 선택된 요청
// 하나에만 적용했지만, 이제 모든 row가 자기 팝업을 가지므로 row마다 계산한다.
function getPayrollExtractionPopupInfo(summary: PayrollSummary) {
  const reviewNotice = formatPayrollExtractionReviewNoticeForDisplay(summary.batch?.errorMessage)
  const successMessage = !reviewNotice
    && summary.batch?.status === 'completed'
    && summary.passCount > 0
    && summary.failCount === 0
    ? `${summary.passCount}명 추출 완료\n추가 확인이 필요한 항목은 없습니다.`
    : null
  const hasActionableReviewNotice = Boolean(
    reviewNotice
    && summary.batch?.status === 'completed'
    && !reviewNotice.startsWith('추출 불가:'),
  )
  const shouldShowRowEditLink = Boolean(
    summary.session && (summary.failCount > 0 || hasActionableReviewNotice),
  )
  const shouldShowSessionDetailLink = Boolean(
    summary.session && (shouldShowRowEditLink || summary.batch?.status === 'failed' || summary.isBatchStale),
  )

  return {
    reviewNotice,
    successMessage,
    sessionDetailLink: shouldShowSessionDetailLink
      ? { show: true, label: shouldShowRowEditLink ? '세션 상세에서 row 수정' : '세션 상세에서 추출 상태 확인' }
      : null,
  }
}

export default async function PayrollPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const parsedSearchParams = payrollSearchParamsSchema.safeParse({
    eventId: singleSearchParam(resolvedSearchParams.eventId),
    q: singleSearchParam(resolvedSearchParams.q),
    page: singleSearchParam(resolvedSearchParams.page),
  })
  const filters = parsedSearchParams.success
    ? parsedSearchParams.data
    : { eventId: undefined, q: undefined, page: 1 }

  let tenantId: string
  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const eventConditions: SQL[] = [
    eq(clientRequestEvent.tenantId, tenantId),
    eq(clientRequestEvent.requestKind, 'payroll'),
    isNull(clientRequestEvent.deletedAt),
  ]
  const searchCondition = buildPayrollSearchCondition(filters.q, tenantId)
  if (searchCondition) eventConditions.push(searchCondition)

  const baseEventQuery = db
    .select({
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
    })
    .from(clientRequestEvent)
    .innerJoin(client, and(eq(clientRequestEvent.clientId, client.id), eq(client.tenantId, tenantId)))
    .leftJoin(staff, and(eq(client.staffId, staff.id), eq(staff.tenantId, tenantId)))
    .where(and(...eventConditions))
    .orderBy(desc(clientRequestEvent.createdAt))

  const baseCountQuery = db
    .select({ value: sql<number>`count(*)` })
    .from(clientRequestEvent)
    .innerJoin(client, and(eq(clientRequestEvent.clientId, client.id), eq(client.tenantId, tenantId)))
    .leftJoin(staff, and(eq(client.staffId, staff.id), eq(staff.tenantId, tenantId)))
    .where(and(...eventConditions))

  const totalEvents = Number((await baseCountQuery)[0]?.value ?? 0)
  const lastPage = Math.max(1, Math.ceil(totalEvents / PAYROLL_PAGE_SIZE))
  const page = Math.min(filters.page, lastPage)

  const payrollEvents: PayrollEventRow[] = await baseEventQuery
    .limit(PAYROLL_PAGE_SIZE)
    .offset((page - 1) * PAYROLL_PAGE_SIZE)

  const summaries = await loadPayrollSummaries(tenantId, payrollEvents)
  const currentTime = now()

  const matchedSummary = filters.eventId
    ? summaries.find((summary) => summary.event.id === filters.eventId) ?? null
    : null

  let selectedSummary: PayrollSummary | null = matchedSummary
  let summaryNotFound = false

  if (!filters.eventId) {
    selectedSummary = summaries[0] ?? null
  } else if (!matchedSummary) {
    // eventId was requested but isn't in the currently loaded page — resolve it directly
    // instead of silently falling back to summaries[0] (a different client's request).
    selectedSummary = await loadPayrollSummaryByEventId(tenantId, filters.eventId)
    summaryNotFound = selectedSummary === null
  }

  // 적용 기준 배지(Slice 2): 선택된 요청의 고객사/기간 기준 active 급여기준 프로필.
  // 아직 월 급여 계산에 적용하는 단계(Slice 6)는 아니며, 기준 유무만 표시한다.
  let appliedRuleBasis: { clientId: string; label: string | null } | null = null
  if (selectedSummary) {
    const activeProfile = await getActiveClientPayrollRuleProfile({
      tenantId,
      clientId: selectedSummary.event.clientId,
      payrollPeriod: selectedSummary.event.accountingPeriod,
    })
    appliedRuleBasis = {
      clientId: selectedSummary.event.clientId,
      label: activeProfile ? `급여기준 v${activeProfile.version}` : null,
    }
  }

  const requestListItems: PayrollRequestListItem[] = summaries.map((summary) => {
    const isStaffDirect = summary.session?.source === 'staff_direct'
    const dueAt = fromISO(summary.event.dueAt)
    const isOverdue = !isStaffDirect && dueAt.isValid && dueAt < currentTime && summary.status.tone !== 'success'
    const extractionPopupInfo = getPayrollExtractionPopupInfo(summary)

    return {
      eventId: summary.event.id,
      href: buildPayrollHref({ eventId: summary.event.id, q: filters.q, page }),
      displayClientName: summary.displayClientName,
      staffName: summary.event.staffName ?? '-',
      accountingPeriod: summary.event.accountingPeriod,
      requestMethodLabel: isStaffDirect ? '직접업로드' : '메일업로드',
      rowCount: summary.rows.length,
      isSelected: summary.event.id === selectedSummary?.event.id,
      materialStatus: derivePayrollMaterialStatus({
        sessionStatus: summary.session?.status ?? null,
        emailStatus: summary.email?.status ?? null,
        eventStatus: summary.event.status,
        isOverdue,
      }),
      extractionStatus: derivePayrollExtractionStatus({
        failCount: summary.failCount,
        passCount: summary.passCount,
        batch: summary.batch ? { status: summary.batch.status, errorMessage: summary.batch.errorMessage } : null,
        isBatchStale: summary.isBatchStale,
      }),
      excelStatus: derivePayrollExcelStatus({
        generatedDraft: Boolean(summary.generatedDraft),
        failCount: summary.failCount,
        passCount: summary.passCount,
        resultDownloadState: summary.resultDownloadState,
      }),
      materialPopup: {
        files: summary.sourceFiles,
        sessionId: summary.session?.id ?? null,
        continueUploadHref: getStaffDirectContinueUploadHref(summary),
        showCancelButton: summary.session?.source !== 'staff_direct',
      },
      extractionPopup: {
        rows: summary.rows,
        sessionId: summary.session?.id ?? null,
        reviewNotice: extractionPopupInfo.reviewNotice,
        successMessage: extractionPopupInfo.successMessage,
        rerunDisabled: summary.batch?.status === 'running' && !summary.isBatchStale,
        sessionDetailLink: extractionPopupInfo.sessionDetailLink,
        adaptiveStructuring: summary.session
          ? {
            eligibility: getPayrollAdaptiveStructuringEligibility({
              hasFiles: summary.sourceFiles.length > 0,
              hasPasswordBlockedFile: summary.sourceFiles.some(
                (file) => file.passwordStatus === 'required' || file.passwordStatus === 'invalid',
              ),
              batchStatus: summary.batch?.status ?? null,
              batchErrorMessage: summary.batch?.errorMessage ?? null,
              passCount: summary.passCount,
              failCount: summary.failCount,
            }),
            candidateFiles: summary.sourceFiles,
          }
          : null,
      },
      excelPopup: {
        sessionId: summary.session?.id ?? null,
        passCount: summary.passCount,
        failCount: summary.failCount,
        latestDraft: summary.drafts[0] ?? null,
        resultDownloadState: summary.resultDownloadState,
      },
    }
  })

  return (
    <PayrollWorkspace
      items={requestListItems}
      query={filters.q ?? ''}
      page={page}
      pageSize={PAYROLL_PAGE_SIZE}
      totalEvents={totalEvents}
      selectedSummary={selectedSummary}
      summaryNotFound={summaryNotFound}
      appliedRuleBasis={appliedRuleBasis}
    />
  )
}
