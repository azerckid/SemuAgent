'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

function formatApiError(error: unknown): string | null {
  if (typeof error === 'string') return error
  return null
}

export function PayrollRuleProfileRetirePanel({
  clientId,
  profileId,
}: {
  clientId: string
  profileId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const busy = isSubmitting || isPending

  async function retire() {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)
    try {
      const response = await fetch(
        `/api/clients/${clientId}/payroll-rule-profiles/${profileId}/retire`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() || null }),
        },
      )
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null
      if (!response.ok) {
        setErrorMessage(formatApiError(payload?.error) ?? '프로필을 폐기하지 못했습니다')
        return
      }
      setSuccessMessage('승인된 사내급여기준 프로필을 폐기했습니다.')
      startTransition(() => router.refresh())
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-4 border-t border-emerald-100 pt-4">
      <h4 className="text-sm font-medium text-gray-900">승인된 기준 폐기</h4>
      <p className="mt-1 text-xs text-gray-500">
        폐기하면 신규 급여정산에 이 기준이 적용되지 않습니다. 과거 적용 스냅샷은 유지됩니다.
      </p>
      <Textarea
        className="mt-2"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={busy}
        rows={2}
        placeholder="폐기 사유 (선택)"
      />
      {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
      {successMessage && <p className="mt-2 text-sm text-emerald-700">{successMessage}</p>}
      <Button
        type="button"
        variant="outline"
        className="mt-2"
        disabled={busy}
        onClick={() => void retire()}
      >
        {busy ? '처리 중…' : '프로필 폐기'}
      </Button>
    </div>
  )
}
