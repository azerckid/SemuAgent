import { Suspense, type ComponentType } from 'react'
import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  Mail,
  Scale,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { FieldTestLauncher } from './field-test-concierge/field-test-launcher'
import { SidebarMailNav } from './sidebar-mail-nav'
import { SidebarNavLink } from './sidebar-nav-link'
import { SidebarSignOutButton } from './sidebar-sign-out-button'

const WORK_NAV: SidebarItem[] = [
  { href: '/dashboard/clients', label: '고객사', icon: Building2 },
  { href: '/dashboard/reviews', label: '자료 검토', icon: ClipboardCheck },
  { href: '/dashboard/payroll', label: '급여정산', icon: FileSpreadsheet },
  { href: '/dashboard/calendar', label: '캘린더', icon: CalendarDays, badge: '옵션', disabled: true },
  { href: '/dashboard/law-search', label: '법령 검색', icon: Scale, badge: '옵션', disabled: true },
  { href: '/dashboard', label: '진행 현황', icon: LayoutDashboard, badge: '옵션', disabled: true },
]

const SETTINGS_NAV: SidebarItem[] = [
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard, badge: '준비' },
  { href: '/dashboard/checklists', label: '자료관리기준', icon: ListChecks, badge: '옵션', disabled: true },
  { href: '/dashboard/settings', label: '설정', icon: Settings },
]

interface SidebarProps {
  userName: string
  tenantName: string
}

export function Sidebar({ userName, tenantName }: SidebarProps) {
  const showFieldTestGuide = process.env.NEXT_PUBLIC_ENABLE_FIELD_TEST_GUIDE === 'true'

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            JR
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5 text-foreground">JARYO</p>
            <p className="truncate text-xs text-muted-foreground">{tenantName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarWorkNav items={WORK_NAV} />
        <div className="mt-5">
          <SidebarSection label="운영" items={SETTINGS_NAV} />
        </div>
      </nav>

      <div className="border-t border-sidebar-border px-4 pt-3 pb-18">
        <div className="mb-3 grid gap-2">
          {showFieldTestGuide ? <FieldTestLauncher /> : null}
        </div>
        <p className="mb-2 truncate text-xs text-muted-foreground">{userName}</p>
        <SidebarSignOutButton />
      </div>
    </aside>
  )
}

type SidebarItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  badge?: string
  disabled?: boolean
}

function SidebarMailNavFallback() {
  return (
    <Link
      href="/dashboard/emails"
      className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
    >
      <Mail className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">메일</span>
    </Link>
  )
}

function SidebarWorkNav({ items }: { items: SidebarItem[] }) {
  const [firstItem, ...restItems] = items

  return (
    <div>
      <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        업무
      </p>
      <div className="space-y-1">
        {firstItem ? (
          <SidebarNavLink key={firstItem.href} href={firstItem.href}>
            <firstItem.icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{firstItem.label}</span>
            {firstItem.badge && (
              <Badge variant="info" className="h-5 px-1.5 text-[10px]">
                {firstItem.badge}
              </Badge>
            )}
          </SidebarNavLink>
        ) : null}
        <Suspense fallback={<SidebarMailNavFallback />}>
          <SidebarMailNav />
        </Suspense>
        {restItems.map((item) => {
          const Icon = item.icon

          return (
            <SidebarNavLink
              key={item.href}
              href={item.href}
              disabled={item.disabled}
            >
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge && (
                <Badge variant={item.disabled ? 'secondary' : 'info'} className="h-5 px-1.5 text-[10px]">
                  {item.badge}
                </Badge>
              )}
            </SidebarNavLink>
          )
        })}
      </div>
    </div>
  )
}

function SidebarSection({
  label,
  items,
}: {
  label: string
  items: SidebarItem[]
}) {
  return (
    <div>
      <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <SidebarNavLink
              key={item.href}
              href={item.href}
              disabled={item.disabled}
            >
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge && (
                <Badge variant={item.disabled ? 'secondary' : 'info'} className="h-5 px-1.5 text-[10px]">
                  {item.badge}
                </Badge>
              )}
            </SidebarNavLink>
          )
        })}
      </div>
    </div>
  )
}
