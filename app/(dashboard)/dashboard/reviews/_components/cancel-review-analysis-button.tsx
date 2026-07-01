'use client'

import { Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function CancelReviewAnalysisButton({
  sessionId,
}: {
  sessionId: string
}) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)

  const handleCancel = async () => {
    setCancelling(true)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/cancel-evaluation`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        toast.error(data?.error ?? '분석을 중단하지 못했습니다')
        return
      }

      const data = await response.json().catch(() => null)
      toast.success(data?.cancelledFiles > 0 ? '분석을 중단했습니다' : '진행 중인 파일 분석이 없습니다')
      router.refresh()
    } catch {
      toast.error('분석을 중단하지 못했습니다')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCancel}
      disabled={cancelling}
    >
      <Square className="size-3.5" />
      {cancelling ? '중단 중...' : '분석 중단'}
    </Button>
  )
}
