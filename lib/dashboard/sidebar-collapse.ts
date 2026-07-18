/** Browser-local desktop sidebar collapse preference (JC shell UX). */

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'semuagent.sidebar-collapsed'
export const SIDEBAR_COLLAPSED_EVENT = 'semuagent-sidebar-collapsed'

export function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
}

export function writeSidebarCollapsed(collapsed: boolean) {
  window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT))
}

/** useSyncExternalStore subscribe — storage + same-tab custom event. */
export function subscribeSidebarCollapsed(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange)
  }
}

/** Client snapshot for useSyncExternalStore. */
export function getSidebarCollapsedSnapshot() {
  return readSidebarCollapsed()
}

/** SSR / hydration-safe snapshot — always expanded until client store attaches. */
export function getSidebarCollapsedServerSnapshot() {
  return false
}
