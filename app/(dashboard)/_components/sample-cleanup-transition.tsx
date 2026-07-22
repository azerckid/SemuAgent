'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const CLEANUP_REFRESH_INTERVAL_MS = 800

export function SampleCleanupTransition() {
  const router = useRouter()

  useEffect(() => {
    // layout soft navigation으로는 이 화면이 언마운트되지 않을 수 있어,
    // 정리 완료까지 주기적으로 refresh한다. 완료되면 layout이 children으로 교체한다.
    const refresh = () => {
      router.refresh()
    }

    refresh()
    const interval = window.setInterval(refresh, CLEANUP_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [router])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[760px] items-center px-6">
      <div>
        <h1 className="text-xl font-semibold text-company-text">실제 사용 화면을 준비하고 있습니다</h1>
        <p className="mt-2 text-sm text-company-text-muted">샘플 자료를 정리한 뒤 회사 자료를 올릴 수 있습니다.</p>
      </div>
    </main>
  )
}
