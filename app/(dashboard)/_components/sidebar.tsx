import { SidebarNavLink } from './sidebar-nav-link'
import { SidebarSignOutButton } from './sidebar-sign-out-button'

const HOME_NAV = {
  href: '/dashboard',
  label: '회사 홈',
  glyph: '◧',
} as const

const FLOW_NAV = [
  { href: '/dashboard/direct-upload', label: '자료수집', glyph: '↥' },
  { href: '/dashboard/bookkeeping', label: '기장검토', glyph: '▤' },
  { href: '/dashboard/vat', label: '부가세', glyph: '％' },
  { href: '/dashboard/payroll', label: '급여', glyph: '₩' },
  { href: '/dashboard/filing-support', label: '신고지원', glyph: '↧' },
] as const

const SETTINGS_NAV = {
  href: '/dashboard/settings',
  label: '설정',
  glyph: '⚙',
} as const

interface SidebarProps {
  userName: string
  tenantName: string
  bookkeepingPendingCount?: number
  payrollEmployeeCount?: number
  filingAttentionCount?: number
}

function userInitial(userName: string) {
  const trimmed = userName.trim()
  return trimmed ? trimmed.slice(0, 1) : 'U'
}

export function Sidebar({
  userName,
  tenantName,
  bookkeepingPendingCount = 0,
  payrollEmployeeCount = 0,
  filingAttentionCount = 0,
}: SidebarProps) {
  return (
    <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col gap-1 border-r border-company-border bg-company-surface px-3.5 py-5 text-foreground">
      <div className="flex items-center gap-2.5 px-2 pb-[18px]">
        <div className="flex size-[30px] items-center justify-center rounded-lg bg-[#18181b] text-[15px] font-bold text-white">
          자
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight">JARYO Company</p>
          <p className="truncate text-[11px] text-company-fg-subtle">회사 세무·회계 운영</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        <SidebarNavLink href={HOME_NAV.href}>
          <NavGlyph>{HOME_NAV.glyph}</NavGlyph>
          <span className="min-w-0 flex-1 truncate">{HOME_NAV.label}</span>
        </SidebarNavLink>

        <p className="px-2 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.04em] text-company-fg-subtle uppercase">
          운영 흐름
        </p>

        {FLOW_NAV.map((item) => {
          const badge = item.href === '/dashboard/bookkeeping'
            ? bookkeepingPendingCount
            : item.href === '/dashboard/payroll'
              ? payrollEmployeeCount
              : item.href === '/dashboard/filing-support'
                ? filingAttentionCount
                : 0

          return (
            <SidebarNavLink key={item.href} href={item.href} badge={badge}>
              <NavGlyph>{item.glyph}</NavGlyph>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </SidebarNavLink>
          )
        })}

        <p className="px-2 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.04em] text-company-fg-subtle uppercase">
          관리
        </p>

        <SidebarNavLink href={SETTINGS_NAV.href}>
          <NavGlyph>{SETTINGS_NAV.glyph}</NavGlyph>
          <span className="min-w-0 flex-1 truncate">{SETTINGS_NAV.label}</span>
        </SidebarNavLink>
      </nav>

      <div className="mt-2 border-t border-company-border pt-2">
        <div className="flex items-center gap-2.5 px-2 py-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e4e4e7] text-xs font-semibold text-company-fg-muted">
            {userInitial(userName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold text-foreground">{userName}</p>
            <p className="truncate text-[11px] text-company-fg-subtle">{tenantName} · 대표</p>
          </div>
        </div>
        <div className="px-2 pb-1">
          <SidebarSignOutButton />
        </div>
      </div>
    </aside>
  )
}

function NavGlyph({ children }: { children: string }) {
  return (
    <span className="w-[18px] shrink-0 text-center text-[13px] opacity-80" aria-hidden="true">
      {children}
    </span>
  )
}
