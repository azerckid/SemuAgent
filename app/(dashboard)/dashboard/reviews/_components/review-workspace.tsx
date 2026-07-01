'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CompletionApprovalPanel } from '../../_components/completion-approval-panel'
import { ReviewAutoRefresh } from './review-auto-refresh'
import { ReviewRequestList, type ReviewRequestListItem } from './review-request-list'
import { ReviewWorkspaceCollapsibleSection } from './review-workspace-collapsible-section'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

function buildReviewsHref(params: { sessionId?: string; q?: string; page?: number }) {
  const searchParams = new URLSearchParams()
  if (params.sessionId) searchParams.set('sessionId', params.sessionId)
  if (params.q) searchParams.set('q', params.q)
  if (params.page && params.page > 1) searchParams.set('page', String(params.page))
  const query = searchParams.toString()
  return query ? `/dashboard/reviews?${query}` : '/dashboard/reviews'
}

export function ReviewWorkspace({
  items,
  query,
  page,
  pageSize,
  totalSessions,
  selectedSession,
  selectedSessionId,
  sessionNotFound = false,
  attributionPromptCard,
  deferredPreviews,
  deferredApprovalQueue,
}: {
  items: ReviewRequestListItem[]
  query: string
  page: number
  pageSize: number
  totalSessions: number
  selectedSession: ReviewSession | null
  selectedSessionId: string | null
  sessionNotFound?: boolean
  attributionPromptCard?: ReactNode
  deferredPreviews?: ReactNode
  deferredApprovalQueue?: ReactNode
}) {
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)
  const lastPage = Math.max(1, Math.ceil(totalSessions / pageSize))
  const hasActiveAnalysis = Boolean(selectedSession && (
    selectedSession.files.some((file) => ['uploaded', 'analyzing'].includes(file.status))
  ))
  const isSessionSwitching = Boolean(pendingSessionId && pendingSessionId !== selectedSessionId)
  const showCompletionPanel = Boolean(
    selectedSession && ['ready_for_accountant', 'completed'].includes(selectedSession.status),
  )
  const completionKind = selectedSession?.completionKind ?? null
  const isExceptionCompletion = completionKind === 'exception'

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
      {isSessionSwitching ? (
        <div className="fixed inset-x-0 top-0 z-50 h-1 bg-primary/15">
          <div className="h-full w-1/2 animate-pulse bg-primary" />
        </div>
      ) : null}
      <ReviewAutoRefresh enabled={hasActiveAnalysis} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">자료 검토</h1>
            <Badge variant="info">일반 자료 workspace</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            요청별 자료·귀속기간·계정항목·전표분개 상태를 한 행에서 확인합니다. 상세는 각 상태 칩을 눌러 팝업으로 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/direct-upload?kind=bookkeeping" className={buttonVariants()}>
            담당자 직접 업로드
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{query ? '검색 결과에 해당하는 요청이 없습니다' : '검토할 일반 자료 세션이 없습니다'}</CardTitle>
            <CardDescription>
              {query ? '다른 고객사명, 담당자, 기장기간으로 다시 검색해 보세요.' : '고객사 상세에서 자료 요청을 생성하면 이 화면에서 진행 상태를 모아 볼 수 있습니다.'}
            </CardDescription>
            <form action="/dashboard/reviews" method="get" className="mt-2 flex gap-2">
              <Input type="search" name="q" defaultValue={query} placeholder="고객사명, 담당자, 기장기간, 요청 방식 검색" className="h-9" />
              <button type="submit" className={cn(buttonVariants({ size: 'sm' }), 'h-9 shrink-0')}>
                검색
              </button>
            </form>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">자료 검토 요청 목록</CardTitle>
              <CardDescription>검색과 페이지네이션은 이 목록 안에서만 제공합니다.</CardDescription>
              <form action="/dashboard/reviews" method="get" className="mt-2 flex gap-2">
                <Input type="search" name="q" defaultValue={query} placeholder="고객사명, 담당자, 기장기간, 요청 방식 검색" className="h-9" />
                <button type="submit" className={cn(buttonVariants({ size: 'sm' }), 'h-9 shrink-0')}>
                  검색
                </button>
              </form>
              {query ? (
                <Link href="/dashboard/reviews" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                  검색 초기화
                </Link>
              ) : null}
            </CardHeader>
            <CardContent>
              <ReviewRequestList items={items} onNavigate={setPendingSessionId} />
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>{totalSessions === 0 ? '요청 0건' : `페이지 ${page.toLocaleString('ko-KR')} / ${lastPage.toLocaleString('ko-KR')}`}</span>
                <div className="flex gap-2">
                  <Link
                    aria-disabled={page <= 1}
                    href={buildReviewsHref({ sessionId: selectedSessionId ?? undefined, q: query, page: Math.max(1, page - 1) })}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), page <= 1 && 'pointer-events-none opacity-40')}
                  >
                    이전
                  </Link>
                  <Link
                    aria-disabled={page >= lastPage}
                    href={buildReviewsHref({ sessionId: selectedSessionId ?? undefined, q: query, page: Math.min(lastPage, page + 1) })}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), page >= lastPage && 'pointer-events-none opacity-40')}
                  >
                    다음
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {sessionNotFound ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              요청한 자료 검토 세션을 찾을 수 없습니다.
            </div>
          ) : (
            <>
              {attributionPromptCard}
              {deferredApprovalQueue}
              {deferredPreviews}
            </>
          )}

          {selectedSession && showCompletionPanel ? (
            <ReviewWorkspaceCollapsibleSection
              title={isExceptionCompletion ? '예외 승인 완료 처리' : '자료 충족 완료 처리'}
              description={
                isExceptionCompletion
                  ? '담당자 예외 검토로 완료 가능 상태입니다. 부합 자료를 확인한 뒤 완료 감사메일을 발송합니다.'
                  : '부합 자료를 내려받고, 완료 감사메일을 확인한 뒤 담당자가 직접 발송합니다.'
              }
              badge={{
                label: selectedSession.status === 'completed'
                  ? (isExceptionCompletion ? '예외 승인 완료' : '완료됨')
                  : (isExceptionCompletion ? '예외 승인 가능' : '완료 가능'),
                variant: selectedSession.status === 'completed' ? 'success' : 'warning',
              }}
            >
              <CompletionApprovalPanel
                sessionId={selectedSession.id}
                status={selectedSession.status}
                clientName={selectedSession.clientName}
                clientEmail={selectedSession.clientEmail}
                staffName={selectedSession.staffName}
                accountingPeriod={selectedSession.accountingPeriod}
                acceptedFiles={selectedSession.acceptedFiles}
                completionKind={completionKind}
                className="border-0 shadow-none"
              />
            </ReviewWorkspaceCollapsibleSection>
          ) : null}
        </>
      )}
    </div>
  )
}
