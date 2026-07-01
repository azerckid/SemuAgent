import { and, asc, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ArrowLeft, CalendarDays, Clock, Mail } from 'lucide-react'
import { requireTenantSession } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { client, clientRequestEvent, outboundEmail, staff, tenant } from '@/lib/db/schema'
import { formatEmailFrom } from '@/lib/email/from'
import { getRequestEventDetailedCadenceLabel } from '@/lib/request-events/labels'
import { fromISO } from '@/lib/time'
import { ToastHandler } from '../../_components/toast-handler'
import { DeleteButton } from './_components/delete-button'
import { SendButton } from './_components/send-button'

const STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  draft_ready: '초안 준비',
  sent: '발송됨',
  waiting_upload: '업로드 대기',
  submitted: '제출 확인',
  analyzing: '분석 중',
  needs_review: '검토필요',
  completed: '완료',
  expired: '만료',
  cancelled: '취소됨',
}

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'border-gray-200 bg-gray-50 text-gray-500',
  draft_ready: 'border-sky-200 bg-sky-50 text-sky-700',
  sent: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  waiting_upload: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  analyzing: 'border-blue-200 bg-blue-50 text-blue-700',
  needs_review: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-green-200 bg-green-50 text-green-700',
  expired: 'border-gray-200 bg-gray-50 text-gray-500',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
}

const EMAIL_TYPE_LABEL: Record<string, string> = {
  upload_request: '고객 요청 메일',
  staff_notification: '담당자 확인 메일',
  missing_request: '보충 요청 메일',
  completion_thanks: '완료 안내 메일',
  reminder: '리마인드 메일',
  transaction_purpose_request: '거래 용도 확인 메일',
}

const EMAIL_STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  sent: '발송됨',
  failed: '실패',
  rejected: '보류',
}

const EMAIL_STATUS_STYLE: Record<string, string> = {
  draft: 'border-gray-200 bg-gray-50 text-gray-500',
  sent: 'border-green-200 bg-green-50 text-green-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  rejected: 'border-gray-200 bg-gray-50 text-gray-500',
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>
}) {
  const { tenantId } = await requireTenantSession()
  const { id: clientId, eventId } = await params

  const [clientRows, eventRows, emailRows, tenantRows] = await Promise.all([
    db
      .select({
        id: client.id,
        name: client.name,
        email: client.email,
        contactName: client.contactName,
        staffName: staff.name,
        staffEmail: staff.email,
      })
      .from(client)
      .leftJoin(staff, and(eq(client.staffId, staff.id), eq(staff.tenantId, tenantId)))
      .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))
      .limit(1),
    db
      .select()
      .from(clientRequestEvent)
      .where(
        and(
          eq(clientRequestEvent.id, eventId),
          eq(clientRequestEvent.clientId, clientId),
          eq(clientRequestEvent.tenantId, tenantId),
          isNull(clientRequestEvent.deletedAt),
        ),
      )
      .limit(1),
    db
      .select({
        id: outboundEmail.id,
        type: outboundEmail.type,
        status: outboundEmail.status,
        toEmail: outboundEmail.toEmail,
        ccEmail: outboundEmail.ccEmail,
        subject: outboundEmail.subject,
        sentAt: outboundEmail.sentAt,
        createdAt: outboundEmail.createdAt,
      })
      .from(outboundEmail)
      .where(and(eq(outboundEmail.tenantId, tenantId), eq(outboundEmail.requestEventId, eventId)))
      .orderBy(asc(outboundEmail.createdAt)),
    db
      .select({ name: tenant.name })
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1),
  ])

  const currentClient = clientRows[0]
  const event = eventRows[0]
  if (!currentClient || !event) notFound()

  const hasDraft = Boolean(event.emailSubjectSnapshot?.trim() && event.emailBodySnapshot?.trim())
  const isPendingSend = !event.uploadSessionId && event.status !== 'cancelled' && event.status !== 'expired' && hasDraft
  const senderEmail = process.env.EMAIL_FROM
    ? formatEmailFrom(process.env.EMAIL_FROM, tenantRows[0]?.name)
    : 'EMAIL_FROM 미설정'
  const clientRecipient = currentClient.contactName
    ? `${currentClient.contactName} <${currentClient.email}>`
    : currentClient.email
  const ccRecipient = event.ccEmailSnapshot?.trim() || '없음'
  const staffRecipient = currentClient.staffEmail
    ? currentClient.staffName
      ? `${currentClient.staffName} <${currentClient.staffEmail}>`
      : currentClient.staffEmail
    : '담당자 이메일 미등록'

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Suspense fallback={null}>
        <ToastHandler />
      </Suspense>
      {/* 브레드크럼 */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/clients" className="hover:text-gray-800">고객사 관리</Link>
        <span>/</span>
        <Link href={`/dashboard/clients/${clientId}`} className="hover:text-gray-800">{currentClient.name}</Link>
        <span>/</span>
        <span className="text-gray-900">요청 일정 상세</span>
      </div>

      <div className="space-y-5">
        {/* 헤더 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[event.status] ?? STATUS_STYLE.scheduled}`}>
                  {STATUS_LABEL[event.status] ?? event.status}
                </span>
                <span className="text-xs text-gray-400">{getRequestEventDetailedCadenceLabel(event)}</span>
              </div>
              <h1 className="mt-2 text-xl font-semibold text-gray-900">{event.title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DeleteButton eventId={event.id} clientId={currentClient.id} />
              <Link
                href={`/dashboard/clients/${clientId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" />
                돌아가기
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <span>회계 기간: <span className="font-medium text-gray-900">{event.accountingPeriod}</span></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>제출 기한: <span className="font-medium text-gray-900">{fromISO(event.dueAt).toFormat('yyyy년 M월 d일 HH:mm')}</span></span>
            </div>
          </div>
        </div>

        {/* 발송 액션 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900">요청 메일 발송</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-xs font-medium text-gray-500">발송 이메일</p>
              <p className="mt-1 break-all text-sm font-medium text-gray-900">{senderEmail}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-xs font-medium text-gray-500">고객 수신</p>
              <p className="mt-1 break-all text-sm font-medium text-gray-900">{clientRecipient}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-xs font-medium text-gray-500">참조</p>
              <p className="mt-1 break-all text-sm font-medium text-gray-900">{ccRecipient}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-xs font-medium text-gray-500">담당자 확인</p>
              <p className="mt-1 break-all text-sm font-medium text-gray-900">{staffRecipient}</p>
            </div>
          </div>
          {emailRows.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-100">
              <div className="border-b border-gray-100 px-3 py-2">
                <p className="text-xs font-medium text-gray-500">발송 기록</p>
              </div>
              <div className="divide-y divide-gray-100">
                {emailRows.map((email) => (
                  <div key={email.id} className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{EMAIL_TYPE_LABEL[email.type] ?? email.type}</span>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${EMAIL_STATUS_STYLE[email.status] ?? EMAIL_STATUS_STYLE.draft}`}>
                          {EMAIL_STATUS_LABEL[email.status] ?? email.status}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-xs text-gray-500">수신: {email.toEmail}</p>
                      {email.ccEmail && <p className="mt-0.5 break-all text-xs text-gray-500">참조: {email.ccEmail}</p>}
                    </div>
                    <p className="text-xs text-gray-400 sm:text-right">
                      {email.sentAt ? fromISO(email.sentAt).toFormat('M/d HH:mm') : '발송 기록 없음'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {event.uploadSessionId ? (
            <div className="mt-3">
              <p className="text-sm text-gray-600">요청 메일이 이미 발송되어 업로드 세션이 연결됐습니다.</p>
              <Link
                href={`/dashboard/sessions/${event.uploadSessionId}`}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                세션 상세 보기
              </Link>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-gray-600">
                아직 요청 메일이 발송되지 않았습니다. 발송하면 클라이언트에게 업로드 링크가 전달됩니다.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <SendButton
                  eventId={event.id}
                  clientId={currentClient.id}
                  disabled={!isPendingSend}
                />
                {!hasDraft && (
                  <p className="text-xs text-amber-600">메일 초안을 먼저 작성해야 발송할 수 있습니다</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 메일 초안 */}
        {(event.emailSubjectSnapshot || event.emailBodySnapshot) && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">메일 초안</h2>
            </div>
            {event.emailSubjectSnapshot && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500">제목</p>
                <p className="mt-1 text-sm text-gray-900">{event.emailSubjectSnapshot}</p>
              </div>
            )}
            {event.emailBodySnapshot && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500">본문</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">{event.emailBodySnapshot}</p>
              </div>
            )}
          </div>
        )}

        {/* 생성 정보 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-400">
            생성: {fromISO(event.createdAt).toFormat('yyyy.MM.dd HH:mm')}
            {event.updatedAt !== event.createdAt && (
              <> · 수정: {fromISO(event.updatedAt).toFormat('yyyy.MM.dd HH:mm')}</>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
