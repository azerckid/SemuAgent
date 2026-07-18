/** Browser-local desktop sidebar collapse preference (JC shell UX). */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'semuagent.sidebar-collapsed'

export function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
}

export function writeSidebarCollapsed(collapsed: boolean) {
  window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  window.dispatchEvent(new Event('semuagent-sidebar-collapsed'))
}
