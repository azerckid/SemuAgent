'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { DeleteConfirmDialog } from '@/app/(dashboard)/dashboard/_components/delete-confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Schedule {
  id: string
  frequency: string
  startsOn: string
  endsOn: string | null
  sendRule: string | null
  dueRule: string | null
  emailSubjectTemplate: string | null
  isActive: boolean
  createdAt: string
}

interface Props {
  clientId: string
  schedules: Schedule[]
}

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: '월별',
  quarterly: '분기별',
  semiannual: '반기별',
  annual: '연간',
}

const SEND_RULE_LABEL = (raw: string | null) => {
  if (!raw) return '-'
  try {
    const r = JSON.parse(raw)
    if (r.type === 'day_of_month') return `매월 ${r.dayOfMonth}일`
    if (r.type === 'days_before_period_end') return `기간 종료 ${r.daysBefore}일 전`
  } catch { /* ignore */ }
  return '-'
}

const DUE_RULE_LABEL = (raw: string | null) => {
  if (!raw) return '-'
  try {
    const r = JSON.parse(raw)
    if (r.type === 'day_of_month') return `해당 월 ${r.dayOfMonth}일`
    if (r.type === 'days_after_period_end') return `기간 종료 후 ${r.daysAfterPeriodEnd}일`
  } catch { /* ignore */ }
  return '-'
}

export function ScheduleTab({ clientId, schedules: initialSchedules }: Props) {
  const [schedules, setSchedules] = useState(initialSchedules)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async (scheduleId: string, isActive: boolean) => {
    setError(null)
    setToggling(scheduleId)
    const res = await fetch(`/api/request-schedules/${scheduleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    setToggling(null)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? '정기 요청 메일 상태를 변경하지 못했습니다')
      return
    }
    setSchedules((prev) =>
      prev.map((s) => s.id === scheduleId ? { ...s, isActive: !isActive } : s),
    )
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setError(null)
    setDeleting(deleteTarget.id)
    const res = await fetch(`/api/request-schedules/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(null)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? '정기 요청 메일을 삭제하지 못했습니다')
      return
    }

    setSchedules((prev) => prev.filter((s) => s.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">정기 요청 메일</h3>
        </div>
        <Link
          href={`/dashboard/clients/${clientId}/schedules/new`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          정기 요청 메일
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          아직 등록된 정기 요청 메일이 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className={`rounded-lg border p-4 ${s.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-900">{FREQUENCY_LABEL[s.frequency] ?? s.frequency}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {s.isActive ? '활성' : '중지'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">발송:</span> {SEND_RULE_LABEL(s.sendRule)}
                    <span className="mx-2 text-gray-300">·</span>
                    <span className="font-medium">제출기한:</span> {DUE_RULE_LABEL(s.dueRule)}
                  </p>
                  {s.emailSubjectTemplate && (
                    <p className="text-xs text-gray-400 truncate">{s.emailSubjectTemplate}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    반복 적용 시작일: {s.startsOn}
                    {s.endsOn && <span> · 종료일: {s.endsOn}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`${FREQUENCY_LABEL[s.frequency] ?? s.frequency} 정기 요청 작업 메뉴`}
                      disabled={toggling === s.id || deleting === s.id}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleToggle(s.id, s.isActive)}>
                        {s.isActive ? (
                          <>
                            <Pause className="h-3.5 w-3.5" />
                            중지
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" />
                            활성화
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(s)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        title="정기 요청 메일을 삭제할까요?"
        description={`이 정기 요청 메일은 화면에서 숨겨집니다.\n이미 발송된 회차가 있으면 사업장의 자료 제출 링크가 더 이상 열리지 않습니다.\n기존 메일, 업로드, 분석 기록은 내부 기록으로 보관됩니다.`}
        loading={deleteTarget !== null && deleting === deleteTarget.id}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={handleDelete}
      />
    </div>
  )
}
