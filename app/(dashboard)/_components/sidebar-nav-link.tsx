'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SidebarNavLinkProps {
  href: string
  children: ReactNode
  disabled?: boolean
  badge?: number
  badgeActiveOnly?: boolean
}

export function SidebarNavLink({
  href,
  children,
  disabled = false,
  badge = 0,
  badgeActiveOnly = true,
}: SidebarNavLinkProps) {
  const pathname = usePathname()
  const hrefPathname = href.split('#')[0] ?? href
  const isAnchorLink = href.includes('#')
  const active = !isAnchorLink && (hrefPathname === '/dashboard'
    ? pathname === '/dashboard'
    : pathname.startsWith(hrefPathname))
  const showBadge = badge > 0 && (!badgeActiveOnly || active)

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-company-fg-subtle/60"
      >
        {children}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors',
        active
          ? 'bg-company-nav-hover font-semibold text-foreground'
          : 'font-medium text-company-fg-muted hover:bg-company-nav-hover hover:text-foreground',
      )}
    >
      {children}
      {showBadge ? (
        <span className="ml-auto rounded-full border border-destructive/30 bg-destructive/10 px-[7px] py-px text-[10.5px] font-bold leading-4 text-destructive">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}
