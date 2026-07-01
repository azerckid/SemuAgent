'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function JaryoAdminNavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname()
  const active = href === '/jaryo-admin' ? pathname === '/jaryo-admin' : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={[
        'grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 text-sm',
        active ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-900',
      ].join(' ')}
    >
      {children}
    </Link>
  )
}
