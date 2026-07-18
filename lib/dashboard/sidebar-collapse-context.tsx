'use client'

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  getSidebarCollapsedServerSnapshot,
  getSidebarCollapsedSnapshot,
  subscribeSidebarCollapsed,
  writeSidebarCollapsed,
} from '@/lib/dashboard/sidebar-collapse'

type SidebarCollapseContextValue = {
  readonly desktopCollapsed: boolean
  readonly toggleDesktopCollapse: () => void
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null)

export function SidebarCollapseProvider({ children }: { readonly children: ReactNode }) {
  const desktopCollapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot,
  )

  return (
    <SidebarCollapseContext.Provider
      value={{
        desktopCollapsed,
        toggleDesktopCollapse: () => writeSidebarCollapsed(!desktopCollapsed),
      }}
    >
      {children}
    </SidebarCollapseContext.Provider>
  )
}

export function useSidebarCollapse(): SidebarCollapseContextValue {
  const value = useContext(SidebarCollapseContext)
  if (!value) {
    return {
      desktopCollapsed: false,
      toggleDesktopCollapse: () => {},
    }
  }
  return value
}
