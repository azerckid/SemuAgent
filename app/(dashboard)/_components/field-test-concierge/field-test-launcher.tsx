'use client'

import { type ComponentType, useState } from 'react'
import { ClipboardList, MessageCircle, RotateCw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'

type FieldTestConciergeComponent = ComponentType<{
  onClose: () => void
  onCollapse: () => void
}>

type FieldTestConciergePendingProps = {
  hasError: boolean
  isLoading: boolean
  onClose: () => void
  onRetry: () => void
}

function FieldTestConciergePending({
  hasError,
  isLoading,
  onClose,
  onRetry,
}: FieldTestConciergePendingProps) {
  return (
    <section
      role="complementary"
      aria-label={hasError ? '테스트 안내 오류' : '테스트 안내 로딩'}
      className="fixed inset-x-3 bottom-3 z-50 flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[420px]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/40 p-3">
        <div className="min-w-0">
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="mt-2 h-3 w-52 max-w-full rounded bg-muted" />
        </div>
        <button
          type="button"
          aria-label="테스트 안내창 닫기"
          onClick={onClose}
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="grid gap-3 p-3">
        {hasError ? (
          <>
            <p className="text-sm font-medium text-foreground">안내를 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              className={buttonVariants({ variant: 'outline' })}
            >
              <RotateCw aria-hidden="true" className={isLoading ? 'animate-spin' : undefined} />
              다시 시도
            </button>
          </>
        ) : (
          <>
            <div className="h-24 rounded-lg border border-border bg-muted/30" />
            <div className="h-9 rounded-md bg-muted/40" />
          </>
        )}
      </div>
    </section>
  )
}

export function FieldTestLauncher() {
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoadingConcierge, setIsLoadingConcierge] = useState(false)
  const [hasLoadError, setHasLoadError] = useState(false)
  const [FieldTestConcierge, setFieldTestConcierge] =
    useState<FieldTestConciergeComponent | null>(null)

  const loadConcierge = () => {
    if (!FieldTestConcierge && !isLoadingConcierge) {
      setIsLoadingConcierge(true)
      setHasLoadError(false)
      void import('./field-test-concierge')
        .then((module) => setFieldTestConcierge(() => module.FieldTestConcierge))
        .catch(() => setHasLoadError(true))
        .finally(() => setIsLoadingConcierge(false))
    }
  }

  const handleOpen = () => {
    setIsOpen(true)
    setIsCollapsed(false)
    loadConcierge()
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsCollapsed(false)
    setHasLoadError(false)
  }

  if (isOpen) {
    return (
      <>
        <div hidden={isCollapsed}>
          {FieldTestConcierge ? (
            <FieldTestConcierge onClose={handleClose} onCollapse={() => setIsCollapsed(true)} />
          ) : (
            <FieldTestConciergePending
              hasError={hasLoadError}
              isLoading={isLoadingConcierge}
              onClose={handleClose}
              onRetry={loadConcierge}
            />
          )}
        </div>
        {isCollapsed ? (
          <div className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-2 shadow-xl sm:inset-x-auto sm:right-4 sm:w-[340px]">
            <button
              type="button"
              aria-label="접힌 테스트 안내창 다시 열기"
              onClick={handleOpen}
              className={buttonVariants({
                variant: 'ghost',
                className: 'min-w-0 flex-1 justify-start',
              })}
            >
              <MessageCircle aria-hidden="true" />
              <span className="truncate">테스트 안내 계속하기</span>
            </button>
            <button
              type="button"
              aria-label="테스트 안내창 닫기"
              onClick={handleClose}
              className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <button
      type="button"
      aria-label="테스트 안내 열기"
      onClick={handleOpen}
      className={cn(buttonVariants({ size: 'sm' }), 'h-9 w-full justify-center shadow-none')}
    >
      <ClipboardList aria-hidden="true" />
      테스트 안내
      <Badge variant="secondary" className="ml-1 rounded-full">
        Guide
      </Badge>
    </button>
  )
}
