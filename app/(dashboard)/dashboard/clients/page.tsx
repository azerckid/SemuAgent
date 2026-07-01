import { and, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import {
  checklistTemplate,
  client,
  clientCcGroup,
  clientChecklist,
  clientRequestEvent,
  outboundEmail,
  payrollExcelDraft,
  payrollExtractionRow,
  requestItemValidation,
  staff,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'
import { getRequestEventCadenceLabel } from '@/lib/request-events/labels'
import { fromISO, now } from '@/lib/time'
import { deriveListSummaryStatus, needsClientListAttention } from './_components/client-list-summary'
import { ClientManager } from './_components/client-manager'
import type {
  ClientRow,
  ClientStatusBadge,
  ClientWorkspaceStatus,
  ClientStatusTone,
} from './_components/client-workspace-types'

const CLIENT_PAGE_SIZE = 50
const CLOSED_EVENT_STATUSES = ['completed', 'expired', 'cancelled'] as const
const PROBLEM_VALIDATION_STATUSES = ['missing', 'non_compliant', 'partially_satisfied', 'uncertain'] as const
const REVIEW_FILE_STATUSES = ['needs_review', 'failed'] as const
const OPEN_SESSION_STATUSES = ['draft', 'requested', 'active', 'submitted', 'ai_checking', 'needs_resubmission', 'ready_for_accountant'] as const
const OPEN_EVENT_STATUSES = ['scheduled', 'draft_ready', 'sent', 'waiting_upload', 'submitted', 'analyzing', 'needs_review'] as const

const clientListSearchParamsSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  status: z.enum(['all', 'mine', 'attention']).catch('all'),
  page: z
    .preprocess((value) => (typeof value === 'string' ? Number(value) : 1), z.number().int().min(1))
    .catch(1),
})

type ClientBaseRow = {
  id: string
  name: string
  contactName: string | null
  email: string
  staffId: string | null
  address: string | null
  phone: string | null
  analysisNotes: string | null
  createdAt: string
}

type EventRow = {
  id: string
  clientId: string
  title: string
  requestKind: string
  frequency: string
  dueAt: string
  status: string
  uploadSessionId: string | null
  createdAt: string
}

type SessionRow = {
  id: string
  clientId: string
  requestKind: string
  status: string
  createdAt: string
  requestEventId: string | null
}

type FileSignalRow = {
  clientId: string
  requestKind: string
  status: string
  uploadedAt: string
}

type ValidationSignalRow = {
  clientId: string
  validationStatus: string
}

type EmailSignalRow = {
  clientId: string
  type: string
  status: string
  createdAt: string
}

type CcGroupRow = {
  clientId: string
  purpose: string
  emails: string
  isDefault: boolean
}

type PayrollRowSignal = {
  clientId: string
  aiVerdict: string | null
  reviewStatus: string
}

type PayrollDraftSignal = {
  clientId: string
  status: string
}

function singleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function buildClientSearchCondition(query: string | undefined) {
  if (!query) return undefined

  const pattern = `%${query.toLowerCase()}%`
  return or(
    sql`lower(${client.name}) like ${pattern}`,
    sql`lower(coalesce(${client.contactName}, '')) like ${pattern}`,
    sql`lower(${client.email}) like ${pattern}`,
    sql`lower(coalesce(${client.phone}, '')) like ${pattern}`,
    sql`lower(coalesce(${client.address}, '')) like ${pattern}`,
  )
}

function formatRangeStart(total: number, page: number, pageSize: number) {
  if (total === 0) return 0
  return (page - 1) * pageSize + 1
}

function firstByClientId<T extends { clientId: string }>(rows: T[]) {
  const map = new Map<string, T>()

  for (const row of rows) {
    if (!map.has(row.clientId)) {
      map.set(row.clientId, row)
    }
  }

  return map
}

function groupByClientId<T extends { clientId: string }>(rows: T[]) {
  const map = new Map<string, T[]>()

  for (const row of rows) {
    const existing = map.get(row.clientId) ?? []
    existing.push(row)
    map.set(row.clientId, existing)
  }

  return map
}

function formatDate(value: string) {
  const parsed = fromISO(value)
  return parsed.isValid ? parsed.toFormat('M/d') : value.slice(5, 10).replace('-', '/')
}

function isPastDue(event: EventRow, currentTime = now()) {
  if (CLOSED_EVENT_STATUSES.includes(event.status as typeof CLOSED_EVENT_STATUSES[number])) return false

  const dueAt = fromISO(event.dueAt)
  return dueAt.isValid && dueAt < currentTime
}

function statusBadge(label: string, detail: string, tone: ClientStatusTone): ClientStatusBadge {
  return { label, detail, tone }
}

function deriveStaffStatus({
  clientRow,
  staffName,
  currentStaffId,
}: {
  clientRow: ClientBaseRow
  staffName: string | null
  currentStaffId: string | null
}): ClientStatusBadge {
  if (!clientRow.staffId) return statusBadge('미배정', '담당자를 지정해 주세요.', 'warning')
  if (currentStaffId && clientRow.staffId === currentStaffId) return statusBadge('내 담당', staffName ?? '배정됨', 'success')
  return statusBadge('배정됨', staffName ?? '담당자 확인 필요', staffName ? 'success' : 'warning')
}

function deriveLatestRequestStatus(event: EventRow | undefined): ClientStatusBadge {
  if (!event) return statusBadge('요청 없음', '최근 요청 이벤트가 없습니다.', 'secondary')

  const kind = event.requestKind === 'payroll' ? '급여' : '자료'
  const cadence = getRequestEventCadenceLabel(event)
  const detail = `${kind} · ${cadence} · 기한 ${formatDate(event.dueAt)}`

  if (isPastDue(event)) return statusBadge('지연', `${event.title} · ${detail}`, 'destructive')

  switch (event.status) {
    case 'scheduled':
      return statusBadge('예정', `${event.title} · ${detail}`, 'info')
    case 'draft_ready':
      return statusBadge('초안', `${event.title} · 발송 전 확인`, 'info')
    case 'sent':
    case 'waiting_upload':
      return statusBadge('업로드 대기', `${event.title} · ${detail}`, 'warning')
    case 'submitted':
    case 'analyzing':
      return statusBadge('제출 확인', `${event.title} · ${detail}`, 'info')
    case 'needs_review':
      return statusBadge('검토필요', `${event.title} · ${detail}`, 'warning')
    case 'completed':
      return statusBadge('완료', `${event.title} · ${detail}`, 'success')
    case 'expired':
      return statusBadge('만료', `${event.title} · ${detail}`, 'destructive')
    case 'cancelled':
      return statusBadge('취소', `${event.title} · ${detail}`, 'secondary')
    default:
      return statusBadge(event.status, `${event.title} · ${detail}`, 'secondary')
  }
}

function deriveUploadStatus({
  latestEvent,
  latestSession,
  latestFile,
}: {
  latestEvent?: EventRow
  latestSession?: SessionRow
  latestFile?: FileSignalRow
}): ClientStatusBadge {
  if (latestFile) {
    if (latestFile.status === 'failed') {
      return statusBadge('실패', `${formatDate(latestFile.uploadedAt)} 업로드 · 파일 확인 필요`, 'destructive')
    }
    if (latestFile.status === 'needs_review' || latestFile.status === 'rejected') {
      return statusBadge('일부 제출', `${formatDate(latestFile.uploadedAt)} 업로드 · 보완 후보`, 'warning')
    }
    if (latestFile.status === 'analyzing') {
      return statusBadge('분석 중', `${formatDate(latestFile.uploadedAt)} 업로드`, 'info')
    }
    return statusBadge('제출 완료', `${formatDate(latestFile.uploadedAt)} 업로드`, 'success')
  }

  if (latestSession) {
    switch (latestSession.status) {
      case 'needs_resubmission':
        return statusBadge('일부 제출', '세션에 보완 요청 상태가 있습니다.', 'warning')
      case 'ai_checking':
        return statusBadge('분석 중', 'AI 판단이 진행 중입니다.', 'info')
      case 'submitted':
      case 'ready_for_accountant':
      case 'completed':
        return statusBadge('제출 완료', '업로드 세션 제출이 확인됐습니다.', 'success')
      case 'requested':
      case 'active':
        return statusBadge('대기', '업로드 링크가 열려 있습니다.', 'warning')
      case 'expired':
        return statusBadge('지연', '업로드 세션이 만료됐습니다.', 'destructive')
      case 'revoked':
        return statusBadge('취소', '업로드 세션이 취소됐습니다.', 'secondary')
      default:
        return statusBadge('대기', '업로드 상태 확인이 필요합니다.', 'warning')
    }
  }

  if (latestEvent && isPastDue(latestEvent)) {
    return statusBadge('지연', '요청 기한이 지났지만 제출 기록이 없습니다.', 'destructive')
  }

  if (latestEvent && OPEN_EVENT_STATUSES.includes(latestEvent.status as typeof OPEN_EVENT_STATUSES[number])) {
    return statusBadge('대기', '최근 요청에 대한 업로드를 기다립니다.', 'warning')
  }

  return statusBadge('이력 없음', '최근 업로드가 없습니다.', 'secondary')
}

function deriveReviewStatus({
  latestEvent,
  latestSession,
  validations,
  emails,
  files,
}: {
  latestEvent?: EventRow
  latestSession?: SessionRow
  validations: ValidationSignalRow[]
  emails: EmailSignalRow[]
  files: FileSignalRow[]
}): ClientStatusBadge {
  if (emails.some((email) => email.status === 'failed')) {
    return statusBadge('발송 실패', '메일 화면에서 실패 사유를 확인하세요.', 'destructive')
  }

  if (emails.some((email) => email.type === 'missing_request' && email.status === 'draft')) {
    return statusBadge('승인 대기', '보충 요청 초안이 담당자 승인을 기다립니다.', 'warning')
  }

  if (validations.length > 0) {
    return statusBadge('검토필요', `${validations.length}개 요청자료 항목 확인 필요`, 'warning')
  }

  if (files.some((file) => REVIEW_FILE_STATUSES.includes(file.status as typeof REVIEW_FILE_STATUSES[number]))) {
    return statusBadge('검토필요', '판독 불가 또는 파일 검토가 필요합니다.', 'warning')
  }

  if (latestEvent?.status === 'needs_review' || latestSession?.status === 'needs_resubmission') {
    return statusBadge('검토필요', '요청 또는 세션 상태가 검토 필요입니다.', 'warning')
  }

  return statusBadge('완료', '검토 대기 신호가 없습니다.', 'success')
}

function derivePayrollStatus({
  payrollEvent,
  payrollSession,
  payrollRows,
  payrollDrafts,
}: {
  payrollEvent?: EventRow
  payrollSession?: SessionRow
  payrollRows: PayrollRowSignal[]
  payrollDrafts: PayrollDraftSignal[]
}): ClientStatusBadge {
  if (payrollDrafts.some((draft) => draft.status === 'generated')) {
    return statusBadge('엑셀 가능', '급여정산 화면에서 결과 엑셀을 확인하세요.', 'info')
  }

  if (payrollRows.some((row) => row.aiVerdict === 'fail' || row.reviewStatus === 'needs_review')) {
    return statusBadge('검토필요', '급여 row 보완 또는 확인이 필요합니다.', 'warning')
  }

  if (payrollEvent?.status === 'completed' || payrollSession?.status === 'completed') {
    return statusBadge('완료', '최근 급여 요청이 완료됐습니다.', 'success')
  }

  if (
    (payrollEvent && OPEN_EVENT_STATUSES.includes(payrollEvent.status as typeof OPEN_EVENT_STATUSES[number])) ||
    (payrollSession && OPEN_SESSION_STATUSES.includes(payrollSession.status as typeof OPEN_SESSION_STATUSES[number]))
  ) {
    return statusBadge('진행 중', '급여정산 workspace에서 진행 상태를 확인하세요.', 'info')
  }

  return statusBadge('비대상', '최근 급여 요청 흐름이 없습니다.', 'secondary')
}

function hasEmails(group: CcGroupRow) {
  return group.emails.split(',').some((email) => email.trim().length > 0)
}

function deriveCcStatus(groups: CcGroupRow[], hasPayrollContext: boolean): ClientStatusBadge {
  const usableGroups = groups.filter(hasEmails)
  const hasGeneral = usableGroups.some((group) => group.purpose === 'general' || group.purpose === 'all')
  const hasPayroll = usableGroups.some((group) => group.purpose === 'payroll' || group.purpose === 'all')
  const hasDefault = usableGroups.some((group) => group.isDefault)

  if (usableGroups.length === 0) return statusBadge('미설정', '요청 메일 참조 그룹을 추가해 주세요.', 'destructive')
  if (!hasGeneral) return statusBadge('일반 없음', '일반 자료 요청용 참조 그룹이 없습니다.', 'warning')
  if (hasPayrollContext && !hasPayroll) return statusBadge('급여 없음', '급여 요청용 참조 그룹이 없습니다.', 'warning')
  if (!hasDefault) return statusBadge('기본 없음', '기본 참조 그룹을 지정해 주세요.', 'warning')
  return statusBadge('완료', hasPayrollContext ? '일반/급여 참조 그룹 준비 완료' : '일반 참조 그룹 준비 완료', 'success')
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tenantId, user } = await requireTenantSession()
  const rawSearchParams = await searchParams
  const parsedSearchParams = clientListSearchParamsSchema.safeParse({
    q: singleSearchParam(rawSearchParams.q),
    status: singleSearchParam(rawSearchParams.status),
    page: singleSearchParam(rawSearchParams.page),
  })
  const filters = parsedSearchParams.success
    ? parsedSearchParams.data
    : { q: undefined, status: 'all' as const, page: 1 }

  const [staffList, templates] = await Promise.all([
    db
      .select({ id: staff.id, name: staff.name, role: staff.role, userId: staff.userId })
      .from(staff)
      .where(eq(staff.tenantId, tenantId)),

    db
      .select({ id: checklistTemplate.id, name: checklistTemplate.name })
      .from(checklistTemplate)
      .where(eq(checklistTemplate.tenantId, tenantId)),
  ])

  const currentStaffId = staffList.find((row) => row.userId === user.id)?.id ?? null
  const clientConditions: SQL[] = [eq(client.tenantId, tenantId)]
  const searchCondition = buildClientSearchCondition(filters.q)
  if (searchCondition) clientConditions.push(searchCondition)
  if (filters.status === 'mine') {
    clientConditions.push(currentStaffId ? eq(client.staffId, currentStaffId) : sql`0 = 1`)
  }

  const baseClientQuery = db
    .select({
      id: client.id,
      name: client.name,
      contactName: client.contactName,
      email: client.email,
      staffId: client.staffId,
      address: client.address,
      phone: client.phone,
      analysisNotes: client.analysisNotes,
      createdAt: client.createdAt,
    })
    .from(client)
    .where(and(...clientConditions))
    .orderBy(desc(client.createdAt))

  const baseCountQuery = db
    .select({ value: sql<number>`count(*)` })
    .from(client)
    .where(and(...clientConditions))

  const shouldFilterAttentionInMemory = filters.status === 'attention'
  const baseTotal = shouldFilterAttentionInMemory
    ? 0
    : Number((await baseCountQuery)[0]?.value ?? 0)
  const nonAttentionLastPage = Math.max(1, Math.ceil(baseTotal / CLIENT_PAGE_SIZE))
  const nonAttentionPage = Math.min(filters.page, nonAttentionLastPage)
  const clients = shouldFilterAttentionInMemory
    ? await baseClientQuery
    : await baseClientQuery
      .limit(CLIENT_PAGE_SIZE)
      .offset((nonAttentionPage - 1) * CLIENT_PAGE_SIZE)

  const clientIds = clients.map((clientRow) => clientRow.id)

  const [
    assignments,
    requestEvents,
    sessions,
    files,
    validations,
    emailSignals,
    ccGroups,
    payrollRows,
    payrollDrafts,
  ] = await Promise.all([
    clientIds.length > 0
      ? db
        .select({ clientId: clientChecklist.clientId, templateId: clientChecklist.templateId })
        .from(clientChecklist)
        .where(and(eq(clientChecklist.tenantId, tenantId), inArray(clientChecklist.clientId, clientIds)))
      : [],

    clientIds.length > 0
      ? db
        .select({
          id: clientRequestEvent.id,
          clientId: clientRequestEvent.clientId,
          title: clientRequestEvent.title,
          requestKind: clientRequestEvent.requestKind,
          frequency: clientRequestEvent.frequency,
          dueAt: clientRequestEvent.dueAt,
          status: clientRequestEvent.status,
          uploadSessionId: clientRequestEvent.uploadSessionId,
          createdAt: clientRequestEvent.createdAt,
        })
        .from(clientRequestEvent)
        .innerJoin(client, and(eq(clientRequestEvent.clientId, client.id), eq(client.tenantId, tenantId)))
        .where(and(
          eq(clientRequestEvent.tenantId, tenantId),
          inArray(clientRequestEvent.clientId, clientIds),
          isNull(clientRequestEvent.deletedAt),
        ))
        .orderBy(desc(clientRequestEvent.createdAt))
      : [],

    clientIds.length > 0
      ? db
        .select({
          id: uploadSession.id,
          clientId: uploadSession.clientId,
          requestKind: uploadSession.requestKind,
          status: uploadSession.status,
          createdAt: uploadSession.createdAt,
          requestEventId: uploadSession.requestEventId,
        })
        .from(uploadSession)
        .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
        .where(and(eq(uploadSession.tenantId, tenantId), inArray(uploadSession.clientId, clientIds), isNull(uploadSession.deletedAt)))
        .orderBy(desc(uploadSession.createdAt))
      : [],

    clientIds.length > 0
      ? db
        .select({
          clientId: uploadSession.clientId,
          requestKind: uploadSession.requestKind,
          status: uploadFile.status,
          uploadedAt: uploadFile.uploadedAt,
        })
        .from(uploadFile)
        .innerJoin(uploadSession, and(eq(uploadFile.uploadSessionId, uploadSession.id), eq(uploadSession.tenantId, tenantId)))
        .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
        .where(and(eq(uploadFile.tenantId, tenantId), inArray(uploadSession.clientId, clientIds), isNull(uploadSession.deletedAt)))
        .orderBy(desc(uploadFile.uploadedAt))
      : [],

    clientIds.length > 0
      ? db
        .select({
          clientId: uploadSession.clientId,
          validationStatus: requestItemValidation.validationStatus,
        })
        .from(requestItemValidation)
        .innerJoin(uploadSession, and(eq(requestItemValidation.uploadSessionId, uploadSession.id), eq(uploadSession.tenantId, tenantId)))
        .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
        .where(
          and(
            eq(requestItemValidation.tenantId, tenantId),
            inArray(uploadSession.clientId, clientIds),
            isNull(uploadSession.deletedAt),
            inArray(requestItemValidation.validationStatus, PROBLEM_VALIDATION_STATUSES),
          ),
        )
      : [],

    clientIds.length > 0
      ? db
        .select({
          clientId: uploadSession.clientId,
          type: outboundEmail.type,
          status: outboundEmail.status,
          createdAt: outboundEmail.createdAt,
        })
        .from(outboundEmail)
        .innerJoin(uploadSession, and(eq(outboundEmail.uploadSessionId, uploadSession.id), eq(uploadSession.tenantId, tenantId)))
        .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
        .where(
          and(
            eq(outboundEmail.tenantId, tenantId),
            inArray(uploadSession.clientId, clientIds),
            isNull(uploadSession.deletedAt),
            or(
              eq(outboundEmail.status, 'failed'),
              and(eq(outboundEmail.type, 'missing_request'), eq(outboundEmail.status, 'draft')),
            ),
          ),
        )
        .orderBy(desc(outboundEmail.createdAt))
      : [],

    clientIds.length > 0
      ? db
        .select({
          clientId: clientCcGroup.clientId,
          purpose: clientCcGroup.purpose,
          emails: clientCcGroup.emails,
          isDefault: clientCcGroup.isDefault,
        })
        .from(clientCcGroup)
        .innerJoin(client, and(eq(clientCcGroup.clientId, client.id), eq(client.tenantId, tenantId)))
        .where(and(eq(clientCcGroup.tenantId, tenantId), inArray(clientCcGroup.clientId, clientIds)))
      : [],

    clientIds.length > 0
      ? db
        .select({
          clientId: uploadSession.clientId,
          aiVerdict: payrollExtractionRow.aiVerdict,
          reviewStatus: payrollExtractionRow.reviewStatus,
        })
        .from(payrollExtractionRow)
        .innerJoin(uploadSession, and(eq(payrollExtractionRow.uploadSessionId, uploadSession.id), eq(uploadSession.tenantId, tenantId)))
        .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
        .where(and(eq(payrollExtractionRow.tenantId, tenantId), inArray(uploadSession.clientId, clientIds), isNull(uploadSession.deletedAt)))
      : [],

    clientIds.length > 0
      ? db
        .select({
          clientId: uploadSession.clientId,
          status: payrollExcelDraft.status,
        })
        .from(payrollExcelDraft)
        .innerJoin(uploadSession, and(eq(payrollExcelDraft.uploadSessionId, uploadSession.id), eq(uploadSession.tenantId, tenantId)))
        .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
        .where(and(eq(payrollExcelDraft.tenantId, tenantId), inArray(uploadSession.clientId, clientIds), isNull(uploadSession.deletedAt)))
      : [],
  ])

  const assignMap = Object.fromEntries(assignments.map((a) => [a.clientId, a.templateId]))
  const staffNameById = new Map(staffList.map((row) => [row.id, row.name]))
  const latestEventByClient = firstByClientId<EventRow>(requestEvents)
  const latestSessionByClient = firstByClientId<SessionRow>(sessions)
  const latestFileByClient = firstByClientId<FileSignalRow>(files)
  const validationsByClient = groupByClientId<ValidationSignalRow>(validations)
  const emailsByClient = groupByClientId<EmailSignalRow>(emailSignals)
  const filesByClient = groupByClientId<FileSignalRow>(files)
  const ccByClient = groupByClientId<CcGroupRow>(ccGroups)
  const payrollEventsByClient = firstByClientId<EventRow>(requestEvents.filter((event) => event.requestKind === 'payroll'))
  const payrollSessionsByClient = firstByClientId<SessionRow>(sessions.filter((session) => session.requestKind === 'payroll'))
  const payrollRowsByClient = groupByClientId<PayrollRowSignal>(payrollRows)
  const payrollDraftsByClient = groupByClientId<PayrollDraftSignal>(payrollDrafts)

  const clientRowsForLoadedClients: ClientRow[] = clients.map((clientRow) => {
    const latestEvent = latestEventByClient.get(clientRow.id)
    const latestSession = latestSessionByClient.get(clientRow.id)
    const latestFile = latestFileByClient.get(clientRow.id)
    const payrollEvent = payrollEventsByClient.get(clientRow.id)
    const payrollSession = payrollSessionsByClient.get(clientRow.id)
    const payrollStatus = derivePayrollStatus({
      payrollEvent,
      payrollSession,
      payrollRows: payrollRowsByClient.get(clientRow.id) ?? [],
      payrollDrafts: payrollDraftsByClient.get(clientRow.id) ?? [],
    })
    const staffName = clientRow.staffId ? staffNameById.get(clientRow.staffId) ?? null : null
    const domainStatus = {
      staff: deriveStaffStatus({
        clientRow,
        staffName,
        currentStaffId,
      }),
      latestRequest: deriveLatestRequestStatus(latestEvent),
      upload: deriveUploadStatus({ latestEvent, latestSession, latestFile }),
      review: deriveReviewStatus({
        latestEvent,
        latestSession,
        validations: validationsByClient.get(clientRow.id) ?? [],
        emails: emailsByClient.get(clientRow.id) ?? [],
        files: filesByClient.get(clientRow.id) ?? [],
      }),
      payroll: payrollStatus,
      cc: deriveCcStatus(ccByClient.get(clientRow.id) ?? [], payrollStatus.label !== '비대상'),
    }
    const status: ClientWorkspaceStatus = {
      ...domainStatus,
      summary: deriveListSummaryStatus(domainStatus),
      isAssignedToCurrentStaff: Boolean(currentStaffId && clientRow.staffId === currentStaffId),
      needsAttention: needsClientListAttention(domainStatus),
    }

    return {
      ...clientRow,
      staffName,
      templateId: assignMap[clientRow.id] ?? null,
      status,
    }
  })
  const attentionFilteredRows = shouldFilterAttentionInMemory
    ? clientRowsForLoadedClients.filter((clientRow) => clientRow.status.needsAttention)
    : clientRowsForLoadedClients
  const totalClients = shouldFilterAttentionInMemory ? attentionFilteredRows.length : baseTotal
  const lastPage = Math.max(1, Math.ceil(totalClients / CLIENT_PAGE_SIZE))
  const page = shouldFilterAttentionInMemory ? Math.min(filters.page, lastPage) : nonAttentionPage
  const rangeStart = formatRangeStart(totalClients, page, CLIENT_PAGE_SIZE)
  const clientRows = shouldFilterAttentionInMemory
    ? attentionFilteredRows.slice((page - 1) * CLIENT_PAGE_SIZE, page * CLIENT_PAGE_SIZE)
    : clientRowsForLoadedClients

  return (
    <ClientManager
      initialClients={clientRows}
      staffList={staffList}
      templates={templates}
      currentStaffId={currentStaffId}
      query={filters.q ?? ''}
      statusFilter={filters.status}
      page={page}
      pageSize={CLIENT_PAGE_SIZE}
      totalClients={totalClients}
      rangeStart={rangeStart}
    />
  )
}
