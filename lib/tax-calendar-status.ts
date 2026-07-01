import { fromISO, type DateTime } from '@/lib/time'

export type TaxCalendarEventRow = {
  id: string
  clientId: string
  clientName: string
  title: string
  requestKind: string
  dueAt: string
  status: string
  uploadSessionId: string | null
}

export type TaxCalendarSessionRow = {
  id: string
  requestEventId: string | null
  status: string
}

export type TaxCalendarEmailRow = {
  id: string
  requestEventId: string | null
  uploadSessionId: string
  type: string
  status: string
  sentAt: string | null
  createdAt: string
}

export type TaxCalendarOverallStatus =
  | 'not_sent'
  | 'upload_waiting'
  | 'uploaded'
  | 'needs_review'
  | 'completed'
  | 'failed'
  | 'overdue'
  | 'closed'

export type TaxCalendarStatusItem = {
  id: string
  dateISO: string
  clientId: string
  clientName: string
  title: string
  requestKindLabel: string
  eventStatus: string
  emailLabel: string
  uploadLabel: string
  overallStatus: TaxCalendarOverallStatus
  nextAction: string
  eventPath: string
  sessionPath: string | null
}

export type TaxCalendarStatusSummary = {
  totalEvents: number
  mailNeedsAction: number
  uploadWaiting: number
  reviewNeeded: number
}

const REQUEST_KIND_LABEL: Record<string, string> = {
  general: '일반 자료',
  payroll: '급여 자료',
}

const EMAIL_STATUS_LABEL: Record<string, string> = {
  draft: '메일 초안',
  sent: '발송 완료',
  failed: '발송 실패',
  rejected: '발송 거부',
}

const EVENT_STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  draft_ready: '초안 준비',
  sent: '발송됨',
  waiting_upload: '업로드 대기',
  submitted: '제출됨',
  analyzing: '검토 중',
  needs_review: '검토 필요',
  completed: '완료',
  expired: '만료',
  cancelled: '취소',
}

const UPLOAD_STATUS_LABEL: Record<string, string> = {
  draft: '세션 초안',
  requested: '업로드 대기',
  active: '업로드 진행',
  submitted: '업로드 완료',
  ai_checking: 'AI 검토 중',
  needs_resubmission: '보충 필요',
  ready_for_accountant: '검토 필요',
  completed: '완료',
  expired: '만료',
  revoked: '취소',
}

function toDateISO(iso: string): string {
  const parsed = fromISO(iso)
  return parsed.isValid ? parsed.toISODate() ?? iso.slice(0, 10) : iso.slice(0, 10)
}

function timestamp(value: string | null): number {
  if (!value) return 0
  const parsed = fromISO(value)
  return parsed.isValid ? parsed.toMillis() : 0
}

function isPastDue(dueAt: string, today: DateTime): boolean {
  const parsed = fromISO(dueAt)
  return parsed.isValid ? parsed < today : false
}

function pickSession(
  event: TaxCalendarEventRow,
  sessionsById: Map<string, TaxCalendarSessionRow>,
  sessionsByEventId: Map<string, TaxCalendarSessionRow>,
): TaxCalendarSessionRow | null {
  if (event.uploadSessionId) {
    const direct = sessionsById.get(event.uploadSessionId)
    if (direct) return direct
  }

  return sessionsByEventId.get(event.id) ?? null
}

function pickPrimaryEmail(emails: TaxCalendarEmailRow[]): TaxCalendarEmailRow | null {
  const sorted = [...emails].sort((a, b) =>
    timestamp(b.sentAt ?? b.createdAt) - timestamp(a.sentAt ?? a.createdAt),
  )
  return sorted.find((email) => email.type === 'upload_request') ?? sorted[0] ?? null
}

function deriveOverallStatus({
  event,
  session,
  email,
  today,
}: {
  event: TaxCalendarEventRow
  session: TaxCalendarSessionRow | null
  email: TaxCalendarEmailRow | null
  today: DateTime
}): TaxCalendarOverallStatus {
  if (event.status === 'cancelled' || event.status === 'expired' || session?.status === 'expired' || session?.status === 'revoked') {
    return 'closed'
  }
  if (email?.status === 'failed' || email?.status === 'rejected') return 'failed'
  if (event.status === 'completed' || session?.status === 'completed') return 'completed'
  if (event.status === 'needs_review' || session?.status === 'needs_resubmission' || session?.status === 'ready_for_accountant') {
    return 'needs_review'
  }
  if (event.status === 'submitted' || event.status === 'analyzing' || session?.status === 'submitted' || session?.status === 'ai_checking') {
    return 'uploaded'
  }
  if (
    event.status === 'sent'
    || event.status === 'waiting_upload'
    || session?.status === 'requested'
    || session?.status === 'active'
    || email?.status === 'sent'
  ) {
    return isPastDue(event.dueAt, today) ? 'overdue' : 'upload_waiting'
  }

  return isPastDue(event.dueAt, today) ? 'overdue' : 'not_sent'
}

function nextActionFor(status: TaxCalendarOverallStatus): string {
  switch (status) {
    case 'not_sent':
      return '메일 화면에서 자료 요청 발송'
    case 'upload_waiting':
      return '업로드 대기 상태 확인'
    case 'uploaded':
      return '자료 검토 화면에서 판정 확인'
    case 'needs_review':
      return '담당자 검토 필요'
    case 'completed':
      return '완료 기록 확인'
    case 'failed':
      return '발송 실패 원인 확인'
    case 'overdue':
      return '지연 상태 확인 또는 리마인더 검토'
    case 'closed':
      return '종료된 요청 기록 확인'
  }
}

export function buildTaxCalendarStatusItems({
  events,
  sessions,
  emails,
  today,
}: {
  events: TaxCalendarEventRow[]
  sessions: TaxCalendarSessionRow[]
  emails: TaxCalendarEmailRow[]
  today: DateTime
}): TaxCalendarStatusItem[] {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]))
  const sessionsByEventId = new Map(
    sessions
      .filter((session) => session.requestEventId)
      .map((session) => [session.requestEventId as string, session]),
  )
  const emailsByEventId = new Map<string, TaxCalendarEmailRow[]>()
  const emailsBySessionId = new Map<string, TaxCalendarEmailRow[]>()

  for (const email of emails) {
    if (email.requestEventId) {
      const list = emailsByEventId.get(email.requestEventId) ?? []
      list.push(email)
      emailsByEventId.set(email.requestEventId, list)
    }

    const sessionList = emailsBySessionId.get(email.uploadSessionId) ?? []
    sessionList.push(email)
    emailsBySessionId.set(email.uploadSessionId, sessionList)
  }

  return events
    .map((event) => {
      const session = pickSession(event, sessionsById, sessionsByEventId)
      const relatedEmails = [
        ...(emailsByEventId.get(event.id) ?? []),
        ...(event.uploadSessionId ? emailsBySessionId.get(event.uploadSessionId) ?? [] : []),
        ...(session ? emailsBySessionId.get(session.id) ?? [] : []),
      ]
      const email = pickPrimaryEmail(relatedEmails)
      const overallStatus = deriveOverallStatus({ event, session, email, today })

      return {
        id: event.id,
        dateISO: toDateISO(event.dueAt),
        clientId: event.clientId,
        clientName: event.clientName,
        title: event.title,
        requestKindLabel: REQUEST_KIND_LABEL[event.requestKind] ?? event.requestKind,
        eventStatus: EVENT_STATUS_LABEL[event.status] ?? event.status,
        emailLabel: email ? EMAIL_STATUS_LABEL[email.status] ?? email.status : '미발송',
        uploadLabel: session ? UPLOAD_STATUS_LABEL[session.status] ?? session.status : '세션 없음',
        overallStatus,
        nextAction: nextActionFor(overallStatus),
        eventPath: `/dashboard/clients/${event.clientId}/events/${event.id}`,
        sessionPath: session ? `/dashboard/sessions/${session.id}` : null,
      }
    })
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.clientName.localeCompare(b.clientName))
}

export function groupTaxCalendarStatusItemsByDate(items: TaxCalendarStatusItem[]): Map<string, TaxCalendarStatusItem[]> {
  const byDate = new Map<string, TaxCalendarStatusItem[]>()
  for (const item of items) {
    const list = byDate.get(item.dateISO) ?? []
    list.push(item)
    byDate.set(item.dateISO, list)
  }
  return byDate
}

export function summarizeTaxCalendarStatusItems(items: TaxCalendarStatusItem[]): TaxCalendarStatusSummary {
  return {
    totalEvents: items.length,
    mailNeedsAction: items.filter((item) => item.overallStatus === 'not_sent' || item.overallStatus === 'failed').length,
    uploadWaiting: items.filter((item) => item.overallStatus === 'upload_waiting').length,
    reviewNeeded: items.filter((item) =>
      item.overallStatus === 'needs_review'
      || item.overallStatus === 'overdue'
      || item.overallStatus === 'failed',
    ).length,
  }
}
