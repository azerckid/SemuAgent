'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  formatApprovalQueueCreatedAt,
  formatApprovalQueuePeriod,
  normalizeApprovalEmailBody,
  normalizeApprovalEmailSubject,
  summarizeApprovalEmailReason,
} from './approval-queue-format'

export interface ApprovalEmailRow {
  id: string
  type: string
  subject: string
  body: string
  toEmail: string
  status: 'draft' | 'sent' | 'failed' | 'rejected'
  appliedAnalysisNotes: string | null
  criteriaSummary: string | null
  sentAt: string | null
  createdAt: string
  sessionId: string
  accountingPeriod: string
  clientName: string
  clientDisplayName: string
  clientEmail: string
}

interface ApprovalQueueSectionProps {
  drafts: ApprovalEmailRow[]
  initialSessionId?: string
}

const badgeClass = 'h-6 rounded-full px-2 text-xs font-semibold'
const cardTitleClass = 'text-base font-semibold tracking-normal text-foreground'
const cardDescriptionClass = 'mt-1 text-sm leading-5 text-muted-foreground'
const fieldLabelClass = 'text-xs font-semibold text-muted-foreground'

const STATUS_LABEL: Record<ApprovalEmailRow['status'], string> = {
  draft: '초안',
  sent: '발송됨',
  rejected: '거부됨',
  failed: '실패',
}

const STATUS_BADGE_VARIANT: Record<ApprovalEmailRow['status'], 'warning' | 'success' | 'secondary' | 'destructive'> = {
  draft: 'warning',
  sent: 'success',
  rejected: 'secondary',
  failed: 'destructive',
}

function formatClientDisplayName(email: ApprovalEmailRow) {
  if (!email.clientDisplayName || email.clientDisplayName === email.clientName) return email.clientName
  return `${email.clientDisplayName} · ${email.clientName}`
}

function formatStatusTimestamp(email: ApprovalEmailRow) {
  if (email.status === 'sent' && email.sentAt) return `${formatApprovalQueueCreatedAt(email.sentAt)} 발송`
  if (email.status === 'draft') return `${formatApprovalQueueCreatedAt(email.createdAt)} 생성`
  if (email.status === 'failed') return `${formatApprovalQueueCreatedAt(email.createdAt)} 실패`
  return `${formatApprovalQueueCreatedAt(email.createdAt)} 처리`
}

export function ApprovalQueueSection({ drafts, initialSessionId }: ApprovalQueueSectionProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const normalizedDrafts = drafts.map((draft) => ({
    ...draft,
    subject: normalizeApprovalEmailSubject(draft.subject),
    body: normalizeApprovalEmailBody(draft.body),
  }))
  const initialDraft = initialSessionId
    ? normalizedDrafts.find((draft) => draft.sessionId === initialSessionId)
    : null

  const [selectedId, setSelectedId] = useState<string | null>(initialDraft?.id ?? normalizedDrafts[0]?.id ?? null)
  const firstDraft = initialDraft ?? normalizedDrafts[0] ?? null
  const [editSubject, setEditSubject] = useState(firstDraft?.subject ?? '')
  const [editBody, setEditBody] = useState(firstDraft?.body ?? '')
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedDraft = normalizedDrafts.find((draft) => draft.id === selectedId) ?? null
  const currentSubject = selectedDraft ? editSubject : ''
  const currentBody = selectedDraft ? editBody : ''
  const selectedPeriod = selectedDraft ? formatApprovalQueuePeriod(selectedDraft.accountingPeriod) : null
  const selectedIsDraft = selectedDraft?.status === 'draft'
  const statusCounts = normalizedDrafts.reduce<Record<ApprovalEmailRow['status'], number>>(
    (counts, draft) => {
      counts[draft.status] += 1
      return counts
    },
    { draft: 0, sent: 0, rejected: 0, failed: 0 },
  )
  const statusSummary = [
    statusCounts.draft > 0 ? `초안 ${statusCounts.draft}` : null,
    statusCounts.sent > 0 ? `발송 ${statusCounts.sent}` : null,
    statusCounts.rejected > 0 ? `거부 ${statusCounts.rejected}` : null,
    statusCounts.failed > 0 ? `실패 ${statusCounts.failed}` : null,
  ].filter(Boolean).join(' · ')

  const handleSelect = (draft: ApprovalEmailRow) => {
    setSelectedId(draft.id)
    setEditSubject(draft.subject)
    setEditBody(draft.body)
    setIsEditing(false)
    setError(null)
  }

  const handleApprove = async () => {
    if (!selectedDraft) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/emails/${selectedDraft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', subject: currentSubject, body: currentBody }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '처리 중 오류가 발생했습니다.')
      startTransition(() => router.refresh())
      return
    }
    startTransition(() => router.refresh())
  }

  if (normalizedDrafts.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-64 flex-col items-center justify-center text-center">
          <p className="text-base font-semibold text-foreground">현재 검토할 항목이 없습니다</p>
          <p className="mt-1 text-sm text-muted-foreground">
            고객에게 보낼 제출 자료 확인 메일이 생성되면 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="min-h-0">
        <CardHeader>
          <CardTitle className={cardTitleClass}>메일 목록</CardTitle>
          <CardDescription className={cardDescriptionClass}>
            {statusSummary || `${normalizedDrafts.length}건`}
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[650px] overflow-y-auto px-0">
          <ul className="divide-y divide-border">
            {normalizedDrafts.map((draft) => {
              const isSelected = draft.id === selectedId
              const period = formatApprovalQueuePeriod(draft.accountingPeriod)
              const reason = summarizeApprovalEmailReason(draft.criteriaSummary, draft.body)
              return (
                <li key={draft.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(draft)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      isSelected && "bg-primary/10"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("block truncate text-sm font-bold", isSelected ? "text-primary" : "text-foreground")}>
                        {formatClientDisplayName(draft)}
                      </span>
                      <Badge variant={STATUS_BADGE_VARIANT[draft.status]} className="h-5 shrink-0 rounded-full px-1.5 text-[11px]">
                        {STATUS_LABEL[draft.status]}
                      </Badge>
                    </span>
                    <span className={cn("mt-1 block text-xs", period.isInvalid ? "font-semibold text-amber-700" : "text-muted-foreground")}>
                      {period.label} · {formatStatusTimestamp(draft)}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                      {reason}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {selectedDraft ? (
        <Card className="min-h-0">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className={cardTitleClass}>
                {formatClientDisplayName(selectedDraft)} - {selectedPeriod?.label ?? '기간 확인 필요'} 제출 자료 확인
              </CardTitle>
              <CardDescription className={cardDescriptionClass}>수신자: {selectedDraft.toEmail}</CardDescription>
            </div>
            <Badge variant={STATUS_BADGE_VARIANT[selectedDraft.status]} className={badgeClass}>
              {STATUS_LABEL[selectedDraft.status]}
            </Badge>
          </CardHeader>
          <CardContent className="grid max-h-[650px] gap-4 overflow-y-auto">
            {selectedPeriod?.isInvalid && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                이 초안의 회계기간 형식을 확인해야 합니다. 발송 전 세션 기간 또는 초안을 다시 확인해 주세요.
              </div>
            )}

            {!selectedIsDraft ? (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                {selectedDraft.status === 'sent'
                  ? `${formatStatusTimestamp(selectedDraft)}된 보충 요청 메일입니다. 전체 발송 이력은 메일 요청 화면에서도 확인할 수 있습니다.`
                  : selectedDraft.status === 'failed'
                    ? '발송 실패 이력이 있는 보충 요청 메일입니다. 필요하면 메일 요청 화면의 발송 이력과 오류를 확인해 주세요.'
                    : '담당자가 거부한 보충 요청 메일입니다. 고객에게 발송되지 않았습니다.'}
              </div>
            ) : null}

            {isEditing && selectedIsDraft ? (
              <>
                <label className="grid gap-1.5">
                  <span className={fieldLabelClass}>제목 수정</span>
                  <Input
                    value={currentSubject}
                    onChange={(event) => setEditSubject(event.target.value)}
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className={fieldLabelClass}>
                    본문 HTML 수정
                  </span>
                  <Textarea
                    value={currentBody}
                    onChange={(event) => setEditBody(event.target.value)}
                    rows={14}
                    className="font-mono"
                  />
                </label>
              </>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-background">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs font-semibold text-muted-foreground">메일 미리보기</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{currentSubject}</p>
                </div>
                <div
                  className="prose prose-sm max-w-none px-4 py-4 text-sm leading-6 text-foreground"
                  dangerouslySetInnerHTML={{ __html: currentBody }}
                />
              </div>
            )}

          </CardContent>
          <CardFooter className="gap-3">
            {error && <p className="flex-1 text-xs text-destructive">{error}</p>}
            <div className="ml-auto flex gap-2">
              {selectedIsDraft ? (
                <>
                  {isEditing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={loading}
                      onClick={() => {
                        setEditSubject(selectedDraft.subject)
                        setEditBody(selectedDraft.body)
                        setIsEditing(false)
                        setError(null)
                      }}
                    >
                      수정 취소
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      onClick={() => setIsEditing(true)}
                    >
                      메일 수정
                    </Button>
                  )}
                  <Button
                    type="button"
                    disabled={loading || selectedPeriod?.isInvalid}
                    onClick={handleApprove}
                  >
                    {loading ? '발송 중...' : '승인 및 발송'}
                  </Button>
                </>
              ) : null}
            </div>
          </CardFooter>
        </Card>
      ) : (
        <Card className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
          목록에서 항목을 선택하세요
        </Card>
      )}
    </div>
  )
}
