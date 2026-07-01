'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SidebarNavLinkProps {
  href: string
  children: ReactNode
  disabled?: boolean
}

export function SidebarNavLink({ href, children, disabled = false }: SidebarNavLinkProps) {
  const pathname = usePathname()
  const active = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  // 추가 결제(유료 옵션) 메뉴는 비활성으로 노출만 하고 이동을 막는다.
  if (disabled) {
    return (
      <div
        aria-disabled="true"
        className="flex h-8 cursor-not-allowed items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground/50"
      >
        {children}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'flex h-8 items-center gap-2 rounded-lg px-2 text-sm transition-colors',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
