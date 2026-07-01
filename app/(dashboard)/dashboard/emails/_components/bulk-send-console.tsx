'use client'

import Link from 'next/link'
import { ListChecks, ListX } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { ClientSelectionTable } from './client-selection-table'
import { applyCcSelectionsToClients, buildDefaultCcSelections } from './mail-client-cc'
import { MailPreviewPanel } from './mail-preview-panel'
import {
  consoleBadgeClass,
  consoleCardDescriptionClass,
  consoleCardTitleClass,
} from './mail-console-styles'
import { countUnresolvedTokens } from './mail-preview-utils'
import type { MailConsoleClient, MailConsoleTemplateDraft, MailTemplateRow } from './mail-console-types'
import { TemplateComposer } from './template-composer'
import { getSystemMailTemplate, type SystemMailTemplate } from '@/lib/mail-console/default-templates'
import { nowYearMonth } from '@/lib/client-format'

const defaultSystemTemplate = getSystemMailTemplate('bookkeeping')
const DEFAULT_DUE_DAY = 23

export function createDefaultTemplateDraft(): MailConsoleTemplateDraft {
  const yearMonth = nowYearMonth()
  const dueDate = `${yearMonth}-${String(DEFAULT_DUE_DAY).padStart(2, '0')}`

  return {
    requestTemplateId: null,
    appliedTemplateId: defaultSystemTemplate.id,
    workType: defaultSystemTemplate.workType,
    frequency: defaultSystemTemplate.frequency,
    accountingPeriod: yearMonth,
    dueDate,
    subject: defaultSystemTemplate.subject,
    body: defaultSystemTemplate.body,
    analysisCriteriaSnapshot: null,
  }
}

type BulkSendResult = {
  clientId: string
  clientName: string
  status: 'success' | 'failed'
  eventId?: string
  sessionId?: string
  sessionPath?: string
  error?: string
}

type BulkSendResponse = {
  ok: boolean
  summary: { total: number; successCount: number; failureCount: number }
  results: BulkSendResult[]
}

type ApiErrorResponse = {
  error?: string
  details?: {
    fieldErrors?: Record<string, string[] | undefined>
    formErrors?: string[]
  }
}

type CcSelectionState = {
  clientKey: string
  workType: MailConsoleTemplateDraft['workType']
  values: Record<string, string | null>
}

export function BulkSendConsole({
  clients,
  templateDraft,
  onTemplateDraftChange,
  isDraftDirty,
  templateNotice,
  templates,
  onWorkTypeChange,
  onApplyTemplate,
  onApplyWorkTypeDefault,
  onSaveCurrentTemplate,
  onViewHistory,
}: {
  clients: MailConsoleClient[]
  templateDraft: MailConsoleTemplateDraft
  onTemplateDraftChange: (nextDraft: MailConsoleTemplateDraft, options?: { dirty?: boolean }) => void
  isDraftDirty: boolean
  templateNotice: string | null
  templates: MailTemplateRow[]
  onWorkTypeChange: (workType: MailConsoleTemplateDraft['workType']) => void
  onApplyTemplate: (template: MailTemplateRow | SystemMailTemplate) => void
  onApplyWorkTypeDefault: () => void
  onSaveCurrentTemplate: () => void
  onViewHistory: () => void
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [previewClientId, setPreviewClientId] = useState(clients[0]?.id ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendResponse, setSendResponse] = useState<BulkSendResponse | null>(null)
  const clientKey = useMemo(() => clients.map((client) => client.id).join('|'), [clients])
  const defaultCcSelections = useMemo(
    () => buildDefaultCcSelections(clients, templateDraft.workType),
    [clients, templateDraft.workType],
  )
  const [ccSelectionState, setCcSelectionState] = useState<CcSelectionState>(() => ({
    clientKey,
    workType: templateDraft.workType,
    values: defaultCcSelections,
  }))
  const ccSelections = (
    ccSelectionState.clientKey === clientKey
    && ccSelectionState.workType === templateDraft.workType
  )
    ? ccSelectionState.values
    : defaultCcSelections

  const displayClients = useMemo(
    () => applyCcSelectionsToClients(clients, templateDraft.workType, ccSelections),
    [clients, templateDraft.workType, ccSelections],
  )

  const selectedClients = useMemo(
    () => displayClients.filter((client) => selectedIds.includes(client.id)),
    [displayClients, selectedIds],
  )
  const selectableClientIds = useMemo(
    () => displayClients
      .filter((client) => client.sendReady !== 'blocked')
      .map((client) => client.id),
    [displayClients],
  )
  const selectedListedCount = useMemo(
    () => selectableClientIds.filter((clientId) => selectedIds.includes(clientId)).length,
    [selectableClientIds, selectedIds],
  )
  const allListedClientsSelected =
    selectableClientIds.length > 0 && selectedListedCount === selectableClientIds.length
  const toggleClient = (clientId: string) => {
    const targetClient = displayClients.find((client) => client.id === clientId)
    if (targetClient?.sendReady === 'blocked') return

    setSelectedIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId]
    )
    setConfirmed(false)
    setPreviewClientId(clientId)
  }

  const selectListedClients = () => {
    if (selectableClientIds.length === 0) return
    setSelectedIds(selectableClientIds)
    setConfirmed(false)
    if (!selectableClientIds.includes(previewClientId)) {
      setPreviewClientId(selectableClientIds[0] ?? '')
    }
  }

  const clearSelectedClients = () => {
    setSelectedIds([])
    setConfirmed(false)
  }

  const selectedPreviewClient =
    displayClients.find((client) => client.id === previewClientId) ?? displayClients[0]
  const unresolvedTokenCount = countUnresolvedTokens(templateDraft, selectedPreviewClient)
  const selectedBlockedCount = selectedClients.filter((client) => client.sendReady === 'blocked').length
  const canSend =
    selectedClients.length > 0
    && selectedBlockedCount === 0
    && unresolvedTokenCount === 0
    && confirmed
    && !sending

  const previewPanel = (
    <MailPreviewPanel
      clients={displayClients}
      client={selectedPreviewClient}
      templateDraft={templateDraft}
      onPreviewClientChange={setPreviewClientId}
    />
  )

  const handleBulkSend = async () => {
    if (!canSend) return
    setSending(true)
    setSendError(null)
    setSendResponse(null)

    try {
      const response = await fetch('/api/mail-console/bulk-send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestBatchId: crypto.randomUUID(),
          clientIds: selectedIds,
          clientCcSelections: selectedIds.map((clientId) => ({
            clientId,
            ccGroupId: ccSelections[clientId] ?? null,
          })),
          workType: templateDraft.workType,
          frequency: templateDraft.frequency,
          accountingPeriod: templateDraft.accountingPeriod,
          dueDate: templateDraft.dueDate,
          subject: templateDraft.subject,
          body: templateDraft.body,
          requestTemplateId: templateDraft.requestTemplateId ?? null,
          analysisCriteriaSnapshot: templateDraft.analysisCriteriaSnapshot ?? null,
          confirmed: true,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok && !data?.results) {
        const message = formatBulkSendError(data)
        setSendError(message)
        toast.error(message)
        return
      }

      const bulkSendResponse = data as BulkSendResponse
      setSendResponse(bulkSendResponse)
      if (bulkSendResponse.summary.failureCount > 0) {
        const firstFailure = bulkSendResponse.results.find((result) => result.status === 'failed')
        toast.error(firstFailure?.error ?? '일부 고객사 발송에 실패했습니다')
      } else {
        toast.success(`${bulkSendResponse.summary.successCount}건 발송되었습니다`)
      }
      setConfirmed(false)
      setSelectedIds((current) => {
        const sentClientIds = new Set(
          bulkSendResponse.results
            .filter((result) => result.status === 'success')
            .map((result) => result.clientId),
        )
        return current.filter((clientId) => !sentClientIds.has(clientId))
      })
      router.refresh()
    } catch (err) {
      console.error('[BulkSendConsole] bulk send failed', err)
      const message = '네트워크 오류로 대량 발송 요청에 실패했습니다'
      setSendError(message)
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className={consoleCardTitleClass}>1. 대상 고객사 선택</CardTitle>
            <CardDescription className={consoleCardDescriptionClass}>
              수신자와 CC 그룹을 확인하고 이번 발송 대상을 고릅니다.
            </CardDescription>
          </div>
          <Badge variant="success" className={consoleBadgeClass}>{selectedIds.length}개 선택</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              선택 가능 {selectableClientIds.length}개 · 현재 선택 {selectedIds.length}개
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={allListedClientsSelected || selectableClientIds.length === 0}
                onClick={selectListedClients}
              >
                <ListChecks className="size-3.5" aria-hidden="true" />
                현재 목록 전체 선택
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={selectedIds.length === 0}
                onClick={clearSelectedClients}
              >
                <ListX className="size-3.5" aria-hidden="true" />
                선택 해제
              </Button>
            </div>
          </div>
          <ClientSelectionTable
            clients={displayClients}
            selectedIds={selectedIds}
            previewClientId={previewClientId}
            ccSelections={ccSelections}
            onToggleClient={toggleClient}
            onPreviewClient={setPreviewClientId}
            onCcGroupChange={(clientId, ccGroupId) => {
              setCcSelectionState((current) => {
                const currentValues = (
                  current.clientKey === clientKey
                  && current.workType === templateDraft.workType
                )
                  ? current.values
                  : defaultCcSelections

                return {
                  clientKey,
                  workType: templateDraft.workType,
                  values: { ...currentValues, [clientId]: ccGroupId },
                }
              })
            }}
          />
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <TemplateComposer
          draft={templateDraft}
          isDraftDirty={isDraftDirty}
          templateNotice={templateNotice}
          templates={templates}
          onChange={onTemplateDraftChange}
          onWorkTypeChange={onWorkTypeChange}
          onApplyTemplate={onApplyTemplate}
          onApplyWorkTypeDefault={onApplyWorkTypeDefault}
          onSaveCurrentTemplate={onSaveCurrentTemplate}
        />

        {previewPanel}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className={consoleCardTitleClass}>4. 발송 전 확인</CardTitle>
          <CardDescription className={consoleCardDescriptionClass}>
            선택 고객사의 수신자, 식별자, 미리보기를 확인한 뒤 담당자가 직접 발송합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <CheckRow
              label="미치환 식별자"
              value={`${unresolvedTokenCount}개`}
              variant={unresolvedTokenCount > 0 ? 'warning' : 'success'}
            />
            <CheckRow label="수신자 누락" value={`${selectedBlockedCount}개`} variant={selectedBlockedCount > 0 ? 'destructive' : 'success'} />
          </div>
          <label className="flex gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 size-4 rounded border-border"
            />
            <span>
              선택한 {selectedClients.length}개 고객사의 수신자와 미리보기를 확인했으며 실제 메일 발송을 진행합니다.
            </span>
          </label>
          {sendError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {sendError}
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t border-border bg-muted/20 px-6 py-4">
          <Button className="min-w-48" disabled={!canSend} onClick={handleBulkSend}>
            {sending ? '발송 중...' : `${selectedClients.length}건 발송 확인`}
          </Button>
        </CardFooter>
      </Card>

      {sendResponse && (
        <BulkSendResultPanel response={sendResponse} onViewHistory={onViewHistory} />
      )}
    </div>
  )
}

function formatBulkSendError(data: unknown): string {
  const fallback = '대량 발송 요청에 실패했습니다'
  if (!data || typeof data !== 'object') return fallback

  const errorData = data as ApiErrorResponse
  const baseMessage = errorData.error ?? fallback
  const fieldMessages = Object.entries(errorData.details?.fieldErrors ?? {})
    .flatMap(([field, messages]) => (messages ?? []).map((message) => `${field}: ${message}`))
  const formMessages = errorData.details?.formErrors ?? []
  const detailMessages = [...fieldMessages, ...formMessages]

  return detailMessages.length > 0
    ? `${baseMessage} (${detailMessages.join(', ')})`
    : baseMessage
}

function CheckRow({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant: 'success' | 'warning' | 'destructive'
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={variant} className={consoleBadgeClass}>{value}</Badge>
    </div>
  )
}

function BulkSendResultPanel({
  response,
  onViewHistory,
}: {
  response: BulkSendResponse
  onViewHistory: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={consoleCardTitleClass}>발송 결과</CardTitle>
        <CardDescription className={consoleCardDescriptionClass}>
          성공 {response.summary.successCount}건, 실패 {response.summary.failureCount}건
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {response.results.map((result) => (
          <div
            key={`${result.clientId}-${result.eventId ?? result.status}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">{result.clientName}</p>
              {result.status === 'success' && result.sessionPath ? (
                <Link href={result.sessionPath} className="text-xs text-primary underline">
                  세션 상세 보기
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">{result.error ?? '발송 실패'}</p>
              )}
            </div>
            <Badge
              variant={result.status === 'success' ? 'success' : 'destructive'}
              className={consoleBadgeClass}
            >
              {result.status === 'success' ? '성공' : '실패'}
            </Badge>
          </div>
        ))}
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="outline" onClick={onViewHistory}>발송 이력 보기</Button>
      </CardFooter>
    </Card>
  )
}
