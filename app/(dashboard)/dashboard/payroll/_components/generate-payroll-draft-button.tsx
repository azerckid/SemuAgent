'use client'

import { FileSpreadsheet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface GeneratePayrollDraftButtonProps {
  sessionId: string
  passCount: number
  enabled: boolean
  disabledReason?: string
  disabledLabel?: string
  successHref?: string
}

export function GeneratePayrollDraftButton({
  sessionId,
  passCount,
  enabled,
  disabledReason,
  disabledLabel,
  successHref,
}: GeneratePayrollDraftButtonProps) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  const handleGenerate = async () => {
    setRunning(true)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/payroll/drafts`, {
        method: 'POST',
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(data?.error ?? '결과 엑셀 작성에 실패했습니다')
        return
      }

      toast.success('결과 엑셀표가 작성되었습니다')
      if (successHref && successHref !== `${window.location.pathname}${window.location.search}`) {
        router.replace(successHref, { scroll: false })
      } else {
        router.refresh()
      }
    } catch {
      toast.error('네트워크 오류')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Button
      type="button"
      className="w-full"
      onClick={handleGenerate}
      disabled={!enabled || running}
      title={!enabled ? disabledReason : undefined}
    >
      <FileSpreadsheet className="size-4" />
      {running ? '작성 중…' : enabled ? `결과 엑셀 작성 (${passCount}명)` : disabledLabel ?? '결과 엑셀 작성 불가'}
    </Button>
  )
}
