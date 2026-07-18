'use client'

import { PanelLeft, PanelLeftClose } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  SidebarCollapseProvider,
  useSidebarCollapse,
} from '@/lib/dashboard/sidebar-collapse-context'
import { cn } from '@/lib/utils'

/**
 * Dashboard chrome. Collapse state is provided via context so the Server
 * Component layout can pass `<Sidebar />` as a prop; collapse state is shared
 * through context instead of cloning the RSC-provided element.
 */
export function DashboardShell({
  sidebar,
  children,
}: {
  readonly sidebar: ReactNode
  readonly children: ReactNode
}) {
  return (
    <SidebarCollapseProvider>
      <DashboardShellFrame sidebar={sidebar}>{children}</DashboardShellFrame>
    </SidebarCollapseProvider>
  )
}

function DashboardShellFrame({
  sidebar,
  children,
}: {
  readonly sidebar: ReactNode
  readonly children: ReactNode
}) {
  const { desktopCollapsed, toggleDesktopCollapse } = useSidebarCollapse()
  const toggleLabel = desktopCollapsed ? '사이드바 표시' : '사이드바 숨기기'

  return (
    <div className="flex h-dvh flex-col bg-company-bg text-foreground">
      <header className="z-50 hidden shrink-0 border-b border-company-border bg-company-surface px-3 py-2.5 md:block">
        <div className="flex w-fit max-w-full items-start gap-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight">SemuAgent</p>
            <p className="truncate text-[11px] text-company-fg-subtle">회사 세무·회계 운영</p>
          </div>
          <button
            type="button"
            className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-company-fg-muted hover:bg-company-nav-hover hover:text-foreground"
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={toggleDesktopCollapse}
          >
            {desktopCollapsed ? (
              <PanelLeft className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <div
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1',
          desktopCollapsed ? 'md:grid-cols-1' : 'md:grid-cols-[248px_minmax(0,1fr)]',
        )}
      >
        {sidebar}
        <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto bg-company-bg">{children}</div>
      </div>
    </div>
  )
}
