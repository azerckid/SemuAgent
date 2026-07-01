'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

const TOAST_MESSAGES: Record<string, { type: 'success' | 'error'; message: string }> = {
  saved: { type: 'success', message: '요청 일정이 저장되었습니다' },
  sent: { type: 'success', message: '요청 메일이 발송되었습니다' },
  deleted: { type: 'success', message: '요청 메일이 삭제되었습니다' },
}

export function ToastHandler() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const key = searchParams.get('toast')
    if (!key) return
    const config = TOAST_MESSAGES[key]
    if (!config) return

    if (config.type === 'success') toast.success(config.message)
    else toast.error(config.message)

    // URL에서 toast 파라미터 제거 (브라우저 히스토리 오염 방지)
    const url = new URL(window.location.href)
    url.searchParams.delete('toast')
    window.history.replaceState({}, '', url.toString())
  }, [searchParams])

  return null
}
