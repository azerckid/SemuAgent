'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  resolvePurposeTemplate,
  type PurposeTemplateContext,
} from '@/lib/bookkeeping/transaction-purpose-template'
import type { PurposeRequestDraftView } from '@/lib/bookkeeping/transaction-purpose-service'

interface EditorProps {
  sessionId: string
  requestId: string
  initial: PurposeRequestDraftView
}

const ROW_STATUS_LABEL: Record<string, string> = {
  pending: '답변 대기',
  answered: '답변됨',
  staff_confirmed: '확정',
  skipped: '건너뜀',
  cancelled: '취소',
}

function errorMessageFromResponse(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback
  const error = (data as { error?: unknown }).error
  return typeof error === 'string' ? error : fallback
}

// ISO 문자열 → date input용 YYYY-MM-DD. 없으면 빈 문자열.
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function TransactionPurposeDraftEditor({ sessionId, requestId, initial }: EditorProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [subject, setSubject] = useState(initial.request.subjectSnapshot)
  const [body, setBody] = useState(initial.request.bodySnapshot)
  const [dueAt, setDueAt] = useState(toDateInput(initial.request.dueAt))
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isSent = initial.request.status !== 'draft'

  // 미리보기용 컨텍스트. dueAt은 편집 중인 값으로 반영.
  const previewCtx: PurposeTemplateContext = useMemo(
    () => ({
      ...initial.templateContext,
      dueAt: dueAt ? `${dueAt}T00:00:00+09:00` : null,
    }),
    [initial.templateContext, dueAt],
  )
  const previewSubject = useMemo(() => resolvePurposeTemplate(subject, previewCtx), [subject, previewCtx])
  const previewBody = useMemo(() => resolvePurposeTemplate(body, previewCtx), [body, previewCtx])

  const draftPayload = () => ({
    subjectSnapshot: subject,
    bodySnapshot: body,
    dueAt: dueAt ? `${dueAt}T00:00:00+09:00` : null,
  })

  const saveDraftSnapshot = async () => {
    return fetch(`/api/transaction-purpose-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftPayload()),
    })
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(null)
    setSaving(true)
    const res = await saveDraftSnapshot()
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(errorMessageFromResponse(data, '저장에 실패했습니다'))
      return
    }
    setSuccess('저장했습니다.')
    startTransition(() => router.refresh())
  }

  const handleSend = async () => {
    if (!confirm('고객에게 거래 용도 확인 메일을 발송하시겠습니까? 발송 후에는 취소할 수 없습니다.')) return
    setError(null)
    setSuccess(null)
    setSending(true)

    const saveRes = await saveDraftSnapshot()
    if (!saveRes.ok) {
      setSending(false)
      const data = await saveRes.json().catch(() => ({}))
      setError(errorMessageFromResponse(data, '발송 전 초안 저장에 실패했습니다'))
      return
    }

    const res = await fetch(`/api/transaction-purpose-requests/${requestId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    setSending(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(errorMessageFromResponse(data, '발송에 실패했습니다'))
      return
    }
    setSuccess('발송했습니다.')
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/sessions/${sessionId}/account-classification`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 계정항목 정리로 돌아가기
        </Link>
        {isSent && <Badge variant="success">발송 완료</Badge>}
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
      {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">메일 초안 편집</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">제목</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isSent} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">본문</label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={isSent}
                rows={14}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                본문에 거래 상세를 나열하지 마세요. [[고객명]] [[회계사무소]] [[담당자]] [[업로드링크]] [[답변기한]] 은 발송 시 자동 치환됩니다.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">답변 기한</label>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} disabled={isSent} />
            </div>
            {!isSent && (
              <Button type="button" variant="outline" onClick={handleSave} disabled={saving || sending}>
                {saving ? '저장 중...' : '초안 저장'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">미리보기</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">제목</p>
              <p className="mt-1 text-sm text-foreground">{previewSubject}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">본문</p>
              <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground">{previewBody}</pre>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">수신자 (고객사)</p>
              <p className="mt-1 text-sm text-foreground">{initial.templateContext.clientName}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">확인 요청 거래</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>거래일</TableHead>
                <TableHead>거래처</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead>담당자 질문</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground">{row.sourceDisplayDate ?? '-'}</TableCell>
                  <TableCell className="text-xs text-foreground">{row.sourceDisplayCounterparty ?? '-'}</TableCell>
                  <TableCell className="text-right text-xs text-foreground">
                    {row.sourceDisplayAmountKrw != null ? `${row.sourceDisplayAmountKrw.toLocaleString()}원` : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-foreground">{row.staffQuestion}</TableCell>
                  <TableCell>
                    <Badge variant="info">{ROW_STATUS_LABEL[row.status] ?? row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!isSent && (
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={handleSend} disabled={sending || saving}>
            {sending ? '발송 중...' : '확인 요청 메일 발송'}
          </Button>
        </div>
      )}
    </div>
  )
}
