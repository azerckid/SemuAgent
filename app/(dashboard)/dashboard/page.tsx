import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, notInArray } from 'drizzle-orm'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock,
  FileSpreadsheet,
  Mail,
  UploadCloud,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import {
  client,
  clientRequestEvent,
  outboundEmail,
  payrollExtractionBatch,
  payrollExtractionRow,
  staff,
  uploadFile,
  uploadSession,
} from '@/lib/db/schema'
import { fromISO, now, type DateTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { NoTenantRefresh } from './_components/no-tenant-refresh'

type EventRow = {
  id: string
  clientId: string
  clientName: string
  staffName: string | null
  title: string
  requestKind: 'general' | 'payroll'
  dueAt: string
  status: string
  uploadSessionId: string | null
  createdAt: string
}

type MetricCard = {
  label: string
  value: number
  description: string
  href: string
  icon: LucideIcon
  tone: 'default' | 'info' | 'success' | 'warning' | 'destructive'
}

type CountRow = {
  value: number
}

const CLOSED_EVENT_STATUS_VALUES: Array<'completed' | 'cancelled' | 'expired'> = ['completed', 'cancelled', 'expired']
const CLOSED_EVENT_STATUSES = new Set<string>(CLOSED_EVENT_STATUS_VALUES)
const CLOSED_PAYROLL_SESSION_STATUS_VALUES: Array<'completed' | 'expired' | 'revoked'> = ['completed', 'expired', 'revoked']

const EVENT_STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  draft_ready: '초안 준비',
  sent: '요청 발송',
  waiting_upload: '업로드 대기',
  submitted: '제출 완료',
  analyzing: '분석 중',
  needs_review: '검토 필요',
  completed: '완료',
  expired: '만료',
  cancelled: '취소',
}

const EMAIL_TYPE_LABEL: Record<string, string> = {
  upload_request: '자료 요청',
  missing_request: '보충 요청',
  completion_thanks: '완료 안내',
  reminder: '리마인더',
  staff_notification: '담당자 알림',
  transaction_purpose_request: '거래 용도 확인',
}

function isOpenEvent(event: EventRow) {
  return !CLOSED_EVENT_STATUSES.has(event.status)
}

function countValue(rows: CountRow[]) {
  return rows[0]?.value ?? 0
}

function requiredISODate(value: DateTime, label: string) {
  const iso = value.toISODate()
  if (!iso) {
    throw new Error(`Failed to build dashboard date boundary: ${label}`)
  }
  return iso
}

function requiredISODateTime(value: DateTime, label: string) {
  const iso = value.toISO()
  if (!iso) {
    throw new Error(`Failed to build dashboard datetime boundary: ${label}`)
  }
  return iso
}

function parseDateTime(value: string) {
  const parsed = fromISO(value)
  return parsed.isValid ? parsed : null
}

function formatDate(value: string) {
  const parsed = parseDateTime(value)
  return parsed ? parsed.toFormat('MM.dd') : value
}

function formatRelative(value: string, base: DateTime) {
  const parsed = parseDateTime(value)
  if (!parsed) return value

  const diffMinutes = Math.round(base.diff(parsed, 'minutes').minutes)
  if (diffMinutes < 1) return '방금'
  if (diffMinutes < 60) return `${diffMinutes}분 전`

  const diffHours = Math.round(base.diff(parsed, 'hours').hours)
  if (diffHours < 24) return `${diffHours}시간 전`

  const diffDays = Math.round(base.startOf('day').diff(parsed.startOf('day'), 'days').days)
  if (diffDays < 7) return `${diffDays}일 전`

  return parsed.toFormat('MM.dd')
}

function toneClasses(tone: MetricCard['tone']) {
  return {
    default: 'border-border bg-muted/40 text-muted-foreground',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    destructive: 'border-red-200 bg-red-50 text-red-700',
  }[tone]
}

function dueLabel(event: EventRow, currentTime: DateTime) {
  const dueAt = parseDateTime(event.dueAt)
  if (!dueAt) return formatDate(event.dueAt)
  if (dueAt.hasSame(currentTime, 'day')) return '오늘'
  if (dueAt < currentTime) return `${Math.max(1, Math.ceil(currentTime.diff(dueAt, 'days').days))}일 지연`
  return dueAt.toFormat('MM.dd')
}

function EmptyState({ title, description, href, action }: { title: string; description: string; href: string; action: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{description}</p>
      <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
        {action}
        <ArrowRight className="size-3" />
      </Link>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const tenantId = session.session.activeOrganizationId
  if (!tenantId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-blue-50">
            <svg className="size-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="mb-2 text-lg font-semibold text-gray-900">소속 회계법인이 없습니다</h1>

          <div className="mb-3 rounded-lg bg-gray-50 p-4 text-left">
            <p className="mb-1 text-xs font-medium text-gray-700">처음 JARYO를 도입하시나요?</p>
            <p className="mb-3 text-xs text-gray-500">
              회계법인을 등록하면 관리자로 설정됩니다.<br />
              이후 설정에서 직원을 추가할 수 있습니다.
            </p>
            <Link
              href="/onboarding"
              className="block w-full rounded-lg bg-blue-600 py-2 text-center text-xs font-medium text-white hover:bg-blue-700"
            >
              새 회계법인 만들기
            </Link>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 text-left">
            <p className="mb-1 text-xs font-medium text-gray-700">이미 소속 법인이 있으신가요?</p>
            <p className="mb-2 text-xs text-gray-500">
              아래 이메일을 관리자에게 알려주고<br />
              담당자로 추가해 달라고 요청하세요.
            </p>
            <p className="mb-3 break-all rounded bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-600">
              {session.user.email}
            </p>
            <p className="mb-3 text-xs text-gray-400">
              추가 완료 후 아래 버튼을 눌러 새로고침하세요.
            </p>
            <NoTenantRefresh />
          </div>
        </div>
      </div>
    )
  }

  const currentTime = now()
  const todayStart = currentTime.startOf('day')
  const todayStartISO = requiredISODate(todayStart, 'todayStart')
  const tomorrowStartISO = requiredISODate(todayStart.plus({ days: 1 }), 'tomorrowStart')
  const recentUploadStartISO = requiredISODateTime(currentTime.minus({ days: 7 }), 'recentUploadStart')

  // activePayrollSessions와 8개 주요 쿼리를 병렬로 실행한다.
  // payrollBatches는 activePayrollSessionIds에 의존하므로 이후에 순차 실행한다.
  const [
    activePayrollSessions,
    eventRows,
    emailRows,
    clientCountRows,
    todayEventCountRows,
    overdueEventCountRows,
    failedEmailCountRows,
    reviewDraftCountRows,
    uploadCountRows,
  ] = await Promise.all([
    db
      .select({ id: uploadSession.id })
      .from(uploadSession)
      .where(
        and(
          eq(uploadSession.tenantId, tenantId),
          eq(uploadSession.requestKind, 'payroll'),
          isNull(uploadSession.deletedAt),
          notInArray(uploadSession.status, CLOSED_PAYROLL_SESSION_STATUS_VALUES),
        ),
      ),
    db
      .select({
        id: clientRequestEvent.id,
        clientId: clientRequestEvent.clientId,
        clientName: client.name,
        staffName: staff.name,
        title: clientRequestEvent.title,
        requestKind: clientRequestEvent.requestKind,
        dueAt: clientRequestEvent.dueAt,
        status: clientRequestEvent.status,
        uploadSessionId: clientRequestEvent.uploadSessionId,
        createdAt: clientRequestEvent.createdAt,
      })
      .from(clientRequestEvent)
      .innerJoin(client, and(eq(clientRequestEvent.clientId, client.id), eq(client.tenantId, tenantId)))
      .leftJoin(staff, and(eq(client.staffId, staff.id), eq(staff.tenantId, tenantId)))
      .where(and(eq(clientRequestEvent.tenantId, tenantId), isNull(clientRequestEvent.deletedAt)))
      .orderBy(asc(clientRequestEvent.dueAt), desc(clientRequestEvent.createdAt))
      .limit(200),
    db
      .select({
        id: outboundEmail.id,
        type: outboundEmail.type,
        status: outboundEmail.status,
        subject: outboundEmail.subject,
        requestEventId: outboundEmail.requestEventId,
        uploadSessionId: outboundEmail.uploadSessionId,
        sentAt: outboundEmail.sentAt,
        createdAt: outboundEmail.createdAt,
      })
      .from(outboundEmail)
      .where(eq(outboundEmail.tenantId, tenantId))
      .orderBy(desc(outboundEmail.createdAt))
      .limit(200),
    db
      .select({ value: count() })
      .from(client)
      .where(eq(client.tenantId, tenantId)),
    db
      .select({ value: count() })
      .from(clientRequestEvent)
      .innerJoin(client, and(eq(clientRequestEvent.clientId, client.id), eq(client.tenantId, tenantId)))
      .where(
        and(
          eq(clientRequestEvent.tenantId, tenantId),
          isNull(clientRequestEvent.deletedAt),
          notInArray(clientRequestEvent.status, CLOSED_EVENT_STATUS_VALUES),
          gte(clientRequestEvent.dueAt, todayStartISO),
          lt(clientRequestEvent.dueAt, tomorrowStartISO),
        ),
      ),
    db
      .select({ value: count() })
      .from(clientRequestEvent)
      .innerJoin(client, and(eq(clientRequestEvent.clientId, client.id), eq(client.tenantId, tenantId)))
      .where(
        and(
          eq(clientRequestEvent.tenantId, tenantId),
          isNull(clientRequestEvent.deletedAt),
          notInArray(clientRequestEvent.status, CLOSED_EVENT_STATUS_VALUES),
          lt(clientRequestEvent.dueAt, todayStartISO),
        ),
      ),
    db
      .select({ value: count() })
      .from(outboundEmail)
      .where(and(eq(outboundEmail.tenantId, tenantId), eq(outboundEmail.status, 'failed'))),
    db
      .select({ value: count() })
      .from(outboundEmail)
      .where(and(eq(outboundEmail.tenantId, tenantId), eq(outboundEmail.type, 'missing_request'), eq(outboundEmail.status, 'draft'))),
    db
      .select({ value: count() })
      .from(uploadFile)
      .innerJoin(uploadSession, and(eq(uploadFile.uploadSessionId, uploadSession.id), eq(uploadSession.tenantId, tenantId)))
      .where(
        and(
          eq(uploadFile.tenantId, tenantId),
          eq(uploadSession.source, 'customer_upload'),
          gte(uploadFile.uploadedAt, recentUploadStartISO),
          isNull(uploadSession.deletedAt),
        ),
      ),
  ])

  const activePayrollSessionIds = activePayrollSessions.map((s) => s.id)
  const payrollBatches = activePayrollSessionIds.length > 0
    ? await db
      .select({
        id: payrollExtractionBatch.id,
        uploadSessionId: payrollExtractionBatch.uploadSessionId,
      })
      .from(payrollExtractionBatch)
      .where(
        and(
          eq(payrollExtractionBatch.tenantId, tenantId),
          inArray(payrollExtractionBatch.uploadSessionId, activePayrollSessionIds),
        ),
      )
      .orderBy(desc(payrollExtractionBatch.createdAt))
    : []
  const latestPayrollBatchIds = Array.from(
    payrollBatches.reduce((map, batch) => {
      if (!map.has(batch.uploadSessionId)) {
        map.set(batch.uploadSessionId, batch.id)
      }
      return map
    }, new Map<string, string>()).values(),
  )

  const payrollFailureWhere = latestPayrollBatchIds.length > 0
    ? and(
        eq(payrollExtractionRow.tenantId, tenantId),
        eq(payrollExtractionRow.aiVerdict, 'fail'),
        inArray(payrollExtractionRow.batchId, latestPayrollBatchIds),
        isNull(uploadSession.deletedAt),
        notInArray(uploadSession.status, CLOSED_PAYROLL_SESSION_STATUS_VALUES),
      )
    : undefined

  const [payrollFailureRows, payrollFailureCountRows] = payrollFailureWhere
    ? await Promise.all([
      db
        .select({
          id: payrollExtractionRow.id,
          uploadSessionId: payrollExtractionRow.uploadSessionId,
          payrollPeriod: payrollExtractionRow.payrollPeriod,
          createdAt: payrollExtractionRow.createdAt,
          updatedAt: payrollExtractionRow.updatedAt,
          clientName: client.name,
        })
        .from(payrollExtractionRow)
        .innerJoin(uploadSession, and(eq(payrollExtractionRow.uploadSessionId, uploadSession.id), eq(uploadSession.tenantId, tenantId)))
        .innerJoin(client, and(eq(uploadSession.clientId, client.id), eq(client.tenantId, tenantId)))
        .where(payrollFailureWhere)
        .orderBy(desc(payrollExtractionRow.updatedAt))
        .limit(50),
      db
        .select({ value: count() })
        .from(payrollExtractionRow)
        .innerJoin(uploadSession, and(eq(payrollExtractionRow.uploadSessionId, uploadSession.id), eq(uploadSession.tenantId, tenantId)))
        .where(payrollFailureWhere),
    ])
    : [[], []]

  const openEvents = eventRows.filter(isOpenEvent)
  const todayEvents = openEvents.filter((event) => {
    const dueAt = parseDateTime(event.dueAt)
    return Boolean(dueAt?.hasSame(currentTime, 'day'))
  })
  const overdueEvents = openEvents.filter((event) => {
    const dueAt = parseDateTime(event.dueAt)
    return Boolean(dueAt && dueAt < currentTime && !dueAt.hasSame(currentTime, 'day'))
  })
  const failedEmails = emailRows.filter((email) => email.status === 'failed')
  const reviewDrafts = emailRows.filter((email) => email.type === 'missing_request' && email.status === 'draft')
  const clientCount = countValue(clientCountRows)
  const todayEventCount = countValue(todayEventCountRows)
  const overdueEventCount = countValue(overdueEventCountRows)
  const failedEmailCount = countValue(failedEmailCountRows)
  const reviewDraftCount = countValue(reviewDraftCountRows)
  const payrollFailureCount = countValue(payrollFailureCountRows)
  const uploadCount = countValue(uploadCountRows)

  const priorityItems = [
    ...overdueEvents.slice(0, 4).map((event) => ({
      key: `overdue-${event.id}`,
      title: `${event.clientName} ${event.title}`,
      meta: `${dueLabel(event, currentTime)} · ${EVENT_STATUS_LABEL[event.status] ?? event.status}`,
      href: event.uploadSessionId ? `/dashboard/sessions/${event.uploadSessionId}` : `/dashboard/calendar`,
      tone: 'destructive' as const,
      label: '지연',
    })),
    ...failedEmails.slice(0, 3).map((email) => ({
      key: `failed-${email.id}`,
      title: email.subject,
      meta: `${EMAIL_TYPE_LABEL[email.type] ?? email.type} · ${formatRelative(email.createdAt, currentTime)}`,
      href: '/dashboard/emails',
      tone: 'destructive' as const,
      label: '실패',
    })),
    ...reviewDrafts.slice(0, 3).map((email) => ({
      key: `review-${email.id}`,
      title: email.subject,
      meta: `${EMAIL_TYPE_LABEL[email.type] ?? email.type} · 담당자 검토 필요`,
      href: '/dashboard/reviews',
      tone: 'warning' as const,
      label: '검토',
    })),
    ...payrollFailureRows.slice(0, 3).map((row) => ({
      key: `payroll-${row.id}`,
      title: `${row.clientName} 급여 부적합`,
      meta: `${row.payrollPeriod} · row 보완 필요`,
      href: `/dashboard/sessions/${row.uploadSessionId}`,
      tone: 'destructive' as const,
      label: '급여',
    })),
    ...todayEvents.slice(0, 4).map((event) => ({
      key: `today-${event.id}`,
      title: `${event.clientName} ${event.title}`,
      meta: `${EVENT_STATUS_LABEL[event.status] ?? event.status} · ${event.requestKind === 'payroll' ? '급여' : '자료'}`,
      href: event.uploadSessionId ? `/dashboard/sessions/${event.uploadSessionId}` : `/dashboard/calendar`,
      tone: 'info' as const,
      label: '오늘',
    })),
  ].slice(0, 8)

  const actionRequiredCount = overdueEventCount + failedEmailCount + reviewDraftCount + payrollFailureCount

  const metricCards: MetricCard[] = [
    {
      label: '처리 필요',
      value: actionRequiredCount,
      description: '지연, 실패, 검토, 급여 부적합',
      href: priorityItems[0]?.href ?? '/dashboard/calendar',
      icon: AlertTriangle,
      tone: actionRequiredCount > 0 ? 'destructive' : 'success',
    },
    {
      label: '오늘 마감',
      value: todayEventCount,
      description: '오늘 제출기한 요청',
      href: '/dashboard/calendar',
      icon: Clock,
      tone: todayEventCount > 0 ? 'info' : 'default',
    },
    {
      label: '최근 업로드',
      value: uploadCount,
      description: '최근 7일 고객 제출 (테스트 업로드 제외)',
      href: '/dashboard/reviews',
      icon: UploadCloud,
      tone: uploadCount > 0 ? 'success' : 'default',
    },
    {
      label: '관리 고객사',
      value: clientCount,
      description: '등록된 고객사',
      href: '/dashboard/clients',
      icon: Users,
      tone: clientCount > 0 ? 'info' : 'default',
    },
  ]

  const quickActions = [
    {
      title: '메일 발송',
      description: '정기/비정기 자료 요청을 보냅니다.',
      href: '/dashboard/emails',
      icon: Mail,
    },
    {
      title: '자료 검토',
      description: '업로드 자료와 보충 요청을 확인합니다.',
      href: '/dashboard/reviews',
      icon: AlertTriangle,
    },
    {
      title: '캘린더',
      description: '제출기한과 세무 일정을 봅니다.',
      href: '/dashboard/calendar',
      icon: CalendarDays,
    },
    {
      title: '고객사 관리',
      description: '고객사 설정과 담당자를 관리합니다.',
      href: '/dashboard/clients',
      icon: Users,
    },
    {
      title: '급여정산',
      description: '급여 자료 판정과 엑셀 초안을 확인합니다.',
      href: '/dashboard/payroll',
      icon: FileSpreadsheet,
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">진행 현황</h1>
            <Badge variant="info">Overview</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            오늘 확인할 업무와 바로 이동할 화면만 모아 봅니다. 새 업무 생성과 상세 처리는 각 전용 화면에서 진행합니다.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/dashboard/emails" className={buttonVariants()}>
            <Mail className="size-4" />
            메일 요청
          </Link>
          <Link href="/dashboard/calendar" className={buttonVariants({ variant: 'outline' })}>
            <CalendarDays className="size-4" />
            캘린더
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => {
          const Icon = item.icon

          return (
            <Link key={item.label} href={item.href} className="block">
              <Card size="sm" className="h-full transition-colors hover:border-primary/40 hover:bg-muted/20">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardDescription>{item.label}</CardDescription>
                      <CardTitle className={cn('text-2xl font-semibold', item.tone === 'destructive' && 'text-red-700', item.tone === 'warning' && 'text-amber-700', item.tone === 'success' && 'text-emerald-700', item.tone === 'info' && 'text-blue-700')}>
                        {item.value}
                      </CardTitle>
                    </div>
                    <div className={cn('flex size-8 items-center justify-center rounded-md', toneClasses(item.tone))}>
                      <Icon className="size-4" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">오늘의 우선순위</CardTitle>
                <CardDescription>지연, 발송 실패, 검토 대기, 급여 부적합, 오늘 마감만 보여줍니다.</CardDescription>
              </div>
              <Badge variant={priorityItems.length > 0 ? 'warning' : 'success'}>
                {priorityItems.length > 0 ? `상위 ${priorityItems.length}건` : '정상'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {priorityItems.length > 0 ? (
              <div className="grid gap-2">
                {priorityItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('rounded-md border px-1.5 py-0.5 text-[11px] font-semibold', toneClasses(item.tone))}>
                          {item.label}
                        </span>
                        <p className="truncate font-medium text-foreground">{item.title}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="급한 업무가 없습니다"
                description="지연, 실패, 검토 대기, 급여 부적합 항목이 없으면 각 업무 화면에서 일반 진행 상태를 확인합니다."
                href="/dashboard/calendar"
                action="세무 일정 보기"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">빠른 이동</CardTitle>
            <CardDescription>업무를 시작할 전용 화면으로 바로 이동합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {quickActions.map((item) => {
                const Icon = item.icon

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{item.title}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
