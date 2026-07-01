'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { DeleteConfirmDialog } from '@/app/(dashboard)/dashboard/_components/delete-confirm-dialog'

interface Props {
  eventId: string
  clientId: string
}

export function DeleteButton({ eventId, clientId }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const res = await fetch(`/api/request-events/${eventId}`, { method: 'DELETE' })
    setDeleting(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast.error(data?.error ?? '요청 메일을 삭제하지 못했습니다')
      return
    }

    router.push(`/dashboard/clients/${clientId}?toast=deleted`)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={deleting}
        className="inline-flex shrink-0 items-center rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {deleting ? '삭제 중...' : '삭제'}
      </button>
      <DeleteConfirmDialog
        open={confirmOpen}
        title="요청 메일을 삭제할까요?"
        description={`이 요청 메일은 화면에서 숨겨집니다.\n이미 발송된 요청이면 고객의 자료 제출 링크가 더 이상 열리지 않습니다.\n기존 메일, 업로드, 분석 기록은 내부 기록으로 보관됩니다.`}
        loading={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  )
}
