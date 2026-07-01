'use client'

import { type ComponentType, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'
import type { UsageHelpPanelProps } from './usage-help-panel'

type UsageHelpPanelComponent = ComponentType<UsageHelpPanelProps>

/**
 * AI 안내 패널 launcher.
 *
 * UsageHelpPanel은 클릭 시 동적으로 로드한다 (FieldTestLauncher 패턴).
 * 정적 import를 사용하면 모든 대시보드 페이지의 초기 번들에
 * panel 코드와 그 의존성이 포함되기 때문에 lazy load가 필요하다.
 */
export function UsageHelpLauncher() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [Panel, setPanel] = useState<UsageHelpPanelComponent | null>(null)

  const loadPanel = () => {
    if (!Panel && !isLoading) {
      setIsLoading(true)
      setHasError(false)
      void import('./usage-help-panel')
        .then((m) => setPanel(() => m.UsageHelpPanel))
        .catch(() => setHasError(true))
        .finally(() => setIsLoading(false))
    }
  }

  const handleOpen = () => {
    setIsOpen(true)
    loadPanel()
  }

  const handleClose = () => {
    setIsOpen(false)
    setHasError(false)
  }

  if (isOpen) {
    if (Panel) {
      return <Panel pathname={pathname} onClose={handleClose} />
    }

    // 로딩 또는 오류 상태: 최소 스켈레톤
    return (
      <section
        role="complementary"
        aria-label={hasError ? 'AI 안내 오류' : 'AI 안내 로딩'}
        className="fixed inset-x-3 bottom-3 z-50 overflow-hidden rounded-xl border border-border bg-background shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[390px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
          <div className="min-w-0">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="mt-2 h-3 w-48 max-w-full rounded bg-muted" />
          </div>
          <button
            type="button"
            aria-label="AI 안내 패널 닫기"
            onClick={handleClose}
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          >
            ✕
          </button>
        </div>
        <div className="grid gap-3 p-4">
          {hasError ? (
            <>
              <p className="text-sm font-medium text-foreground">안내를 불러오지 못했습니다.</p>
              <button
                type="button"
                onClick={loadPanel}
                disabled={isLoading}
                className={buttonVariants({ variant: 'outline' })}
              >
                다시 시도
              </button>
            </>
          ) : (
            <>
              <div className="h-20 animate-pulse rounded-lg border border-border bg-muted/30" />
              <div className="h-9 animate-pulse rounded-md bg-muted/40" />
            </>
          )}
        </div>
      </section>
    )
  }

  return (
    <button
      type="button"
      aria-label="AI 안내 열기"
      onClick={handleOpen}
      className={cn(buttonVariants({ size: 'sm' }), 'h-9 w-full justify-center shadow-none')}
    >
      <Sparkles aria-hidden="true" />
      AI 안내
    </button>
  )
}
