import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(new URL('./vat-workspace.tsx', import.meta.url), 'utf8')
const actionsSource = readFileSync(new URL('./vat-actions.tsx', import.meta.url), 'utf8')
const deductionRouteSource = readFileSync(new URL('../../../../api/vat/deduction-reviews/[reviewId]/route.ts', import.meta.url), 'utf8')
const packageRouteSource = readFileSync(new URL('../../../../api/vat/periods/[periodKey]/package/route.ts', import.meta.url), 'utf8')
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

  it('wires deduction review actions to the VAT mutation endpoint (S-50~52)', () => {
    expect(workspaceSource).toContain('VatDeductionActionButtons')
    expect(actionsSource).toContain('/api/vat/deduction-reviews/${reviewId}')
    expect(actionsSource).toContain("decision: 'non_deductible'")
    expect(actionsSource).toContain("decision: 'prorated'")
    expect(actionsSource).toContain('prorationRateBps')
    expect(actionsSource).toContain('isProrationOpen')
    expect(actionsSource).not.toContain('window.prompt')
  })

  it('guards deduction review mutations by tenant and recalculates the period summary (S-53)', () => {
    expect(deductionRouteSource).toContain('requireTenantSession')
    expect(deductionRouteSource).toContain('getActiveStaffForUser')
    expect(deductionRouteSource).toContain('vatDeductionReviewPatchSchema.safeParse(await req.json())')
    expect(deductionRouteSource).toContain('eq(vatDeductionReview.tenantId, tenantId)')
    expect(deductionRouteSource).toContain('buildVatPeriodRecalculation')
    expect(deductionRouteSource).toContain("revalidatePath('/dashboard/vat')")
  })

  it('uses the shared composite gate in the VAT UI and package API (S-63~65)', () => {
    expect(workspaceSource).toContain('VatPackageActionButton')
    expect(workspaceSource).toContain('packageGate.reasons')
    expect(workspaceSource).toContain('reason.targetRoute')
    expect(actionsSource).toContain('/api/vat/periods/${periodKey}/package')
    expect(packageRouteSource).toContain('vatPeriodKeySchema.safeParse(rawPeriodKey)')
    expect(packageRouteSource).toContain('eq(vatPeriodSummary.tenantId, tenantId)')
    expect(packageRouteSource).toContain('loadVatPackageGate')
    expect(packageRouteSource).toContain('vat_package_gate_blocked')
    expect(packageRouteSource).toContain('reasons: packageGate.reasons')
    expect(packageRouteSource).toContain('status: 409')
    expect(packageRouteSource).toContain('reviewRows.length > 0')
    expect(packageRouteSource).toContain('inputTaxDeductibleKrw: periodSummary.inputTaxDeductibleKrw')
    expect(packageRouteSource).toContain("packageStatus: 'generated'")
  })
})
