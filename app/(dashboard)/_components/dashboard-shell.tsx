'use client'

import { PanelLeft, PanelLeftClose } from 'lucide-react'
import {
  cloneElement,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from '@/lib/dashboard/sidebar-collapse'
import { cn } from '@/lib/utils'

type SidebarCollapseProps = {
  desktopCollapsed?: boolean
}

export function DashboardShell({
  sidebar,
  children,
}: {
  readonly sidebar: ReactElement<SidebarCollapseProps>
  readonly children: ReactNode
}) {
  // Lazy init avoids setState-in-effect (CI eslint react-hooks/set-state-in-effect).
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => readSidebarCollapsed())

  useEffect(() => {
    const onStorage = () => setDesktopCollapsed(readSidebarCollapsed())
    window.addEventListener('storage', onStorage)
    window.addEventListener('semuagent-sidebar-collapsed', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('semuagent-sidebar-collapsed', onStorage)
    }
  }, [])

  function toggleDesktopCollapse() {
    setDesktopCollapsed((prev) => {
      const next = !prev
      writeSidebarCollapsed(next)
      return next
    })
  }

  const toggleLabel = desktopCollapsed ? '사이드바 표시' : '사이드바 숨기기'

  return (
    <div className="flex h-dvh flex-col bg-company-bg text-foreground">
      {/* Desktop: persistent top bar. Body below is flex-1 so the nav never scrolls under it. */}
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
        {cloneElement(sidebar, {
          desktopCollapsed,
        })}
        <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto bg-company-bg">{children}</div>
      </div>
    </div>
  )
}
