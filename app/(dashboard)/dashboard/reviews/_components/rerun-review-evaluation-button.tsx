'use client'

import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { startEvaluationResponseSchema } from '@/lib/validations/start-evaluation-response'

interface RerunReviewEvaluationButtonProps {
  sessionId: string
  disabled?: boolean
  className?: string
}

export function RerunReviewEvaluationButton({
  sessionId,
  disabled = false,
  className,
}: RerunReviewEvaluationButtonProps) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  const handleRerun = async () => {
    setRunning(true)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/start-evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, reanalyzeFiles: false }),
      })

      const data = startEvaluationResponseSchema.safeParse(await response.json().catch(() => null))
      if (!response.ok || !data.success || !data.data.ok) {
        const errorMessage = data.success && !data.data.ok
          ? data.data.error
          : '자료를 다시 검토하지 못했습니다'
        toast.error(errorMessage)
        return
      }

      if (data.data.async) {
        toast.success('자료 재검토를 시작했습니다')
        router.refresh()
        return
      }

      toast.success(
        data.data.status === 'ready_for_accountant'
          ? '자료 검토 평가가 완료되었습니다.'
          : '자료 검토 평가가 완료되었습니다. 제출자료현황을 확인해 주세요.',
      )
      router.refresh()
    } catch {
      toast.error('자료를 다시 검토하지 못했습니다')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={handleRerun}
      disabled={disabled || running}
      className={cn(className)}
    >
      <RefreshCw className={running ? 'animate-spin' : undefined} />
      {running ? '검토 중...' : '자료 다시 검토'}
    </Button>
  )
}
