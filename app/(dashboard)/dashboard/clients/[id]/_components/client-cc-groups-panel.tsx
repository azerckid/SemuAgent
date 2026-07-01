'use client'

import { type FormEvent, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DeleteConfirmDialog } from '@/app/(dashboard)/dashboard/_components/delete-confirm-dialog'

type CcGroupPurpose = 'general' | 'payroll' | 'all'

type ClientCcGroup = {
  id: string
  name: string
  purpose: CcGroupPurpose
  emails: string
  isDefault: boolean
}

const PURPOSE_LABEL: Record<CcGroupPurpose, string> = {
  general: '기장',
  payroll: '급여',
  all: '공통',
}

const PURPOSE_VARIANT: Record<CcGroupPurpose, 'info' | 'success' | 'secondary'> = {
  general: 'info',
  payroll: 'success',
  all: 'secondary',
}

function splitEmails(emails: string) {
  return emails
    .split(/[;,\n]/)
    .map((email) => email.trim())
    .filter(Boolean)
}

export function ClientCcGroupsPanel({
  clientId,
  groups,
  defaultExpanded = false,
}: {
  clientId: string
  groups: ClientCcGroup[]
  defaultExpanded?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: '',
    purpose: 'general' as CcGroupPurpose,
    emails: '',
    isDefault: false,
  })
  const [showGroups, setShowGroups] = useState(defaultExpanded)
  const [showForm, setShowForm] = useState(false)
  const [viewTarget, setViewTarget] = useState<ClientCcGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientCcGroup | null>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)

  const createGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const res = await fetch(`/api/clients/${clientId}/cc-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error ?? '참조 그룹 저장에 실패했습니다')
      return
    }

    toast.success('참조 그룹을 저장했습니다')
    setForm({ name: '', purpose: 'general', emails: '', isDefault: false })
    setShowGroups(true)
    setShowForm(false)
    startTransition(() => router.refresh())
  }

  const deleteGroup = async () => {
    if (!deleteTarget) return

    setDeletingGroupId(deleteTarget.id)
    try {
      const res = await fetch(`/api/clients/${clientId}/cc-groups/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? '참조 그룹 삭제에 실패했습니다')
        return
      }

      toast.success('참조 그룹을 삭제했습니다')
      setDeleteTarget(null)
      startTransition(() => router.refresh())
    } catch {
      toast.error('네트워크 오류가 발생했습니다')
    } finally {
      setDeletingGroupId(null)
    }
  }

  const isExpanded = showGroups || showForm

  function togglePanel() {
    if (isExpanded) {
      setShowGroups(false)
      setShowForm(false)
      return
    }

    setShowGroups(true)
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={togglePanel}
          >
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-950">참조 그룹</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {groups.length}개 등록
              </span>
            </span>
          </button>
          <Button type="button" variant="ghost" size="sm" onClick={togglePanel}>
            {isExpanded ? '접기' : '펼치기'}
          </Button>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          요청 메일에 함께 들어갈 CC 묶음입니다.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowForm((current) => !current)
              setShowGroups(true)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            추가
          </Button>
        </div>
      </div>

      {isExpanded ? (
        <div className="space-y-3 border-t border-gray-100 p-3">
          {showGroups ? (
            <div className="space-y-2">
              {groups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                  등록된 참조 그룹이 없습니다.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="grid grid-cols-[minmax(0,1fr)_64px_88px] gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                    <span>그룹명</span>
                    <span className="text-right">이메일</span>
                    <span className="text-right">액션</span>
                  </div>
                  {groups.map((group) => {
                    const emailCount = splitEmails(group.emails).length

                    return (
                      <div key={group.id} className="grid grid-cols-[minmax(0,1fr)_64px_88px] items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-sm font-medium text-gray-900">{group.name}</p>
                            {group.isDefault && <Badge variant="outline">기본</Badge>}
                          </div>
                        </div>
                        <div className="text-right text-xs font-medium text-gray-600">{emailCount}명</div>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setViewTarget(group)}
                          >
                            보기
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`${group.name} 삭제`}
                            disabled={isPending || deletingGroupId !== null}
                            onClick={() => setDeleteTarget(group)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {showForm ? (
            <form onSubmit={createGroup} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div>
                <label className="block text-xs font-medium text-gray-600">그룹명</label>
                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="예: HR 기본"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">용도</label>
                  <Select
                    value={form.purpose}
                    onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value as CcGroupPurpose }))}
                    className="mt-1"
                  >
                    <option value="general">기장</option>
                    <option value="payroll">급여</option>
                    <option value="all">공통</option>
                  </Select>
                </div>
                <label className="mt-6 inline-flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) => setForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                  기본
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">참조 이메일</label>
                <textarea
                  required
                  maxLength={1000}
                  rows={3}
                  value={form.emails}
                  onChange={(event) => setForm((prev) => ({ ...prev, emails: event.target.value }))}
                  placeholder="hr@example.com, manager@example.com"
                  className="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">쉼표, 세미콜론, 줄바꿈으로 여러 명을 입력할 수 있습니다.</p>
              </div>
              <Button type="submit" size="sm" disabled={isPending} className="w-full">
                참조 그룹 저장
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {viewTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewTarget(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-group-view-title"
            className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="cc-group-view-title" className="text-base font-semibold text-foreground">
                  {viewTarget.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant={PURPOSE_VARIANT[viewTarget.purpose]}>{PURPOSE_LABEL[viewTarget.purpose]}</Badge>
                  {viewTarget.isDefault && <Badge variant="outline">기본</Badge>}
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setViewTarget(null)}>
                닫기
              </Button>
            </div>
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500">참조 이메일</p>
              <div className="mt-2 space-y-1.5">
                {splitEmails(viewTarget.emails).map((email) => (
                  <p key={email} className="break-all text-sm text-gray-900">{email}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        title="참조 그룹을 삭제할까요?"
        description={`${deleteTarget?.name ?? '이 참조 그룹'}을 삭제합니다.\n이미 생성된 요청 메일의 참조 스냅샷은 유지됩니다.\n앞으로 새 요청 생성 시에는 이 그룹을 선택할 수 없습니다.`}
        loading={deleteTarget !== null && deletingGroupId === deleteTarget.id}
        onCancel={() => {
          if (deletingGroupId === null) setDeleteTarget(null)
        }}
        onConfirm={deleteGroup}
      />
    </section>
  )
}
