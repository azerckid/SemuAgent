'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  eventId: string
  clientId: string
  disabled?: boolean
}

export function SendButton({ eventId, clientId, disabled }: Props) {
  const router = useRouter()
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/request-events/${eventId}/send`, {
        method: 'POST',
      })

      let data: { error?: string; sessionId?: string } = {}
      try { data = await res.json() } catch { /* non-JSON 무시 */ }

      if (res.status === 409) {
        toast.error(data.error ?? '이미 발송된 요청 일정입니다')
        return
      }

      if (!res.ok) {
        toast.error(data.error ?? '발송에 실패했습니다')
        return
      }

      // 성공 toast는 ToastHandler에서 ?toast=sent로 처리 (중복 방지)
      router.push(`/dashboard/clients/${clientId}?toast=sent`)
      router.refresh()
    } catch {
      toast.error('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={disabled || sending}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
    >
      <Send className="h-4 w-4" />
      {sending ? '발송 중...' : '요청 메일 발송'}
    </button>
  )
}
