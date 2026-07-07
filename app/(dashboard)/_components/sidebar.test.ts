import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceRoot = process.cwd()
const sidebarSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sidebar.tsx'), 'utf8')
const companyHomePreview = readFileSync(join(workspaceRoot, 'docs/02_UI_Screens/previews/00_company_home.html'), 'utf8')

describe('dashboard sidebar filing-preparation navigation', () => {
  const childRoutes = [
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
    {
      href: '/dashboard/filing-preparation/business-status-report',
      previewHref: '11_business_status_report.html',
      label: '사업장현황신고',
    },
  ]

  it('keeps the implemented sidebar aligned with the approved company-home preview', () => {
    expect(sidebarSource).toContain("href: '/dashboard/filing-preparation'")
    expect(sidebarSource).toContain('FILING_PREPARATION_CHILD_NAV')
    expect(companyHomePreview).toContain('08_filing_preparation.html')

    for (const route of childRoutes) {
      expect(sidebarSource).toContain(route.href)
      expect(sidebarSource).toContain(route.label)
      expect(companyHomePreview).toContain(route.previewHref)
      expect(companyHomePreview).toContain(route.label)
    }
  })
})
