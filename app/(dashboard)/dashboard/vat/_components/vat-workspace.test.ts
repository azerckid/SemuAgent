import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(new URL('./vat-workspace.tsx', import.meta.url), 'utf8')
const actionsSource = readFileSync(new URL('./vat-actions.tsx', import.meta.url), 'utf8')
const treatmentActionsSource = readFileSync(new URL('./vat-tax-treatment-actions.tsx', import.meta.url), 'utf8')
const treatmentDialogSource = readFileSync(new URL('./vat-tax-treatment-decision-dialog.tsx', import.meta.url), 'utf8')
const deductionRouteSource = readFileSync(new URL('../../../../api/vat/deduction-reviews/[reviewId]/route.ts', import.meta.url), 'utf8')
const treatmentRouteSource = readFileSync(new URL('../../../../api/vat/tax-treatments/[rowId]/route.ts', import.meta.url), 'utf8')
const packageRouteSource = readFileSync(new URL('../../../../api/vat/periods/[periodKey]/package/route.ts', import.meta.url), 'utf8')
const rebuildRouteSource = readFileSync(new URL('../../../../api/vat/periods/[periodKey]/rebuild/route.ts', import.meta.url), 'utf8')
const sidebarSource = readFileSync(new URL('../../../_components/sidebar.tsx', import.meta.url), 'utf8')
const companyHomeSummarySource = readFileSync(new URL('../../../../../lib/company-home/summary.ts', import.meta.url), 'utf8')
const vatPageSource = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')
const vatSummarySource = readFileSync(new URL('../../../../../lib/vat/summary.ts', import.meta.url), 'utf8')
const internalReminderSummarySource = readFileSync(new URL('../../../../../lib/internal-reminders/summary.ts', import.meta.url), 'utf8')
const filingPreparationSummarySource = readFileSync(new URL('../../../../../lib/filing-preparation/summary.ts', import.meta.url), 'utf8')
const packageGateSource = readFileSync(new URL('../../../../../lib/vat/package-gate.ts', import.meta.url), 'utf8')

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
      'TaxTreatmentSection',
      'DeductionReviewSection',
      'SchedulesSection',
      'PackagePreviewCard',
      'StateCoverageSection',
    ]
    const positions = sectionOrder.map((token) => workspaceSource.indexOf(`<${token}`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('renders VAI recommendations as expected Hometax guidance with explicit VAI-4b user actions', () => {
    expect(workspaceSource).toContain('summary.taxTreatmentRows')
    expect(workspaceSource).toContain('자동채움 예상')
    expect(workspaceSource).toContain('공식 규칙')
    expect(workspaceSource).toContain('이전 확정 패턴')
    expect(workspaceSource).toContain("? '사용자 확정'")
    expect(workspaceSource).toContain('VatTaxTreatmentActions')
    expect(workspaceSource).toContain('AI 판단을 불러오지 못했습니다. 수동 검토를 계속할 수 있습니다.')
    expect(workspaceSource).toContain("aiRuntimeStatus === 'manual_fallback'")
    expect(workspaceSource).toContain("return '수동 확인'")
    expect(treatmentActionsSource).toContain('적용')
    expect(treatmentActionsSource).toContain('다르게')
    expect(treatmentActionsSource).toContain('보류')
    expect(treatmentActionsSource).toContain('전문가 확인')
    expect(treatmentActionsSource).toContain('/api/vat/tax-treatments/${rowId}')
    expect(treatmentActionsSource).toContain("label: '되돌리기'")
    expect(treatmentDialogSource).toContain('공제 안분율 (%)')
    expect(treatmentDialogSource).toContain('다르게 확정하는 근거를 입력해 주세요.')
    expect(treatmentRouteSource).toContain('requireTenantSession')
    expect(treatmentRouteSource).toContain('vatTaxTreatmentMutationSchema.safeParse(await req.json())')
  })

  it('enables VAI-3b AI only on the VAT page, not shared summary consumers', () => {
    expect(vatPageSource).toContain('includeTaxTreatmentAi: true')
    expect(vatSummarySource).toContain('includeTaxTreatmentAi = false')
    expect(internalReminderSummarySource).not.toContain('includeTaxTreatmentAi')
    expect(filingPreparationSummarySource).not.toContain('includeTaxTreatmentAi')
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
    expect(workspaceSource).toContain('VatProvenanceRebuildButton')
    expect(actionsSource).toContain('/api/vat/periods/${periodKey}/rebuild')
    expect(rebuildRouteSource).toContain('rebuildVatPeriodSummaryFromConfirmedLedger')
    expect(rebuildRouteSource).toContain('packageGate.provenance.canRebuild')
    expect(rebuildRouteSource).toContain("code: 'vat_provenance_rebuild_blocked'")
  })

  it('uses the same VAI-6 tax-treatment gate in the VAT page, rebuild API, and package API (S-99)', () => {
    expect(vatPageSource).toContain('buildVatTaxTreatmentGate(summary.taxTreatmentRows)')
    expect(packageGateSource).toContain('loadVatTaxTreatmentGate')
    expect(packageGateSource).toContain('params.taxTreatmentGate.isReady')
    expect(packageGateSource).toContain("code: 'vat_tax_treatment_incomplete'")
    expect(packageRouteSource).toContain('loadVatPackageGate')
    expect(packageRouteSource).toContain('if (!packageGate.isReady)')
    expect(rebuildRouteSource).toContain('loadVatPackageGate')
    expect(rebuildRouteSource).toContain('if (!packageGate.provenance.canRebuild)')
  })
})
