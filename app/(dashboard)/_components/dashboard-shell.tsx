'use client'

import { PanelLeft } from 'lucide-react'
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
  onToggleDesktopCollapse?: () => void
}

export function DashboardShell({
  sidebar,
  children,
}: {
  readonly sidebar: ReactElement<SidebarCollapseProps>
  readonly children: ReactNode
}) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)

  useEffect(() => {
    setDesktopCollapsed(readSidebarCollapsed())
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

  return (
    <div
      className={cn(
        'grid min-h-screen grid-cols-1 bg-company-bg text-foreground',
        desktopCollapsed ? 'md:grid-cols-1' : 'md:grid-cols-[248px_minmax(0,1fr)]',
      )}
    >
      {cloneElement(sidebar, {
        desktopCollapsed,
        onToggleDesktopCollapse: toggleDesktopCollapse,
      })}
      {desktopCollapsed ? (
        <button
          type="button"
          className="fixed top-3 left-3 z-40 hidden size-9 items-center justify-center rounded-lg border border-company-border bg-company-surface text-company-fg-muted shadow-sm hover:bg-company-nav-hover hover:text-foreground md:inline-flex"
          aria-label="사이드바 표시"
          title="사이드바 표시"
          onClick={toggleDesktopCollapse}
        >
          <PanelLeft className="size-4" aria-hidden="true" />
        </button>
      ) : null}
      <div className="flex min-w-0 flex-col bg-company-bg">{children}</div>
    </div>
  )
}
