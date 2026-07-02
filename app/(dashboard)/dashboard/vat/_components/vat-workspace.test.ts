import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(new URL('./vat-workspace.tsx', import.meta.url), 'utf8')
const sidebarSource = readFileSync(new URL('../../../_components/sidebar.tsx', import.meta.url), 'utf8')
const companyHomeSummarySource = readFileSync(new URL('../../../../../lib/company-home/summary.ts', import.meta.url), 'utf8')

describe('VAT workspace static contract', () => {
  it('does not import or render the GIWA reviews workspace (S-70)', () => {
    expect(workspaceSource).not.toContain('/dashboard/reviews')
    expect(workspaceSource).not.toContain('ReviewWorkspace')
    expect(workspaceSource).not.toContain('review-workspace')
  })

  it('keeps Hometax submission/payment outside the actionable UI (S-71~72)', () => {
    expect(workspaceSource).toContain('패키지 생성')
    expect(workspaceSource).toContain('자동 홈택스 제출')
    expect(workspaceSource).not.toContain('홈택스 제출</button>')
    expect(workspaceSource).not.toContain('자동 납부</button>')
  })

  it('routes sidebar and company-home VAT CTAs to /dashboard/vat (S-02)', () => {
    expect(sidebarSource).toContain("href: '/dashboard/vat'")
    expect(companyHomeSummarySource).toContain("vat: '/dashboard/vat'")
    expect(companyHomeSummarySource).not.toContain("vat: '/dashboard#vat-status'")
  })

  it('keeps the approved Preview section order in the workspace (S-01)', () => {
    const sectionOrder = [
      'TaxSummaryHero',
      'SalesGroupsSection',
      'DeductionReviewSection',
      'SchedulesSection',
      'PackagePreviewCard',
      'StateCoverageSection',
    ]
    const positions = sectionOrder.map((token) => workspaceSource.indexOf(`<${token}`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })
})
