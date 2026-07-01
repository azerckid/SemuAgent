'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { STATUS_TONE_CLASS, type DisplayStatus } from '@/lib/status-tone'
import { cn } from '@/lib/utils'

export type StatusModalSummaryItem = {
  label: string
  value: string
}

export function StatusModal({
  status,
  title,
  subtitle,
  wide = false,
  summary,
  footerActions,
  children,
}: {
  status: DisplayStatus
  title: string
  subtitle: string
  wide?: boolean
  summary?: StatusModalSummaryItem[]
  footerActions?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold transition-colors hover:brightness-95',
          STATUS_TONE_CLASS[status.tone],
        )}
      >
        {status.label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className={cn(
              'flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl',
              wide ? 'max-w-[860px]' : 'max-w-[620px]',
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                닫기
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {summary && (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {summary.map((item) => (
                    <div key={item.label} className="rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-4">{children}</div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3">
              {footerActions}
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
