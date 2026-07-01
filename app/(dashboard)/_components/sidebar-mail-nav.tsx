'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, Inbox, Mail } from 'lucide-react'
import {
  MAIL_WORKSPACE_GROUPS,
  MAIL_WORKSPACE_TAB_LABEL,
  mailWorkspaceTabHref,
  parseMailWorkspaceTab,
} from '@/lib/mail-console/mail-workspace-tab'
import { cn } from '@/lib/utils'

const GROUP_ICON = [Mail, Inbox]

export function SidebarMailNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const onMailWorkspace = pathname.startsWith('/dashboard/emails')
  const activeTab = parseMailWorkspaceTab(searchParams.get('tab'))
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <div className="space-y-1">
      {MAIL_WORKSPACE_GROUPS.map((group, groupIndex) => {
        const GroupIcon = GROUP_ICON[groupIndex] ?? Mail
        const groupActive = onMailWorkspace && group.tabs.includes(activeTab)
        const expanded = !collapsedGroups.has(group.label)

        return (
          <div key={group.label} className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              aria-expanded={expanded}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm transition-colors hover:bg-sidebar-accent/70',
                groupActive ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              <GroupIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
              <ChevronDown
                className={cn('size-4 shrink-0 transition-transform', !expanded && '-rotate-90')}
              />
            </button>
            {expanded && (
              <div className="ml-3 space-y-0.5 border-l border-sidebar-border pl-2">
                {group.tabs.map((tab) => {
                  const active = onMailWorkspace && activeTab === tab

                  return (
                    <Link
                      key={tab}
                      href={mailWorkspaceTabHref(tab)}
                      className={cn(
                        'flex h-8 items-center rounded-lg px-2 text-sm transition-colors',
                        active
                          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
                      )}
                    >
                      <span className="truncate">{MAIL_WORKSPACE_TAB_LABEL[tab]}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
