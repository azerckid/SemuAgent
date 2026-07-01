'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { DeleteConfirmDialog } from '@/app/(dashboard)/dashboard/_components/delete-confirm-dialog'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ClientRow } from './client-workspace-types'

interface StaffOption { id: string; name: string }
interface TemplateOption { id: string; name: string }
type StatusFilter = 'all' | 'mine' | 'attention'

const ANALYSIS_EXAMPLES = [
  { label: '경비 증빙', text: '5만원 이상 지출만 별도 확인해 주세요.\n카드 영수증과 현금영수증이 중복된 것으로 보이면 검토 필요로 표시해 주세요.' },
  { label: '계약서', text: '신규 거래처 계약서만 체크해 주세요.\n서명 또는 날인 페이지가 없으면 검토 필요로 표시해 주세요.' },
  { label: '통장', text: '법인 운영 계좌 자료만 필수로 판단해 주세요.\n요청 기간 전체 거래내역이 포함되어 있는지 확인해 주세요.' },
  { label: '카드매출', text: '승인일 기준으로 요청 기간 포함 여부를 판단해 주세요.\n취소 거래가 섞여 있으면 검토 필요로 표시해 주세요.' },
]

interface Props {
  initialClients: ClientRow[]
  staffList: StaffOption[]
  templates: TemplateOption[]
  currentStaffId: string | null
  query: string
  statusFilter: StatusFilter
  page: number
  pageSize: number
  totalClients: number
  rangeStart: number
}

function buildClientsHref(params: { q?: string; status?: StatusFilter; page?: number }) {
  const searchParams = new URLSearchParams()
  if (params.q) searchParams.set('q', params.q)
  if (params.status && params.status !== 'all') searchParams.set('status', params.status)
  if (params.page && params.page > 1) searchParams.set('page', String(params.page))
  const query = searchParams.toString()
  return query ? `/dashboard/clients?${query}` : '/dashboard/clients'
}

export function ClientManager({
  initialClients,
  staffList,
  templates,
  currentStaffId,
  query,
  statusFilter,
  page,
  pageSize,
  totalClients,
  rangeStart,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [editError, setEditError] = useState('')
  const [updatingClientId, setUpdatingClientId] = useState<string | null>(null)
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null)

  const [form, setForm] = useState({
    name: '',
    contactName: '',
    email: '',
    staffId: '',
    address: '',
    phone: '',
    analysisNotes: '',
  })
  const [editForm, setEditForm] = useState({
    name: '',
    contactName: '',
    email: '',
    staffId: '',
    address: '',
    phone: '',
    templateId: '',
    analysisNotes: '',
  })

  const lastPage = Math.max(1, Math.ceil(totalClients / pageSize))

  const resetCreateForm = useCallback(() => {
    setForm({ name: '', contactName: '', email: '', staffId: '', address: '', phone: '', analysisNotes: '' })
    setFormError('')
  }, [])

  const closeCreateForm = useCallback(() => {
    if (saving) return
    setShowForm(false)
    resetCreateForm()
  }, [resetCreateForm, saving])

  useEffect(() => {
    if (!showForm) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCreateForm()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeCreateForm, showForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        contactName: form.contactName,
        email: form.email,
        staffId: form.staffId || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        analysisNotes: form.analysisNotes || undefined,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setFormError(data?.error ?? '클라이언트 생성에 실패했습니다')
      setSaving(false)
      return
    }

    setShowForm(false)
    resetCreateForm()
    setSaving(false)
    startTransition(() => router.refresh())
  }

  const handleTemplateAssign = async (clientId: string, templateId: string) => {
    if (!templateId) return true

    const res = await fetch('/api/checklists/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, templateId }),
    })

    return res.ok
  }

  const startEdit = (client: ClientRow) => {
    setEditingClientId(client.id)
    setEditError('')
    setEditForm({
      name: client.name,
      contactName: client.contactName ?? '',
      email: client.email,
      staffId: client.staffId ?? '',
      address: client.address ?? '',
      phone: client.phone ?? '',
      templateId: client.templateId ?? '',
      analysisNotes: client.analysisNotes ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingClientId(null)
    setEditError('')
    setEditForm({ name: '', contactName: '', email: '', staffId: '', address: '', phone: '', templateId: '', analysisNotes: '' })
  }

  const handleUpdate = async (client: ClientRow) => {
    setUpdatingClientId(client.id)
    setEditError('')

    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        contactName: editForm.contactName,
        email: editForm.email,
        staffId: editForm.staffId || null,
        address: editForm.address || null,
        phone: editForm.phone || null,
        analysisNotes: editForm.analysisNotes || null,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setEditError(data?.error ?? '클라이언트 수정에 실패했습니다')
      setUpdatingClientId(null)
      return
    }

    if (editForm.templateId && editForm.templateId !== (client.templateId ?? '')) {
      const assigned = await handleTemplateAssign(client.id, editForm.templateId)
      if (!assigned) {
        setEditError('고객사 정보는 저장됐지만 자료관리기준 배정에 실패했습니다')
        setUpdatingClientId(null)
        return
      }
    }

    cancelEdit()
    setUpdatingClientId(null)
    startTransition(() => router.refresh())
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeletingClientId(deleteTarget.id)
    setEditError('')

    try {
      const res = await fetch(`/api/clients/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        setEditError('클라이언트 삭제에 실패했습니다')
        return
      }

      setDeleteTarget(null)
      startTransition(() => router.refresh())
    } catch {
      setEditError('네트워크 오류가 발생했습니다')
    } finally {
      setDeletingClientId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">고객사 관리</h1>
            <Badge variant="info">Workspace</Badge>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          + 고객사 추가
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <form action="/dashboard/clients" method="get" className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="고객사명, 고객사 담당자, 이메일, 전화번호 검색"
              className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {statusFilter !== 'all' ? <input type="hidden" name="status" value={statusFilter} /> : null}
            <button
              type="submit"
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              검색
            </button>
            {query || statusFilter !== 'all' ? (
              <Link
                href="/dashboard/clients"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                초기화
              </Link>
            ) : null}
          </form>
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            {[
              { value: 'all' as const, label: '전체', disabled: false },
              { value: 'mine' as const, label: '내 담당', disabled: !currentStaffId },
              { value: 'attention' as const, label: '주의 필요', disabled: false },
            ].map((filter) => {
              const active = statusFilter === filter.value
              const className = cn(
                'inline-flex rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                filter.disabled
                  ? 'pointer-events-none cursor-not-allowed opacity-40'
                  : active
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900',
              )

              return (
                <Link
                  key={filter.value}
                  aria-disabled={filter.disabled}
                  href={filter.disabled ? '#' : buildClientsHref({ q: query, status: filter.value, page: 1 })}
                  className={className}
                >
                  {filter.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-4 py-8 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateForm()
          }}
        >
          <form
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-client-title"
            className="w-full max-w-5xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div>
                <h2 id="create-client-title" className="text-base font-semibold text-gray-900">
                  새 고객사 추가
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  고객사 기본 정보와 자료 제출 담당자를 등록합니다.
                </p>
              </div>
              <button
                type="button"
                aria-label="새 고객사 추가 닫기"
                onClick={closeCreateForm}
                disabled={saving}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">회사명</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">자료 제출 담당자명</label>
                <input
                  type="text"
                  required
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="예: 홍길동"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">자료 제출 담당자 이메일</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">담당자</label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">담당자 선택 (선택)</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">주소 (선택)</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">전화번호 (선택)</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="예: 02-1234-5678"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-700">회사별 분석 기준</label>
                  <div className="flex flex-wrap gap-2">
                    {ANALYSIS_EXAMPLES.map((ex) => (
                      <button
                        key={ex.label}
                        type="button"
                        onClick={() => setForm({ ...form, analysisNotes: form.analysisNotes + (form.analysisNotes ? '\n' : '') + ex.text })}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {ex.label} 예시
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={form.analysisNotes}
                  onChange={(e) => setForm({ ...form, analysisNotes: e.target.value })}
                  maxLength={2000}
                  rows={4}
                  placeholder="이 회사 자료를 분석할 때 특별히 봐야 할 기준을 적어주세요."
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              {formError ? <p className="text-sm text-red-600">{formError}</p> : <p className="text-sm text-gray-500">저장하면 목록에 바로 반영됩니다.</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Client list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {editError && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {editError}
          </div>
        )}
        {initialClients.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            {query || statusFilter !== 'all'
              ? '조건에 맞는 고객사가 없습니다.'
              : '아직 고객사가 없습니다. 위 버튼으로 추가해 주세요.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {(['번호', '고객사', '담당자', '고객사 담당자', '이메일', '전화번호', '주소'] as const).map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">수정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {initialClients.map((c, index) => {
                  const isEditing = editingClientId === c.id
                  return (
                    <tr key={c.id}>
                      <td className="w-14 px-4 py-3 text-sm tabular-nums text-gray-400">
                        {rangeStart + index}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={`${c.name} 회사명`}
                          />
                        ) : (
                          <Link href={`/dashboard/clients/${c.id}`} className="w-fit text-gray-900 hover:text-blue-700 hover:underline">
                            {c.name}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {isEditing ? (
                          <div className="grid max-w-xs gap-2">
                            <select
                              value={editForm.staffId}
                              onChange={(e) => setEditForm({ ...editForm, staffId: e.target.value })}
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">미배정</option>
                              {staffList.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            <select
                              value={editForm.templateId}
                              onChange={(e) => setEditForm({ ...editForm, templateId: e.target.value })}
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label={`${c.name} 자료관리기준`}
                            >
                              <option value="">자료관리기준 미배정</option>
                              {templates.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span>{c.staffName ?? '미배정'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.contactName}
                            onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
                            className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={`${c.name} 자료 제출 담당자명`}
                          />
                        ) : (
                          <span>{c.contactName ?? '담당자 미입력'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={`${c.name} 자료 제출 담당자 이메일`}
                          />
                        ) : (
                          <span className="text-gray-500">{c.email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            placeholder="예: 02-1234-5678"
                            className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={`${c.name} 전화번호`}
                          />
                        ) : (
                          <span className="text-gray-500">{c.phone ?? '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.address}
                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={`${c.name} 주소`}
                          />
                        ) : (
                          <span className="block max-w-xs truncate text-gray-500">{c.address ?? '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdate(c)}
                              disabled={updatingClientId === c.id}
                              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                            >
                              {updatingClientId === c.id ? '저장 중...' : '저장'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                aria-label={`${c.name} 작업 메뉴`}
                                disabled={deletingClientId === c.id}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => router.push(`/dashboard/clients/${c.id}`)}>
                                <Eye className="h-3.5 w-3.5" />
                                운영 보기
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => startEdit(c)}>
                                <Pencil className="h-3.5 w-3.5" />
                                수정
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(c)}>
                                <Trash2 className="h-3.5 w-3.5" />
                                {deletingClientId === c.id ? '삭제 중...' : '삭제'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex min-h-12 flex-col gap-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {totalClients === 0
              ? '고객사 0곳'
              : `페이지 ${page.toLocaleString('ko-KR')} / ${lastPage.toLocaleString('ko-KR')}`}
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={page <= 1}
              href={buildClientsHref({ q: query, status: statusFilter, page: Math.max(1, page - 1) })}
              className={cn(
                'inline-flex h-8 items-center rounded-md border border-gray-200 px-3 font-semibold',
                page <= 1 ? 'pointer-events-none opacity-40' : 'bg-white text-gray-700 hover:bg-gray-50',
              )}
            >
              이전
            </Link>
            <Link
              aria-disabled={page >= lastPage}
              href={buildClientsHref({ q: query, status: statusFilter, page: Math.min(lastPage, page + 1) })}
              className={cn(
                'inline-flex h-8 items-center rounded-md border border-gray-200 px-3 font-semibold',
                page >= lastPage ? 'pointer-events-none opacity-40' : 'bg-white text-gray-700 hover:bg-gray-50',
              )}
            >
              다음
            </Link>
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        title={`${deleteTarget?.name ?? '고객사'} 클라이언트를 삭제할까요?`}
        description={`관련 세션, 업로드 파일, 메일 기록도 함께 삭제됩니다.\n삭제 후 고객사 목록에서 이 클라이언트를 볼 수 없습니다.`}
        loading={deleteTarget !== null && deletingClientId === deleteTarget.id}
        onCancel={() => {
          if (deletingClientId === null) setDeleteTarget(null)
        }}
        onConfirm={handleDelete}
      />
    </div>
  )
}
