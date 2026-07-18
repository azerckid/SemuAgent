import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceRoot = process.cwd()
const sidebarSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sidebar.tsx'), 'utf8')
const layoutSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/layout.tsx'), 'utf8')
const dashboardShellSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/dashboard-shell.tsx'), 'utf8')
const sampleBannerSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sample-data-banner.tsx'), 'utf8')
const companyHomePreview = readFileSync(join(workspaceRoot, 'docs/02_UI_Screens/previews/00_company_home.html'), 'utf8')
const paymentStatementSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/dashboard/filing-preparation/payment-statements/_components/payment-statement-review.tsx'), 'utf8')
const yearEndSettlementSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/dashboard/filing-preparation/year-end-settlement/_components/year-end-settlement-review.tsx'), 'utf8')

describe('dashboard sidebar cadence navigation (JC-036)', () => {
  it('places 세비서 above 회사 홈 as the first nav item (JC-043)', () => {
    expect(sidebarSource).toContain("href: '/dashboard/sebiseo'")
    expect(sidebarSource).toContain("label: '세비서'")
    expect(sidebarSource).toContain("href: '/dashboard'")
    expect(sidebarSource).toContain("label: '회사 홈'")
    const sebiseoAt = sidebarSource.indexOf("href: '/dashboard/sebiseo'")
    const homeAt = sidebarSource.indexOf("label: '회사 홈'")
    expect(sebiseoAt).toBeGreaterThan(-1)
    expect(homeAt).toBeGreaterThan(sebiseoAt)
  })

  const payrollChildRoutes = [
    {
      href: '/dashboard/payroll',
      previewHref: '04_payroll.html',
      label: '급여',
    },
    {
      href: '/dashboard/employees',
      previewHref: '06_employee_directory.html',
      label: '직원 명부',
    },
    {
      href: '/dashboard/filing-support',
      previewHref: '05_filing_support.html',
      label: '원천세',
    },
    {
      href: '/dashboard/filing-preparation/payment-statements',
      previewHref: '09_payment_year_end.html',
      label: '지급명세서',
    },
    {
      href: '/dashboard/filing-preparation/year-end-settlement',
      previewHref: '15_year_end_settlement.html',
      label: '연말정산',
    },
    {
      href: '/dashboard/filing-preparation/local-income-tax',
      previewHref: '10_local_income_tax.html',
      label: '지방소득세',
    },
  ]

  it('groups withholding/payment-statements/year-end/local-income-tax/employees under 급여·지급', () => {
    expect(sidebarSource).toContain("href: '/dashboard/payroll'")
    expect(sidebarSource).toContain('PAYROLL_CHILD_NAV')
    expect(companyHomePreview).toContain('04_payroll.html')

    for (const route of payrollChildRoutes) {
      expect(sidebarSource).toContain(route.href)
      expect(sidebarSource).toContain(route.label)
      expect(companyHomePreview).toContain(route.previewHref)
      expect(companyHomePreview).toContain(route.label)
    }
  })

  it('keeps the 지급명세서 and 연말정산 screen responsibilities separate', () => {
    expect(paymentStatementSource).toContain('홈택스 직접작성 값')
    expect(paymentStatementSource).not.toContain('홈택스 직접작성 값 (JC-030)')
    expect(paymentStatementSource).not.toContain('홈택스 편리한 연말정산에서 지급명세서를 생성합니다')
    expect(yearEndSettlementSource).toContain('홈택스 편리한 연말정산에서 지급명세서를 생성합니다')
    expect(yearEndSettlementSource).not.toContain('홈택스 직접작성 값 (JC-030)')
  })

  it('keeps 사업장현황신고 under 연간신고 and drops the old 신고지원/신고 준비 top-level menus', () => {
    expect(sidebarSource).toContain("href: '/dashboard/filing-preparation'")
    expect(sidebarSource).toContain('ANNUAL_FILING_FIXED_CHILD_NAV')
    expect(sidebarSource).toContain('/dashboard/filing-preparation/business-status-report')
    expect(sidebarSource).toContain('사업장현황신고')
    expect(companyHomePreview).toContain('08_filing_preparation.html')
    expect(companyHomePreview).toContain('연간신고')

    expect(sidebarSource).not.toContain("label: '신고지원'")
    expect(sidebarSource).not.toContain("label: '신고 준비'")
  })

  it('branches 연간신고 children by business entity type without a rendering harness', () => {
    // sidebar.tsx는 RTL 등 렌더 테스트 인프라가 없어 기존 테스트와 같은 문자열 매치로
    // corporation/individual/tax_exempt/unknown 분기가 지워지지 않는지만 지킨다.
    expect(sidebarSource).toContain('function annualFilingChildNav')
    expect(sidebarSource).toContain("businessType === 'corporation'")
    expect(sidebarSource).toContain("businessType === 'individual'")
    expect(sidebarSource).toContain("businessType === 'tax_exempt'")
    expect(sidebarSource).toContain("label: '법인세'")
    expect(sidebarSource).toContain("label: '종합소득세'")
  })

  it('uses a mobile menu panel instead of a fixed 248px sidebar below md', () => {
    expect(sidebarSource).toContain('hidden')
    expect(sidebarSource).toContain('w-[248px]')
    expect(sidebarSource).toContain('md:flex')
    expect(sidebarSource).toContain('md:hidden')
    expect(sidebarSource).toContain('전체 메뉴 열기')
    expect(sidebarSource).not.toContain("from '@/components/ui/sheet'")
    expect(sidebarSource).toContain('<SidebarContent {...props}')
    expect(layoutSource).toContain('DashboardShell')
    expect(dashboardShellSource).toContain('grid-cols-1')
    expect(dashboardShellSource).toContain('md:grid-cols-[248px_minmax(0,1fr)]')
    expect(sampleBannerSource).toContain('px-4')
    expect(sampleBannerSource).toContain('sm:px-7')
  })

  it('keeps a persistent desktop top bar with SemuAgent and sidebar toggle', () => {
    const collapseContextSource = readFileSync(
      join(workspaceRoot, 'lib/dashboard/sidebar-collapse-context.tsx'),
      'utf8',
    )
    expect(layoutSource).toContain('DashboardShell')
    expect(dashboardShellSource).toContain('<header')
    expect(dashboardShellSource).toContain('SemuAgent')
    expect(dashboardShellSource).toContain('사이드바 숨기기')
    expect(dashboardShellSource).toContain('사이드바 표시')
    expect(dashboardShellSource).toContain('PanelLeftClose')
    expect(dashboardShellSource).toContain('PanelLeft')
    // Collapse store lives in context — avoids RSC→Client cloneElement crash.
    expect(dashboardShellSource).toContain('SidebarCollapseProvider')
    expect(dashboardShellSource).not.toMatch(/\bcloneElement\s*\(/)
    expect(collapseContextSource).toContain('useSyncExternalStore')
    expect(collapseContextSource).toContain('getSidebarCollapsedServerSnapshot')
    expect(dashboardShellSource).not.toContain('useState')
    expect(dashboardShellSource).not.toContain('useEffect')
    expect(dashboardShellSource).toContain('h-dvh')
    expect(dashboardShellSource).toContain('shrink-0')
    expect(dashboardShellSource).toContain('overflow-y-auto')
    // Brand toggle lives in the shell top bar, not inside the nav column.
    expect(sidebarSource).not.toContain('PanelLeftClose')
    expect(sidebarSource).not.toContain('사이드바 숨기기')
    expect(sidebarSource).not.toContain('sticky top-0')
    expect(sidebarSource).toContain('useSidebarCollapse')
    const headerAt = dashboardShellSource.indexOf('<header')
    const brandAt = dashboardShellSource.indexOf('>SemuAgent<', headerAt)
    const toggleAt = dashboardShellSource.indexOf('aria-label={toggleLabel}', headerAt)
    expect(headerAt).toBeGreaterThan(-1)
    expect(brandAt).toBeGreaterThan(headerAt)
    expect(toggleAt).toBeGreaterThan(brandAt)
  })
})
