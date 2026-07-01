'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTimeSlash } from '@/lib/client-format'
import { consoleBadgeClass, consoleCardDescriptionClass, consoleCardTitleClass } from './mail-console-styles'
import type {
  InboundMailAttachment,
  InboundMailClientOption,
  InboundMailDetail,
  InboundMailRow,
} from './mail-console-types'

interface InboundMailboxPanelProps {
  emails: InboundMailRow[]
  clients: InboundMailClientOption[]
}

type DisplayStatus = 'received' | 'labeled' | 'held'

function displayStatus(row: { processingStatus: InboundMailRow['processingStatus']; clientLabelId: string | null }): DisplayStatus {
  if (row.processingStatus === 'held') return 'held'
  if (row.clientLabelId) return 'labeled'
  return 'received'
}

function statusBadge(status: DisplayStatus) {
  if (status === 'labeled') {
    return <Badge variant="success" className={consoleBadgeClass}>라벨됨</Badge>
  }
  if (status === 'held') {
    return <Badge variant="secondary" className={consoleBadgeClass}>보류</Badge>
  }
  return <Badge variant="info" className={consoleBadgeClass}>보관됨</Badge>
}

function directionBadge(direction: InboundMailRow['direction']) {
  return direction === 'outbound'
    ? <Badge variant="success" className={consoleBadgeClass}>보냄</Badge>
    : <Badge variant="info" className={consoleBadgeClass}>받음</Badge>
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function htmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function attachmentStatusText(status: InboundMailAttachment['status']) {
  if (status === 'ignored') return '보류'
  if (status === 'failed') return '저장 실패'
  return '저장됨'
}

export function InboundMailboxPanel({ emails: initialEmails, clients }: InboundMailboxPanelProps) {
  const [emails, setEmails] = useState<InboundMailRow[]>(initialEmails)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<InboundMailDetail | null>(null)
  const [detailAttachments, setDetailAttachments] = useState<InboundMailAttachment[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const heldCount = emails.filter((row) => row.processingStatus === 'held').length
  const labeledCount = emails.filter((row) => row.clientLabelId).length

  const selectEmail = async (id: string) => {
    setSelectedId(id)
    setActionError(null)
    setDetailLoading(true)
    const res = await fetch(`/api/inbound-emails/${id}`)
    setDetailLoading(false)
    if (!res.ok) {
      setDetail(null)
      setDetailAttachments([])
      return
    }
    const data = await res.json()
    setDetail(data.email as InboundMailDetail)
    setDetailAttachments(data.attachments ?? [])
  }

  const applyEmailPatch = (id: string, patch: Partial<InboundMailRow>) => {
    setEmails((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    setDetail((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev))
  }

  const runAction = async (id: string, body: Record<string, unknown>, patch: Partial<InboundMailRow>) => {
    setActionLoading(true)
    setActionError(null)
    const res = await fetch(`/api/inbound-emails/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setActionLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setActionError(typeof data.error === 'string' ? data.error : '처리에 실패했습니다')
      return
    }
    applyEmailPatch(id, patch)
  }

  const handleLabelChange = (id: string, clientLabelId: string) => {
    const value = clientLabelId || null
    const clientLabelName = value ? clients.find((c) => c.id === value)?.name ?? null : null
    runAction(id, { action: 'set_label', clientLabelId: value }, { clientLabelId: value, clientLabelName })
  }

  const handleHoldToggle = (id: string, currentlyHeld: boolean) => {
    runAction(
      id,
      { action: currentlyHeld ? 'unhold' : 'hold' },
      { processingStatus: currentlyHeld ? 'stored' : 'held' },
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className={consoleCardTitleClass}>메일함</CardTitle>
              <CardDescription className={consoleCardDescriptionClass}>
                업무 메일주소로 받은/보낸 메일을 한 곳에서 봅니다. 고객사 라벨은 자동으로 붙지 않습니다.
              </CardDescription>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant="success" className={consoleBadgeClass}>라벨됨 {labeledCount}</Badge>
              <Badge variant={heldCount > 0 ? 'secondary' : 'secondary'} className={consoleBadgeClass}>
                보류 {heldCount}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {emails.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
              <p className="text-sm font-semibold text-foreground">아직 받은 업무 메일이 없습니다</p>
              <p className="mt-1 text-xs text-muted-foreground">
                담당직원 메일함으로 메일이 도착하면 이 탭에 표시됩니다.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>방향</TableHead>
                  <TableHead>발신/수신</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead>시각</TableHead>
                  <TableHead>첨부</TableHead>
                  <TableHead>고객사 라벨</TableHead>
                  <TableHead className="text-right">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`cursor-pointer ${selectedId === row.id ? 'bg-muted/50' : ''}`}
                    onClick={() => selectEmail(row.id)}
                  >
                    <TableCell>{directionBadge(row.direction)}</TableCell>
                    <TableCell>
                      <div className="max-w-[220px] truncate text-xs text-foreground">{row.fromEmail ?? '발신자 미확인'}</div>
                      <div className="max-w-[220px] truncate text-xs text-muted-foreground">→ {row.toEmail}</div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[240px] truncate text-sm text-foreground">{row.subject ?? '(제목 없음)'}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.receivedAt ? formatDateTimeSlash(row.receivedAt) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.attachmentCount > 0 ? `${row.attachmentCount}건` : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {row.clientLabelName ?? <span className="text-muted-foreground">미지정</span>}
                    </TableCell>
                    <TableCell className="text-right">{statusBadge(displayStatus(row))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={consoleCardTitleClass}>메일 상세</CardTitle>
          <CardDescription className={consoleCardDescriptionClass}>
            목록에서 메일을 선택하면 발신/수신 정보와 담당자 액션을 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedId ? (
            <p className="text-sm text-muted-foreground">왼쪽 목록에서 메일을 선택해 주세요.</p>
          ) : detailLoading ? (
            <p className="text-sm text-muted-foreground">불러오는 중입니다...</p>
          ) : !detail ? (
            <p className="text-sm text-muted-foreground">메일을 불러올 수 없습니다.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-foreground">{detail.subject ?? '(제목 없음)'}</div>
                  {directionBadge(detail.direction)}
                </div>
                <div className="text-xs text-muted-foreground">발신: {detail.fromEmail ?? '발신자 미확인'}</div>
                <div className="text-xs text-muted-foreground">수신: {detail.toEmail}</div>
                {detail.ccEmail && <div className="text-xs text-muted-foreground">CC: {detail.ccEmail}</div>}
                <div className="text-xs text-muted-foreground">
                  {detail.receivedAt ? formatDateTimeSlash(detail.receivedAt) : '-'}
                </div>
              </div>

              <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
                {detail.textBody
                  ?? (detail.htmlBody ? htmlToPlainText(detail.htmlBody) : null)
                  ?? '본문은 아직 저장되지 않았습니다.'}
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-muted-foreground">첨부 파일</div>
                {detailAttachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">첨부 파일이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {detailAttachments.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-2 py-1.5 text-xs text-foreground">
                        <span className="min-w-0">
                          <span className="block truncate">{file.originalFilename ?? '(파일명 없음)'}</span>
                          <span className="text-muted-foreground">
                            {[formatFileSize(file.fileSize), attachmentStatusText(file.status)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {file.downloadReady ? (
                          <a
                            href={`/api/inbound-emails/${detail.id}/attachments/${file.id}/download`}
                            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'h-7 shrink-0 text-xs' })}
                          >
                            다운로드
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-xs font-bold text-muted-foreground">고객사 라벨</div>
                <Select
                  value={detail.clientLabelId ?? ''}
                  disabled={actionLoading}
                  onChange={(e) => handleLabelChange(detail.id, e.target.value)}
                >
                  <option value="">미지정</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => handleHoldToggle(detail.id, detail.processingStatus === 'held')}
                >
                  {detail.processingStatus === 'held' ? '보류 해제' : '보류 처리'}
                </Button>

                {actionError && <p className="text-xs text-destructive">{actionError}</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
