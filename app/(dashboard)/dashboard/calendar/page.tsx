import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, asc, eq, gte, inArray, isNull, lt, or } from 'drizzle-orm'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientRequestEvent, uploadSession } from '@/lib/db/schema'
import {
  buildTaxCalendarStatusItems,
  groupTaxCalendarStatusItemsByDate,
  summarizeTaxCalendarStatusItems,
  type TaxCalendarOverallStatus,
  type TaxCalendarStatusItem,
} from '@/lib/tax-calendar-status'
import { cn } from '@/lib/utils'
import {
  TAX_SCHEDULE_CATEGORY_LABEL,
  buildTaxCalendarMonth,
  parseTaxCalendarMonth,
  type TaxScheduleCategory,
  type TaxScheduleOccurrence,
} from '@/lib/tax-calendar'
import { now } from '@/lib/time'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const CATEGORY_STYLE: Record<TaxScheduleCategory, string> = {
  tax: 'border-blue-200 bg-blue-50 text-blue-700',
  payroll: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  vat: 'border-amber-200 bg-amber-50 text-amber-700',
  corporate: 'border-violet-200 bg-violet-50 text-violet-700',
}

const CATEGORY_DOT_STYLE: Record<TaxScheduleCategory, string> = {
  tax: 'bg-blue-600',
  payroll: 'bg-emerald-600',
  vat: 'bg-amber-600',
  corporate: 'bg-violet-600',
}

const STATUS_STYLE: Record<TaxCalendarOverallStatus, string> = {
  not_sent: 'border-slate-200 bg-slate-50 text-slate-700',
  upload_waiting: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  uploaded: 'border-violet-200 bg-violet-50 text-violet-700',
  needs_review: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  overdue: 'border-red-200 bg-red-50 text-red-700',
  closed: 'border-gray-200 bg-gray-50 text-gray-600',
}

const STATUS_LABEL: Record<TaxCalendarOverallStatus, string> = {
  not_sent: '미발송',
  upload_waiting: '업로드 대기',
  uploaded: '업로드 완료',
  needs_review: '검토 필요',
  completed: '완료',
  failed: '실패',
  overdue: '지연',
  closed: '종료',
}

function compactCategoryCount(occurrences: TaxScheduleOccurrence[]) {
  return occurrences.reduce<Record<TaxScheduleCategory, number>>((acc, occurrence) => {
    acc[occurrence.category] = (acc[occurrence.category] ?? 0) + 1
    return acc
  }, {} as Record<TaxScheduleCategory, number>)
}

function TaxEventBadge({ occurrence }: { occurrence: TaxScheduleOccurrence }) {
  return (
    <div
      className={cn(
        'flex min-h-6 items-center justify-between gap-2 rounded-md border px-2 py-1 text-[11px] font-semibold leading-tight',
        CATEGORY_STYLE[occurrence.category],
      )}
    >
      <span className="truncate">{occurrence.title}</span>
    </div>
  )
}

function summarizeDayRequestStatus(items: TaxCalendarStatusItem[]) {
  const reviewCount = items.filter((item) =>
    item.overallStatus === 'needs_review'
    || item.overallStatus === 'failed'
    || item.overallStatus === 'overdue',
  ).length
  const waitingCount = items.filter((item) =>
    item.overallStatus === 'not_sent'
    || item.overallStatus === 'upload_waiting',
  ).length
  const uploadedCount = items.filter((item) => item.overallStatus === 'uploaded').length
  const completedCount = items.filter((item) =>
    item.overallStatus === 'completed'
    || item.overallStatus === 'closed',
  ).length

  return {
    reviewCount,
    waitingCount,
    uploadedCount,
    completedCount,
  }
}

function DayRequestSummaryBadge({ items }: { items: TaxCalendarStatusItem[] }) {
  if (items.length === 0) return null

  const { reviewCount, waitingCount, uploadedCount, completedCount } = summarizeDayRequestStatus(items)
  const segments = [
    reviewCount > 0 ? `검토 ${reviewCount}` : null,
    waitingCount > 0 ? `대기 ${waitingCount}` : null,
    uploadedCount > 0 ? `제출 ${uploadedCount}` : null,
    completedCount > 0 ? `완료 ${completedCount}` : null,
  ].filter((segment): segment is string => Boolean(segment))

  return (
    <div
      className={cn(
        'rounded-md border px-2 py-1 text-[11px] leading-tight',
        reviewCount > 0
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : waitingCount > 0
            ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
            : 'border-slate-200 bg-slate-50 text-slate-700',
      )}
    >
      <div className="font-semibold">자료 요청 {items.length}건</div>
      {segments.length > 0 ? (
        <div className="mt-0.5 truncate opacity-80">{segments.slice(0, 2).join(' · ')}</div>
      ) : null}
    </div>
  )
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>
}) {
  const { month: monthKey, day } = await searchParams
  const today = now()
  const month = parseTaxCalendarMonth(monthKey, today)
  const calendar = buildTaxCalendarMonth({ month, today })
  let tenantId: string
  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const monthStart = month.startOf('month')
  const nextMonthStart = monthStart.plus({ months: 1 })
  const monthStartISO = monthStart.toISODate() ?? calendar.monthKey
  const nextMonthStartISO = nextMonthStart.toISODate() ?? calendar.nextMonthKey
  const eventRows = await db
    .select({
      id: clientRequestEvent.id,
      clientId: clientRequestEvent.clientId,
      clientName: client.name,
      title: clientRequestEvent.title,
      requestKind: clientRequestEvent.requestKind,
      dueAt: clientRequestEvent.dueAt,
      status: clientRequestEvent.status,
      uploadSessionId: clientRequestEvent.uploadSessionId,
    })
    .from(clientRequestEvent)
    .innerJoin(client, eq(clientRequestEvent.clientId, client.id))
    .where(
      and(
        eq(clientRequestEvent.tenantId, tenantId),
        eq(client.tenantId, tenantId),
        isNull(clientRequestEvent.deletedAt),
        gte(clientRequestEvent.dueAt, monthStartISO),
        lt(clientRequestEvent.dueAt, nextMonthStartISO),
      ),
    )
    .orderBy(asc(clientRequestEvent.dueAt), asc(client.name))

  const eventIds = eventRows.map((event) => event.id)
  // event.uploadSessionId: 이벤트가 직접 가리키는 세션 ID (있는 경우)
  const eventSessionIds = eventRows
    .map((event) => event.uploadSessionId)
    .filter((id): id is string => Boolean(id))

  // sessionRows: eventIds를 requestEventId로 가리키는 세션 + eventSessionIds로 직접 참조되는 세션.
  const sessionRows = eventIds.length > 0
    ? await db
      .select({
        id: uploadSession.id,
        requestEventId: uploadSession.requestEventId,
        status: uploadSession.status,
      })
      .from(uploadSession)
      .where(
        and(
          eq(uploadSession.tenantId, tenantId),
          isNull(uploadSession.deletedAt),
          eventSessionIds.length > 0
            ? or(inArray(uploadSession.requestEventId, eventIds), inArray(uploadSession.id, eventSessionIds))
            : inArray(uploadSession.requestEventId, eventIds),
        ),
      )
    : []

  const statusItems = buildTaxCalendarStatusItems({
    events: eventRows,
    sessions: sessionRows,
    today,
  })
  const statusItemsByDate = groupTaxCalendarStatusItemsByDate(statusItems)
  const statusSummary = summarizeTaxCalendarStatusItems(statusItems)
  const selectedDateISO =
    day && calendar.days.some((calendarDay) => calendarDay.dateISO === day)
      ? day
      : calendar.days.find((calendarDay) => calendarDay.isToday && calendarDay.inCurrentMonth)?.dateISO
        ?? calendar.occurrences[0]?.dateISO
        ?? statusItems[0]?.dateISO
        ?? calendar.days.find((calendarDay) => calendarDay.inCurrentMonth)?.dateISO
        ?? calendar.monthKey
  const selectedDay = calendar.days.find((calendarDay) => calendarDay.dateISO === selectedDateISO)
  const selectedStatusItems = statusItemsByDate.get(selectedDateISO) ?? []
  const categoryCounts = compactCategoryCount(calendar.occurrences)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">세무 일정 캘린더</h1>
            <Badge variant="info">Base</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {calendar.label} 세무 일정 {calendar.occurrences.length}건을 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={`/dashboard/calendar?month=${calendar.previousMonthKey}`} className={buttonVariants({ variant: 'outline' })}>
            <ArrowLeft className="size-4" />
            이전 달
          </Link>
          <Link href="/dashboard/calendar" className={buttonVariants({ variant: 'outline' })}>
            오늘
          </Link>
          <Link href={`/dashboard/calendar?month=${calendar.nextMonthKey}`} className={buttonVariants({ variant: 'outline' })}>
            다음 달
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">{calendar.label}</CardTitle>
              </div>
              <Badge variant="secondary">월간 보기</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {(Object.keys(TAX_SCHEDULE_CATEGORY_LABEL) as TaxScheduleCategory[]).map((category) => (
                <div key={category} className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
                  <span className={cn('size-2 rounded-full', CATEGORY_DOT_STYLE[category])} />
                  <span>{TAX_SCHEDULE_CATEGORY_LABEL[category]}</span>
                  <span className="text-foreground">{categoryCounts[category] ?? 0}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
                <span className="size-2 rounded-full bg-red-600" />
                <span>지연·검토</span>
                <span className="text-foreground">{statusSummary.reviewNeeded}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <div className="grid min-w-[840px] grid-cols-7 border-b bg-muted/40">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="border-r px-3 py-2 text-center text-xs font-bold text-muted-foreground last:border-r-0">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid min-w-[840px] grid-cols-7">
                {calendar.days.map((calendarDay, index) => {
                  const isSelected = calendarDay.dateISO === selectedDateISO
                  const dayStatusItems = statusItemsByDate.get(calendarDay.dateISO) ?? []
                  const visibleTaxEvents = calendarDay.occurrences.slice(0, 2)
                  const hiddenTaxEventCount = calendarDay.occurrences.length - visibleTaxEvents.length

                  return (
                    <Link
                      key={calendarDay.dateISO}
                      href={`/dashboard/calendar?month=${calendar.monthKey}&day=${calendarDay.dateISO}`}
                      className={cn(
                        'min-h-32 border-r border-b bg-background p-2 text-left transition-colors hover:bg-muted/30',
                        (index + 1) % 7 === 0 && 'border-r-0',
                        !calendarDay.inCurrentMonth && 'bg-muted/20 text-muted-foreground',
                        isSelected && 'bg-blue-50 ring-2 ring-inset ring-blue-400',
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold">
                        <span>{calendarDay.dayOfMonth}</span>
                        {calendarDay.isToday ? <span className="size-1.5 rounded-full bg-blue-600" /> : null}
                      </div>
                      <div className="grid gap-1">
                        {visibleTaxEvents.map((occurrence) => (
                          <TaxEventBadge key={occurrence.id} occurrence={occurrence} />
                        ))}
                        <DayRequestSummaryBadge items={dayStatusItems} />
                        {hiddenTaxEventCount > 0 ? (
                          <div className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                            일정 +{hiddenTaxEventCount}개
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:sticky xl:top-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {selectedDay?.date.toFormat('M월 d일 일정') ?? `${calendar.label} 일정`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {selectedDay?.date.toFormat('cccc') ?? '선택된 날짜 없음'}
                  </div>
                </div>
                {selectedDay?.isToday ? <Badge variant="info">오늘</Badge> : null}
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">세무 일정</div>
                {selectedDay && selectedDay.occurrences.length > 0 ? (
                  selectedDay.occurrences.map((occurrence) => (
                    <div key={occurrence.id} className="rounded-lg border bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{occurrence.title}</div>
                        <Badge className={CATEGORY_STYLE[occurrence.category]} variant="outline">
                          {TAX_SCHEDULE_CATEGORY_LABEL[occurrence.category]}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    선택한 날짜에 표시할 세무 일정이 없습니다.
                  </div>
                )}
              </div>

              {selectedStatusItems.length > 0 ? (
                <div className="mt-5 grid gap-2">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">관련 요청</div>
                  {selectedStatusItems.map((item) => (
                    <div key={item.id} className="rounded-lg border bg-background p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{item.clientName}</div>
                          <div className="text-xs text-muted-foreground">{item.title}</div>
                        </div>
                        <Badge className={STATUS_STYLE[item.overallStatus]} variant="outline">
                          {STATUS_LABEL[item.overallStatus]}
                        </Badge>
                      </div>
                      <div className="grid gap-1 text-xs text-muted-foreground">
                        <div>업무: <span className="font-medium text-foreground">{item.requestKindLabel}</span></div>
                        <div>요청: <span className="font-medium text-foreground">{item.eventStatus}</span></div>
                        <div>업로드: <span className="font-medium text-foreground">{item.uploadLabel}</span></div>
                        <div>다음 액션: <span className="font-medium text-foreground">{item.nextAction}</span></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={item.eventPath} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                          요청 보기
                        </Link>
                        {item.sessionPath ? (
                          <Link href={item.sessionPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                            세션 보기
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
