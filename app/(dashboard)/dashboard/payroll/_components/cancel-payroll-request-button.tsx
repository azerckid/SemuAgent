'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { DeleteConfirmDialog } from '@/app/(dashboard)/dashboard/_components/delete-confirm-dialog'
import { Button } from '@/components/ui/button'

interface CancelPayrollRequestButtonProps {
  eventId: string
  clientName: string
  accountingPeriod: string
}

export function CancelPayrollRequestButton({
  eventId,
  clientName,
  accountingPeriod,
}: CancelPayrollRequestButtonProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const handleCancel = async () => {
    setCancelling(true)
    const response = await fetch(`/api/request-events/${eventId}`, { method: 'DELETE' })

    if (!response.ok) {
      setCancelling(false)
      const data = await response.json().catch(() => null)
      toast.error(data?.error ?? '급여 요청을 취소하지 못했습니다')
      return
    }

    setConfirmOpen(false)
    setCancelling(false)
    toast.success('급여 요청을 취소했습니다')
    router.replace('/dashboard/payroll')
    router.refresh()
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={cancelling}
      >
        {cancelling ? '취소 중...' : '요청 취소'}
      </Button>
      <DeleteConfirmDialog
        open={confirmOpen}
        title={`${clientName} ${accountingPeriod} 급여 요청을 취소할까요?`}
        description={`이 요청은 급여정산 목록에서 숨겨집니다.\n고객에게 이미 발송된 메일은 회수되지 않지만, 연결된 업로드 링크는 더 이상 진행 대상이 아닙니다.\n테스트를 다시 진행하려면 새 급여정산 요청을 생성해 주세요.`}
        confirmLabel="요청 취소"
        loading={cancelling}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleCancel}
      />
    </>
  )
}
