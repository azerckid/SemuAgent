'use client'

import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface RerunPayrollExtractionButtonProps {
  sessionId: string
  disabled?: boolean
}

export function RerunPayrollExtractionButton({
  sessionId,
  disabled = false,
}: RerunPayrollExtractionButtonProps) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  const handleRerun = async () => {
    setRunning(true)

    const response = await fetch(`/api/sessions/${sessionId}/payroll/extract`, {
      method: 'POST',
    })

    if (!response.ok) {
      setRunning(false)
      const data = await response.json().catch(() => null)
      toast.error(data?.error ?? '급여자료를 다시 추출하지 못했습니다')
      return
    }

    setRunning(false)
    toast.success('급여자료를 다시 추출했습니다')
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleRerun}
      disabled={disabled || running}
    >
      <RefreshCw className={running ? 'animate-spin' : undefined} />
      {running ? '추출 중...' : '다시 추출'}
    </Button>
  )
}
