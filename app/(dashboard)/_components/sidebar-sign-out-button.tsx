'use client'

import { signOut } from '@/lib/auth-client'

export function SidebarSignOutButton() {
  const handleSignOut = async () => {
    await signOut()
    window.location.assign('https://jaaryo.online/')
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="text-[11px] font-medium text-company-fg-subtle transition-colors hover:text-company-fg-muted"
    >
      로그아웃
    </button>
  )
}
