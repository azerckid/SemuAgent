'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { DeleteConfirmDialog } from '@/app/(dashboard)/dashboard/_components/delete-confirm-dialog'
import { Button } from '@/components/ui/button'
// 기본 탭(bulk)과 즉시 필요한 createDefaultTemplateDraft 헬퍼만 정적 import.
import { BulkSendConsole, createDefaultTemplateDraft } from './bulk-send-console'

// 비활성 탭 패널은 해당 탭을 열 때만 로드해 초기 JS를 줄인다(next/dynamic, SSR 유지).
const panelLoading = () => (
  <p className="px-1 py-6 text-sm text-muted-foreground">불러오는 중…</p>
)
const InboundMailboxPanel = dynamic(
  () => import('./inbound-mailbox-panel').then((m) => m.InboundMailboxPanel),
  { loading: panelLoading },
)
const MailHistoryPanel = dynamic(
  () => import('./mail-history-panel').then((m) => m.MailHistoryPanel),
  { loading: panelLoading },
)
const MailTemplateLibrary = dynamic(
  () => import('./mail-template-library').then((m) => m.MailTemplateLibrary),
  { loading: panelLoading },
)
const WorkEmailAddressesPanel = dynamic(
  () => import('./work-email-addresses-panel').then((m) => m.WorkEmailAddressesPanel),
  { loading: panelLoading },
)
const WorkEmailComposePanel = dynamic(
  () => import('./work-email-compose-panel').then((m) => m.WorkEmailComposePanel),
  { loading: panelLoading },
)
import type {
  InboundMailClientOption,
  InboundMailRow,
  MailConsoleClient,
  MailConsoleTemplateDraft,
  MailHistoryRow,
  MailTemplateRow,
  WorkEmailAddressRow,
  WorkEmailInternalCcGroupOption,
  WorkEmailStaffOption,
} from './mail-console-types'
import {
  getSystemMailTemplate,
  type MailTemplateWorkType,
  type SystemMailTemplate,
} from '@/lib/mail-console/default-templates'
import {
  type MailWorkspaceTab,
  mailWorkspaceTabHref,
  parseMailWorkspaceTab,
} from '@/lib/mail-console/mail-workspace-tab'

interface EmailWorkspaceProps {
  history: MailHistoryRow[]
  historyPagination: {
    page: number
    pageSize: number
    total: number
    sentCount: number
    failedCount: number
  }
  templates: MailTemplateRow[]
  clients: MailConsoleClient[]
  inboundEmails: InboundMailRow[]
  inboundLabelClients: InboundMailClientOption[]
  workEmailAddresses: WorkEmailAddressRow[]
  workEmailStaffOptions: WorkEmailStaffOption[]
  sendableAddresses: WorkEmailAddressRow[]
  internalCcGroups: WorkEmailInternalCcGroupOption[]
  currentStaffId: string | null
  isAdmin: boolean
}

export function EmailWorkspace({
  history,
  historyPagination,
  templates,
  clients,
  inboundEmails,
  inboundLabelClients,
  workEmailAddresses,
  workEmailStaffOptions,
  sendableAddresses,
  internalCcGroups,
  currentStaffId,
  isAdmin,
}: EmailWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = parseMailWorkspaceTab(searchParams.get('tab'))

  const [templateDraft, setTemplateDraft] = useState<MailConsoleTemplateDraft>(() => createDefaultTemplateDraft())
  const [templateRows, setTemplateRows] = useState<MailTemplateRow[]>(templates)
  const [isDraftDirty, setIsDraftDirty] = useState(false)
  const [templateNotice, setTemplateNotice] = useState<string | null>(null)
  const [saveDraftSignal, setSaveDraftSignal] = useState(0)
  const [bulkResetSignal, setBulkResetSignal] = useState(0)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const navigateTab = (tab: MailWorkspaceTab) => {
    router.push(mailWorkspaceTabHref(tab))
  }

  const draftFromTemplate = (
    template: MailTemplateRow | SystemMailTemplate,
    current: MailConsoleTemplateDraft,
  ): MailConsoleTemplateDraft => ({
    requestTemplateId: 'emailSubjectTemplate' in template ? template.id : null,
    appliedTemplateId: template.id,
    workType: template.workType ?? current.workType,
    frequency: template.frequency === 'custom' ? 'custom' : 'monthly',
    accountingPeriod: current.accountingPeriod,
    dueDate: current.dueDate,
    subject: 'emailSubjectTemplate' in template ? template.emailSubjectTemplate : template.subject,
    body: 'emailBodyTemplate' in template ? template.emailBodyTemplate : template.body,
    analysisCriteriaSnapshot:
      'analysisCriteriaTemplate' in template ? template.analysisCriteriaTemplate : null,
  })

  const preferredTemplateForWorkType = (workType: MailTemplateWorkType) => (
    templateRows.find((template) =>
      template.isActive
      && template.clientName === null
      && template.workType === workType
      && template.isDefaultForWorkType
    ) ?? getSystemMailTemplate(workType)
  )

  const applyTemplate = (template: MailTemplateRow | SystemMailTemplate) => {
    setTemplateDraft((current) => draftFromTemplate(template, current))
    setIsDraftDirty(false)
    setTemplateNotice(null)
    navigateTab('bulk')
  }

  const handleTemplateDraftChange = (
    nextDraft: MailConsoleTemplateDraft,
    options?: { dirty?: boolean },
  ) => {
    setTemplateDraft(nextDraft)
    if (options?.dirty !== false) {
      setIsDraftDirty(true)
      setTemplateNotice('제목/본문 수정은 이번 발송에만 적용됩니다.')
    }
  }

  const handleWorkTypeChange = (workType: MailTemplateWorkType) => {
    if (isDraftDirty) {
      setTemplateDraft((current) => ({
        ...current,
        workType,
        requestTemplateId: null,
        appliedTemplateId: null,
        analysisCriteriaSnapshot: null,
      }))
      setTemplateNotice('제목/본문을 직접 수정한 상태라 자동으로 덮어쓰지 않았습니다. 기본 문구 적용을 누르면 선택한 업무유형 문구로 바뀝니다.')
      return
    }

    const template = preferredTemplateForWorkType(workType)
    setTemplateDraft((current) => draftFromTemplate(template, current))
    setTemplateNotice(null)
  }

  const applyWorkTypeDefault = () => {
    const template = preferredTemplateForWorkType(templateDraft.workType)
    setTemplateDraft((current) => draftFromTemplate(template, current))
    setIsDraftDirty(false)
    setTemplateNotice(null)
  }

  const updateTemplateRows = (nextTemplate: MailTemplateRow) => {
    setTemplateRows((current) => {
      const withoutOld = current.filter((template) => template.id !== nextTemplate.id)
      const normalized = nextTemplate.isDefaultForWorkType
        ? withoutOld.map((template) => (
            template.clientName === null && template.workType === nextTemplate.workType
              ? { ...template, isDefaultForWorkType: false }
              : template
          ))
        : withoutOld
      return [nextTemplate, ...normalized]
    })
  }

  const saveCurrentTemplate = () => {
    navigateTab('templates')
    setTemplateNotice(null)
    setSaveDraftSignal((current) => current + 1)
  }

  const resetBulkSend = () => {
    setTemplateDraft(createDefaultTemplateDraft())
    setIsDraftDirty(false)
    setTemplateNotice(null)
    setBulkResetSignal((current) => current + 1)
    setShowResetConfirm(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {activeTab === 'bulk' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            일괄 발송은 담당자 최종 확인 후 실행됩니다.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowResetConfirm(true)}>
            발송 준비 초기화
          </Button>
        </div>
      ) : null}

      <DeleteConfirmDialog
        open={showResetConfirm}
        title="발송 준비를 초기화할까요?"
        description={'작성 중인 제목과 본문, 선택한 고객사, 미리보기 확인 상태가 모두 초기화됩니다.\n저장된 템플릿이나 고객사 데이터는 삭제되지 않습니다.'}
        confirmLabel="초기화"
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={resetBulkSend}
      />

      {activeTab === 'bulk' && (
        <BulkSendConsole
          key={bulkResetSignal}
          clients={clients}
          templateDraft={templateDraft}
          onTemplateDraftChange={handleTemplateDraftChange}
          isDraftDirty={isDraftDirty}
          templateNotice={templateNotice}
          templates={templateRows}
          onWorkTypeChange={handleWorkTypeChange}
          onApplyTemplate={applyTemplate}
          onApplyWorkTypeDefault={applyWorkTypeDefault}
          onSaveCurrentTemplate={saveCurrentTemplate}
          onViewHistory={() => navigateTab('history')}
        />
      )}

      {activeTab === 'templates' && (
        <MailTemplateLibrary
          templates={templateRows}
          currentDraft={templateDraft}
          saveDraftSignal={saveDraftSignal}
          onApplyTemplate={applyTemplate}
          onTemplateSaved={updateTemplateRows}
          onTemplateDeleted={updateTemplateRows}
        />
      )}

      {activeTab === 'history' && (
        <MailHistoryPanel history={history} pagination={historyPagination} />
      )}

      {activeTab === 'inbox' && (
        <InboundMailboxPanel emails={inboundEmails} clients={inboundLabelClients} />
      )}

      {activeTab === 'compose' && (
        <WorkEmailComposePanel
          addresses={sendableAddresses}
          currentStaffId={currentStaffId}
          clients={clients}
          internalCcGroups={internalCcGroups}
        />
      )}

      {activeTab === 'addresses' && (
        <WorkEmailAddressesPanel
          addresses={workEmailAddresses}
          staffOptions={workEmailStaffOptions}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
