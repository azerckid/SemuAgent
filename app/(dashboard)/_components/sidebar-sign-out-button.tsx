'use client'

import { LogOut } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
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
      className={buttonVariants({
        variant: 'ghost',
        size: 'sm',
        className: 'h-7 w-full justify-start px-2 text-xs text-muted-foreground',
      })}
    >
      <LogOut className="size-3.5" />
      로그아웃
    </button>
  )
}
