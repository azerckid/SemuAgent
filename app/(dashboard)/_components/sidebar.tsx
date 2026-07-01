import {
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Settings,
  UploadCloud,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Badge } from '@/components/ui/badge'
import { SidebarNavLink } from './sidebar-nav-link'
import { SidebarSignOutButton } from './sidebar-sign-out-button'

const WORK_NAV: SidebarItem[] = [
  { href: '/dashboard', label: '회사 홈', icon: LayoutDashboard },
  { href: '/dashboard/direct-upload', label: '자료수집', icon: UploadCloud },
  { href: '/dashboard/reviews', label: '기장검토', icon: ClipboardCheck },
  { href: '/dashboard#vat-status', label: '부가세', icon: ReceiptText },
  { href: '/dashboard/payroll', label: '급여', icon: FileSpreadsheet },
  { href: '/dashboard#filing-support-status', label: '신고지원', icon: FileText },
]

const SETTINGS_NAV: SidebarItem[] = [
  { href: '/dashboard/clients', label: '사업장', icon: Building2 },
  { href: '/dashboard/settings', label: '설정', icon: Settings },
]

interface SidebarProps {
  userName: string
  tenantName: string
}

export function Sidebar({ userName, tenantName }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            자
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5 text-foreground">JARYO Company</p>
            <p className="truncate text-xs text-muted-foreground">{tenantName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarSection label="운영 흐름" items={WORK_NAV} />
        <div className="mt-5">
          <SidebarSection label="관리" items={SETTINGS_NAV} />
        </div>
      </nav>

      <div className="border-t border-sidebar-border px-4 pt-3 pb-18">
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
