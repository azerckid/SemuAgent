'use client'

import { Menu, PanelLeftClose } from 'lucide-react'
import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { FilingPrepBusinessType } from '@/lib/filing-preparation/summary'
import { ThemeModeMenu } from '@/components/theme/theme-mode-menu'
import { cn } from '@/lib/utils'
import { SidebarNavLink } from './sidebar-nav-link'
import { SidebarSignOutButton } from './sidebar-sign-out-button'

// JC-043: 세비서를 사이드바 최상단·로그인 후 첫 화면으로 둔다. 회사 홈은 그 아래 유지.
const SEBISEO_NAV = {
  href: '/dashboard/sebiseo',
  label: '세비서',
  glyph: '✦',
} as const

const HOME_NAV = {
  href: '/dashboard',
  label: '회사 홈',
  glyph: '◧',
} as const

// 2026-07-11 cadence IA(JC-036): 신고 주기(월/분기·반기/연) 기준 3그룹으로 재구성.
// 신고지원·신고 준비 상위 메뉴는 폐기하고 하위 항목을 급여·지급/연간신고로 흡수한다.
const FLOW_NAV = [
  { href: '/dashboard/direct-upload', label: '자료수집', glyph: '↥' },
  { href: '/dashboard/bookkeeping', label: '기장검토', glyph: '▤' },
  { href: '/dashboard/payroll', label: '급여·지급', glyph: '₩' },
  { href: '/dashboard/vat', label: '부가세', glyph: '％' },
  { href: '/dashboard/filing-preparation', label: '연간신고', glyph: '◷' },
] as const

const BOOKKEEPING_CHILD_NAV = [
  { href: '/dashboard/bookkeeping/reconciliation-ledger', label: '자료대조원장' },
] as const

// 상위 '급여·지급' 항목 자체가 /dashboard/payroll로 연결되지만, 카테고리 헤더처럼
// 보여 발견성이 떨어진다는 피드백에 따라 하위에도 '급여'를 명시적으로 노출한다.
const PAYROLL_CHILD_NAV = [
  { href: '/dashboard/payroll', label: '급여' },
  { href: '/dashboard/employees', label: '직원 명부' },
  { href: '/dashboard/filing-support', label: '원천세' },
  { href: '/dashboard/filing-preparation/payment-statements', label: '지급명세서' },
  { href: '/dashboard/filing-preparation/year-end-settlement', label: '연말정산' },
  { href: '/dashboard/filing-preparation/local-income-tax', label: '지방소득세' },
] as const

// 사업자현황신고(면세 개인 전용)만 고정 항목. 법인세/종합소득세는 사업자 유형에 따라
// 조건부로 앞에 붙인다(annualFilingChildNav). 두 세목은 JC-025/026 미구현이라
// 전용 라우트가 없으므로 연간신고 허브(같은 href)로 안내한다.
const ANNUAL_FILING_FIXED_CHILD_NAV = [
  { href: '/dashboard/filing-preparation/business-status-report', label: '사업장현황신고' },
] as const

const MANAGE_NAV = [
  { href: '/dashboard/settings', label: '설정', glyph: '⚙' },
  { href: '/dashboard/reminders', label: '리마인드', glyph: '✉' },
] as const

interface SidebarProps {
  userName: string
  tenantName: string
  bookkeepingPendingCount?: number
  payrollEmployeeCount?: number
  filingAttentionCount?: number
  filingPrepAttentionCount?: number
  reminderAttentionCount?: number
  businessType?: FilingPrepBusinessType
  /** Desktop-only: hide the sticky nav column (mobile Sheet unchanged). */
  desktopCollapsed?: boolean
  onToggleDesktopCollapse?: () => void
}

function userInitial(userName: string) {
  const trimmed = userName.trim()
  return trimmed ? trimmed.slice(0, 1) : 'U'
}

// 미지정(unknown)이면 하위 항목을 노출하지 않는다(과잉 추정 방지) —
// lib/filing-preparation/summary.ts의 "미지정이면 흐림 없음" 원칙과 대칭.
function annualFilingChildNav(businessType: FilingPrepBusinessType) {
  const items: { href: string; label: string }[] = []
  if (businessType === 'corporation') {
    items.push({ href: '/dashboard/filing-preparation', label: '법인세' })
  } else if (businessType === 'individual' || businessType === 'tax_exempt') {
    items.push({ href: '/dashboard/filing-preparation', label: '종합소득세' })
  }
  if (businessType === 'tax_exempt') {
    items.push(...ANNUAL_FILING_FIXED_CHILD_NAV)
  }
  return items
}

export function Sidebar(props: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { desktopCollapsed = false, onToggleDesktopCollapse } = props

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-1 border-r border-company-border bg-company-surface px-3.5 py-5 text-foreground md:flex',
          desktopCollapsed && 'md:hidden',
        )}
      >
        <SidebarContent {...props} onToggleDesktopCollapse={onToggleDesktopCollapse} />
      </aside>

      <div className="flex items-center justify-between border-b border-company-border bg-company-surface px-4 py-3 text-foreground md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-[15px] font-bold text-background">자</div>
          <div>
            <p className="text-sm font-semibold">SemuAgent</p>
            <p className="text-[11px] text-company-fg-subtle">회사 세무·회계 운영</p>
          </div>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            aria-label="전체 메뉴 열기"
            title="전체 메뉴"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-company-border bg-company-surface text-company-fg-muted hover:bg-company-nav-hover hover:text-foreground"
          >
            <Menu className="size-4.5" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(88vw,20rem)] bg-company-surface text-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>전체 메뉴</SheetTitle>
              <SheetDescription>회사 세무·회계 운영 화면으로 이동합니다.</SheetDescription>
            </SheetHeader>
            <div className="flex min-h-[calc(100dvh-2rem)] flex-col pt-2">
              <SidebarContent {...props} onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

function SidebarContent({
  userName,
  tenantName,
  bookkeepingPendingCount = 0,
  payrollEmployeeCount = 0,
  filingAttentionCount = 0,
  filingPrepAttentionCount = 0,
  reminderAttentionCount = 0,
  businessType = 'unknown',
  onNavigate,
  onToggleDesktopCollapse,
}: SidebarProps & { onNavigate?: () => void }) {
  const annualFilingChildren = annualFilingChildNav(businessType)

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-1"
      onClickCapture={(event) => {
        if (event.target instanceof Element && event.target.closest('a')) onNavigate?.()
      }}
    >
      <div className="flex items-start gap-2 px-2 pb-[18px]">
        <div className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-foreground text-[15px] font-bold text-background">
          자
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-tight">SemuAgent</p>
          <p className="truncate text-[11px] text-company-fg-subtle">회사 세무·회계 운영</p>
        </div>
        {onToggleDesktopCollapse ? (
          <button
            type="button"
            className="mt-0.5 hidden size-8 shrink-0 items-center justify-center rounded-lg text-company-fg-muted hover:bg-company-nav-hover hover:text-foreground md:inline-flex"
            aria-label="사이드바 숨기기"
            title="사이드바 숨기기"
            onClick={(event) => {
              event.stopPropagation()
              onToggleDesktopCollapse()
            }}
          >
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        <SidebarNavLink href={SEBISEO_NAV.href}>
          <NavGlyph>{SEBISEO_NAV.glyph}</NavGlyph>
          <span className="min-w-0 flex-1 truncate">{SEBISEO_NAV.label}</span>
        </SidebarNavLink>
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
              : item.href === '/dashboard/filing-preparation'
                ? filingPrepAttentionCount
                : 0

          return (
            <div key={item.href}>
              <SidebarNavLink href={item.href} badge={badge}>
                <NavGlyph>{item.glyph}</NavGlyph>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </SidebarNavLink>
              {item.href === '/dashboard/bookkeeping' ? (
                <div className="mt-0.5 ml-[28px] flex flex-col gap-0.5">
                  {BOOKKEEPING_CHILD_NAV.map((child) => (
                    <SidebarNavLink key={child.href} href={child.href}>
                      <span className="w-[10px] shrink-0 text-center text-[12px] text-company-fg-subtle" aria-hidden="true">
                        ›
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{child.label}</span>
                    </SidebarNavLink>
                  ))}
                </div>
              ) : null}
              {item.href === '/dashboard/payroll' ? (
                <div className="mt-0.5 ml-[28px] flex flex-col gap-0.5">
                  {PAYROLL_CHILD_NAV.map((child) => (
                    <SidebarNavLink
                      key={child.href}
                      href={child.href}
                      badge={child.href === '/dashboard/filing-support' ? filingAttentionCount : 0}
                    >
                      <span className="w-[10px] shrink-0 text-center text-[12px] text-company-fg-subtle" aria-hidden="true">
                        ›
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{child.label}</span>
                    </SidebarNavLink>
                  ))}
                </div>
              ) : null}
              {item.href === '/dashboard/filing-preparation' && annualFilingChildren.length > 0 ? (
                <div className="mt-0.5 ml-[28px] flex flex-col gap-0.5">
                  {annualFilingChildren.map((child) => (
                    <SidebarNavLink key={child.label} href={child.href}>
                      <span className="w-[10px] shrink-0 text-center text-[12px] text-company-fg-subtle" aria-hidden="true">
                        ›
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{child.label}</span>
                    </SidebarNavLink>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}

        <p className="px-2 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.04em] text-company-fg-subtle uppercase">
          관리
        </p>

        {MANAGE_NAV.map((item) => (
          <SidebarNavLink
            key={item.href}
            href={item.href}
            badge={item.href === '/dashboard/reminders' ? reminderAttentionCount : 0}
          >
            <NavGlyph>{item.glyph}</NavGlyph>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </SidebarNavLink>
        ))}
      </nav>

      <div className="mt-2 border-t border-company-border pt-2">
        <div className="px-2 pb-1.5">
          <ThemeModeMenu />
        </div>
        <div className="flex items-center gap-2.5 px-2 py-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-company-fg-muted">
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
    </div>
  )
}

function NavGlyph({ children }: { children: string }) {
  return (
    <span className="w-[18px] shrink-0 text-center text-[13px] opacity-80" aria-hidden="true">
      {children}
    </span>
  )
}
