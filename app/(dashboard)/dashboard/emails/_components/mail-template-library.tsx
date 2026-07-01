'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  SYSTEM_MAIL_TEMPLATES,
  type MailTemplateWorkType,
  type SystemMailTemplate,
} from '@/lib/mail-console/default-templates'
import { formatDateISO } from '@/lib/client-format'
import {
  consoleBadgeClass,
  consoleCardDescriptionClass,
  consoleCardTitleClass,
  consoleFieldLabelClass,
} from './mail-console-styles'
import type { MailConsoleTemplateDraft, MailTemplateFrequency, MailTemplateRow } from './mail-console-types'

interface MailTemplateLibraryProps {
  templates: MailTemplateRow[]
  currentDraft: MailConsoleTemplateDraft
  saveDraftSignal: number
  onApplyTemplate: (template: MailTemplateRow | SystemMailTemplate) => void
  onTemplateSaved: (template: MailTemplateRow) => void
  onTemplateDeleted: (template: MailTemplateRow) => void
}

type TemplateFormState = {
  mode: 'create' | 'edit'
  id?: string
  name: string
  frequency: MailTemplateFrequency
  subject: string
  body: string
}

const FREQUENCY_LABEL: Record<MailTemplateFrequency, string> = {
  monthly: '정기',
  quarterly: '정기',
  semiannual: '정기',
  annual: '정기',
  custom: '비정기',
}

function formatUpdatedAt(value: string) {
  return formatDateISO(value)
}

function formFromSystemTemplate(template: SystemMailTemplate): TemplateFormState {
  return {
    mode: 'create',
    name: template.name.replace(' 기본 템플릿', ''),
    frequency: template.frequency,
    subject: template.subject,
    body: template.body,
  }
}

function formFromTemplate(template: MailTemplateRow): TemplateFormState {
  return {
    mode: 'edit',
    id: template.id,
    name: template.name,
    frequency: template.frequency,
    subject: template.emailSubjectTemplate,
    body: template.emailBodyTemplate,
  }
}

function formFromDraft(draft: MailConsoleTemplateDraft): TemplateFormState {
  return {
    mode: 'create',
    name: '새 템플릿',
    frequency: draft.frequency,
    subject: draft.subject,
    body: draft.body,
  }
}

export function MailTemplateLibrary({
  templates,
  currentDraft,
  saveDraftSignal,
  onApplyTemplate,
  onTemplateSaved,
  onTemplateDeleted,
}: MailTemplateLibraryProps) {
  const [form, setForm] = useState<TemplateFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastSaveDraftSignal = useRef(saveDraftSignal)

  const activeTemplates = templates.filter((template) => template.isActive)
  const inactiveCount = templates.length - activeTemplates.length

  useEffect(() => {
    if (saveDraftSignal === 0 || saveDraftSignal === lastSaveDraftSignal.current) return
    lastSaveDraftSignal.current = saveDraftSignal
    setForm(formFromDraft(currentDraft))
    setError(null)
  }, [currentDraft, saveDraftSignal])

  const saveTemplate = async () => {
    if (!form || saving) return
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(
        form.mode === 'edit' && form.id ? `/api/request-templates/${form.id}` : '/api/request-templates',
        {
          method: form.mode === 'edit' ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            clientId: null,
            name: form.name,
            frequency: form.frequency,
            emailSubjectTemplate: form.subject,
            emailBodyTemplate: form.body,
            isDefaultForWorkType: false,
            isActive: true,
          }),
        },
      )
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.template) {
        setError(data?.error ?? '템플릿 저장에 실패했습니다.')
        return
      }

      onTemplateSaved(data.template as MailTemplateRow)
      setForm(null)
    } catch (err) {
      console.error('[MailTemplateLibrary] save failed', err)
      setError('네트워크 오류로 템플릿 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = async (template: MailTemplateRow) => {
    if (deletingId) return
    setDeletingId(template.id)
    setError(null)

    try {
      const response = await fetch(`/api/request-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: false, isDefaultForWorkType: false }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.template) {
        setError(data?.error ?? '템플릿 삭제에 실패했습니다.')
        return
      }

      onTemplateDeleted(data.template as MailTemplateRow)
      if (form?.id === template.id) setForm(null)
    } catch (err) {
      console.error('[MailTemplateLibrary] delete failed', err)
      setError('네트워크 오류로 템플릿 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className={consoleCardTitleClass}>템플릿 관리</CardTitle>
            <CardDescription className={consoleCardDescriptionClass}>
              기본 제공 템플릿과 우리 사무소 저장 템플릿을 작성 폼에 적용합니다.
            </CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant="info" className={consoleBadgeClass}>기본 {SYSTEM_MAIL_TEMPLATES.length}</Badge>
            <Badge variant="success" className={consoleBadgeClass}>저장 {activeTemplates.length}</Badge>
            {inactiveCount > 0 && (
              <Badge variant="secondary" className={consoleBadgeClass}>비활성 {inactiveCount}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setForm(formFromDraft(currentDraft))}>
              현재 문구 저장
            </Button>
            <Button type="button" onClick={() => setForm(formFromDraft(currentDraft))}>
              새 템플릿 추가
            </Button>
          </div>

          {form && (
            <TemplateEditor
              form={form}
              saving={saving}
              error={error}
              onChange={setForm}
              onCancel={() => {
                setForm(null)
                setError(null)
              }}
              onSave={saveTemplate}
            />
          )}

          <TemplateGroup title="기본 제공 템플릿">
            {SYSTEM_MAIL_TEMPLATES.map((template) => (
              <TemplateCard
                key={template.id}
                title={template.name}
                workType={template.workType}
                subject={template.subject}
                body={template.body}
                sourceLabel="기본 제공"
                frequencyLabel={FREQUENCY_LABEL[template.frequency]}
                onApply={() => onApplyTemplate(template)}
                onEdit={() => setForm(formFromSystemTemplate(template))}
              />
            ))}
          </TemplateGroup>

          <TemplateGroup title="저장한 템플릿">
            {activeTemplates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-sm font-semibold text-foreground">아직 저장된 템플릿이 없습니다</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  기본 제공 템플릿을 수정해 저장하거나 새 템플릿을 추가하세요.
                </p>
              </div>
            ) : (
              activeTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  title={template.name}
                  subject={template.emailSubjectTemplate}
                  body={template.emailBodyTemplate}
                  sourceLabel={template.clientName ? `고객사별 · ${template.clientName}` : '우리 사무소'}
                  frequencyLabel={FREQUENCY_LABEL[template.frequency]}
                  isActive={template.isActive}
                  deleting={deletingId === template.id}
                  updatedAt={formatUpdatedAt(template.updatedAt || template.createdAt)}
                  onApply={() => onApplyTemplate(template)}
                  onEdit={() => setForm(formFromTemplate(template))}
                  onDelete={() => deleteTemplate(template)}
                />
              ))
            )}
          </TemplateGroup>
        </CardContent>
      </Card>
    </div>
  )
}

function TemplateEditor({
  form,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  form: TemplateFormState
  saving: boolean
  error: string | null
  onChange: (next: TemplateFormState) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {form.mode === 'edit' ? '템플릿 수정' : '템플릿 추가'}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>취소</Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={saving || !form.name.trim() || !form.subject.trim() || !form.body.trim()}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
        <label className="grid gap-1.5">
          <span className={consoleFieldLabelClass}>템플릿명</span>
          <Input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
        </label>
        <label className="grid gap-1.5">
          <span className={consoleFieldLabelClass}>정기/비정기</span>
          <Select
            value={form.frequency === 'custom' ? 'custom' : 'monthly'}
            onChange={(event) => onChange({
              ...form,
              frequency: event.target.value === 'custom' ? 'custom' : 'monthly',
            })}
          >
            <option value="monthly">정기</option>
            <option value="custom">비정기</option>
          </Select>
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className={consoleFieldLabelClass}>제목</span>
        <Input value={form.subject} onChange={(event) => onChange({ ...form, subject: event.target.value })} />
      </label>

      <label className="grid gap-1.5">
        <span className={consoleFieldLabelClass}>본문</span>
        <Textarea
          rows={8}
          value={form.body}
          onChange={(event) => onChange({ ...form, body: event.target.value })}
          className="min-h-[180px] resize-y leading-6"
        />
      </label>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function TemplateGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  )
}

function TemplateCard({
  title,
  workType,
  subject,
  body,
  sourceLabel,
  frequencyLabel,
  isActive = true,
  deleting = false,
  updatedAt,
  onApply,
  onEdit,
  onDelete,
}: {
  title: string
  workType?: MailTemplateWorkType
  subject: string
  body: string
  sourceLabel: string
  frequencyLabel?: string
  isActive?: boolean
  deleting?: boolean
  updatedAt?: string
  onApply: () => void
  onEdit: () => void
  onDelete?: () => void
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-background p-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{title}</p>
          {workType && <Badge variant="outline" className={consoleBadgeClass}>기본업무유형</Badge>}
          <Badge variant="info" className={consoleBadgeClass}>{sourceLabel}</Badge>
          {frequencyLabel && <Badge variant="outline" className={consoleBadgeClass}>{frequencyLabel}</Badge>}
          {!isActive && <Badge variant="secondary" className={consoleBadgeClass}>비활성</Badge>}
        </div>
        <p className="truncate text-sm font-medium text-foreground">{subject}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{body}</p>
        {updatedAt && <p className="mt-2 text-xs text-muted-foreground">업데이트 {updatedAt}</p>}
      </div>
      <div className="flex items-start justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>수정</Button>
        {onDelete && (
          <Button type="button" variant="outline" size="sm" disabled={deleting} onClick={onDelete}>
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        )}
        <Button type="button" size="sm" disabled={!isActive} onClick={onApply}>
          작성 폼에 적용
        </Button>
      </div>
    </div>
  )
}
