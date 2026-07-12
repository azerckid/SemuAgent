import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceRoot = process.cwd()
const sidebarSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sidebar.tsx'), 'utf8')
const layoutSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/layout.tsx'), 'utf8')
const sampleBannerSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sample-data-banner.tsx'), 'utf8')
const companyHomePreview = readFileSync(join(workspaceRoot, 'docs/02_UI_Screens/previews/00_company_home.html'), 'utf8')

describe('dashboard sidebar cadence navigation (JC-036)', () => {
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
      label: '지급명세서·연말정산',
    },
    {
      href: '/dashboard/filing-preparation/local-income-tax',
      previewHref: '10_local_income_tax.html',
      label: '지방소득세',
    },
  ]

  it('groups withholding/payment-statements/local-income-tax/employees under 급여·지급', () => {
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

  it('uses a mobile menu sheet instead of a fixed 248px sidebar below md', () => {
    expect(sidebarSource).toContain('hidden h-screen w-[248px]')
    expect(sidebarSource).toContain('md:flex')
    expect(sidebarSource).toContain('md:hidden')
    expect(sidebarSource).toContain('aria-label="전체 메뉴 열기"')
    expect(sidebarSource).toContain('<SheetContent side="left"')
    expect(sidebarSource).toContain('<SidebarContent {...props}')
    expect(layoutSource).toContain('grid-cols-1')
    expect(layoutSource).toContain('md:grid-cols-[248px_minmax(0,1fr)]')
    expect(sampleBannerSource).toContain('px-4')
    expect(sampleBannerSource).toContain('sm:px-7')
  })
})
