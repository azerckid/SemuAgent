'use client'

import Link from 'next/link'
import { useState } from 'react'
import { getRequestEventCadenceLabel } from '@/lib/request-events/labels'
import { fromISO } from '@/lib/time'
import {
  FREQUENCY_LABEL,
  getAccountingFrequency,
  getPeriodTitle,
} from './client-detail-format'
import type { ClientDetailEvent, ClientDetailSession } from './client-detail-types'

type RecentSummaryStatus = 'sent' | 'waiting_upload' | 'submitted' | 'needs_check'

const RECENT_SUMMARY_STATUS: Record<RecentSummaryStatus, { label: string; className: string }> = {
  sent: {
    label: '발송완료',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  waiting_upload: {
    label: '업로드대기',
    className: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  },
  submitted: {
    label: '제출확인',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  needs_check: {
    label: '검토필요',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
}

function summarizeEventStatus(status: string) {
  if (status === 'sent') return RECENT_SUMMARY_STATUS.sent
  if (status === 'waiting_upload') return RECENT_SUMMARY_STATUS.waiting_upload
  if (status === 'analyzing' || status === 'completed' || status === 'submitted') {
    return RECENT_SUMMARY_STATUS.submitted
  }
  return RECENT_SUMMARY_STATUS.needs_check
}

function summarizeSessionStatus(status: string) {
  if (status === 'requested' || status === 'active') return RECENT_SUMMARY_STATUS.waiting_upload
  if (
    status === 'submitted' ||
    status === 'ai_checking' ||
    status === 'ready_for_accountant' ||
    status === 'completed'
  ) {
    return RECENT_SUMMARY_STATUS.submitted
  }
  return RECENT_SUMMARY_STATUS.needs_check
}

function workspaceHrefForRequestKind(requestKind: string) {
  return requestKind === 'payroll' ? '/dashboard/payroll' : '/dashboard/direct-upload'
}

export type ReviewDerivedStatus = { label: string; detail: string; tone: string }
export type PayrollDerivedStatus = { label: string; detail: string; tone: string }

/**
 * /dashboard/reviews(deriveSessionStatus)가 만드는 세분화된 라벨을 이 표의
 * 4개 요약 상태로 압축한다. "제출 없음"은 아직 자료를 기다리는 단계라
 * 업로드대기로, "제출 확인"/"검증통과"는 큰 문제 없이 확인 가능한 단계라
 * 제출확인으로 묶는다. 그 외(AI 판단 중/평가 필요/재검토 필요/검토필요)는
 * 전부 담당자가 봐야 하는 단계라 검토필요로 묶는다 — "AI 판단 중"도 아직
 * 확정된 상태가 아니므로 제출확인으로 앞서 보여주지 않는다(과대표시 방지).
 */
export function mapReviewDerivedStatusToSummary(derivedStatus: ReviewDerivedStatus) {
  if (derivedStatus.label === '제출 없음') return RECENT_SUMMARY_STATUS.waiting_upload
  if (
    derivedStatus.label === '제출 확인' ||
    derivedStatus.label === '검증통과'
  ) {
    return RECENT_SUMMARY_STATUS.submitted
  }
  return RECENT_SUMMARY_STATUS.needs_check
}

export function mapPayrollDerivedStatusToSummary(derivedStatus: PayrollDerivedStatus) {
  if (derivedStatus.label === '요청 발송') return RECENT_SUMMARY_STATUS.sent
  if (derivedStatus.label === '업로드 대기' || derivedStatus.label === '업로드 중' || derivedStatus.label === '초안') {
    return RECENT_SUMMARY_STATUS.waiting_upload
  }
  if (
    derivedStatus.label === '작성 가능' ||
    derivedStatus.label === '엑셀 생성' ||
    derivedStatus.label === '추출 대기' ||
    derivedStatus.label === '추출 중' ||
    derivedStatus.label === '제출 완료' ||
    derivedStatus.label === 'AI 판단 중' ||
    derivedStatus.label === '매칭 완료' ||
    derivedStatus.label === '완료'
  ) {
    return RECENT_SUMMARY_STATUS.submitted
  }
  return RECENT_SUMMARY_STATUS.needs_check
}

type RecentRequestItem = {
  id: string
  key: string
  period: string
  title: string
  detail: string
  status: string
  statusClass: string
  href: string
  createdAt: string
}

export function buildRecentRequestItems({
  events,
  sessions,
  reviewStatusBySessionId,
  payrollStatusBySessionId,
}: {
  events: ClientDetailEvent[]
  sessions: ClientDetailSession[]
  reviewStatusBySessionId: Record<string, ReviewDerivedStatus>
  payrollStatusBySessionId: Record<string, PayrollDerivedStatus>
}) {
  const eventSessionIds = new Set(events.map((event) => event.uploadSessionId).filter(Boolean))
  const eventItems: RecentRequestItem[] = events.map((event) => {
    const payrollStatus = event.requestKind === 'payroll' && event.uploadSessionId
      ? payrollStatusBySessionId[event.uploadSessionId]
      : undefined
    const reviewStatus = event.requestKind !== 'payroll' && event.uploadSessionId
      ? reviewStatusBySessionId[event.uploadSessionId]
      : undefined
    const summaryStatus = payrollStatus
      ? mapPayrollDerivedStatusToSummary(payrollStatus)
      : reviewStatus
      ? mapReviewDerivedStatusToSummary(reviewStatus)
      : summarizeEventStatus(event.status)
    return {
      id: event.id,
      key: `event-${event.id}`,
      period: getPeriodTitle(event.accountingPeriod),
      title: event.title,
      detail: `${getRequestEventCadenceLabel(event)} · 제출 기한 ${fromISO(event.dueAt).toFormat('M월 d일 HH:mm')}`,
      status: summaryStatus.label,
      statusClass: summaryStatus.className,
      href: workspaceHrefForRequestKind(event.requestKind),
      createdAt: event.createdAt,
    }
  })

  const standaloneSessionItems: RecentRequestItem[] = sessions
    .filter((session) => !eventSessionIds.has(session.id))
    .map((session) => {
      const frequency = getAccountingFrequency(session.accountingPeriod)
      const payrollStatus = session.requestKind === 'payroll' ? payrollStatusBySessionId[session.id] : undefined
      const reviewStatus = session.requestKind === 'payroll' ? undefined : reviewStatusBySessionId[session.id]
      const summaryStatus = payrollStatus
        ? mapPayrollDerivedStatusToSummary(payrollStatus)
        : reviewStatus
        ? mapReviewDerivedStatusToSummary(reviewStatus)
        : summarizeSessionStatus(session.status)
      return {
        id: session.id,
        key: `session-${session.id}`,
        period: getPeriodTitle(session.accountingPeriod),
        title: session.requestKind === 'payroll'
          ? '급여정산 자료 요청'
          : `${getPeriodTitle(session.accountingPeriod)} 자료 요청`,
        detail: `${FREQUENCY_LABEL[frequency] ?? frequency} · 제출 기한 ${fromISO(session.expiresAt).toFormat('M월 d일 HH:mm')}`,
        status: summaryStatus.label,
        statusClass: summaryStatus.className,
        href: workspaceHrefForRequestKind(session.requestKind),
        createdAt: session.createdAt,
      }
    })

  return [...eventItems, ...standaloneSessionItems]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function ClientWorkContext({
  events,
  sessions,
  reviewStatusBySessionId = {},
  payrollStatusBySessionId = {},
}: {
  events: ClientDetailEvent[]
  sessions: ClientDetailSession[]
  reviewStatusBySessionId?: Record<string, ReviewDerivedStatus>
  payrollStatusBySessionId?: Record<string, PayrollDerivedStatus>
}) {
  const recentItems = buildRecentRequestItems({
    events,
    sessions,
    reviewStatusBySessionId,
    payrollStatusBySessionId,
  })
  const [showAll, setShowAll] = useState(false)
  const visibleItems = showAll ? recentItems : recentItems.slice(0, 5)
  const hasMoreItems = recentItems.length > 5

  return (
    <section id="recent-requests" className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-gray-950">최근 요청</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {showAll
              ? '이 사업장의 요청/업로드 흐름 전체를 보여줍니다. 상세 작업은 각 행에서 이동합니다.'
              : '이 사업장의 최근 흐름만 5건까지 보여줍니다. 상세 작업은 각 행에서 이동합니다.'}
          </p>
        </div>
        {hasMoreItems ? (
          <button
            type="button"
            className="text-sm font-medium text-blue-700 hover:underline"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? '5건만 보기' : `전체 보기 (${recentItems.length}건)`}
          </button>
        ) : null}
      </div>

      {recentItems.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-400">
          아직 이 사업장에 생성된 요청이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
              <tr>
                <th className="px-5 py-3">기간</th>
                <th className="px-5 py-3">요청</th>
                <th className="px-5 py-3">상태</th>
                <th className="px-5 py-3 text-right">이동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleItems.map((item) => (
                <tr key={item.key}>
                  <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-900">{item.period}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-950">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.detail}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${item.statusClass}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <Link href={item.href} className="font-medium text-blue-700 hover:underline">
                      상세 보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
