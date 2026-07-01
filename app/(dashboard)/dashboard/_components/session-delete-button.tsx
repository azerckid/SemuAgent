'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DeleteConfirmDialog } from './delete-confirm-dialog'

interface Props {
  sessionId: string
  clientName: string
  accountingPeriod: string
  label?: string
  titleLabel?: string
  redirectTo?: string
  appearance?: 'link' | 'solid-destructive'
}

export function SessionDeleteButton({
  sessionId,
  clientName,
  accountingPeriod,
  label = '삭제',
  titleLabel = '요청 메일',
  redirectTo,
  appearance = 'link',
}: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    if (!res.ok) {
      setDeleting(false)
      const data = await res.json().catch(() => null)
      toast.error(data?.error ?? '요청 메일을 삭제하지 못했습니다')
      return
    }

    setConfirmOpen(false)
    if (redirectTo) {
      router.push(redirectTo)
    } else {
      router.refresh()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={deleting}
        className={cn(
          appearance === 'solid-destructive'
            ? buttonVariants({
              size: 'sm',
              className: 'bg-red-600 text-white hover:bg-red-700',
            })
            : 'text-xs text-red-500 hover:underline disabled:opacity-50',
        )}
      >
        {deleting ? '삭제 중...' : label}
      </button>
      <DeleteConfirmDialog
        open={confirmOpen}
        title={`${clientName} ${accountingPeriod} ${titleLabel}을 삭제할까요?`}
        description={`이 ${titleLabel}은 화면에서 숨겨집니다.\n자료 제출 링크가 더 이상 열리지 않습니다.\n기존 업로드와 분석 기록은 내부 기록으로 보관됩니다.`}
        loading={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  )
}
