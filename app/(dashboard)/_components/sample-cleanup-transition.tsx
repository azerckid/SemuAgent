'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function SampleCleanupTransition() {
  const router = useRouter()

  useEffect(() => {
    const timeout = window.setTimeout(() => router.refresh(), 800)
    return () => window.clearTimeout(timeout)
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
