'use client'

import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function ReviewWorkspaceCollapsibleSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  badge?: { label: string; variant: 'secondary' | 'info' | 'success' | 'warning' | 'destructive' }
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="rounded-lg border border-border bg-background">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-muted/40"
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronRight
          className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
          </div>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </button>
      {open ? (
        <div className="border-t border-border [&>div]:border-0 [&>div]:shadow-none">{children}</div>
      ) : null}
    </section>
  )
}
