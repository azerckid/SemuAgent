import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function source(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

describe('runtime UI trust boundaries', () => {
  const workspaceFiles = [
    'app/(dashboard)/dashboard/_components/company-home.tsx',
    'app/(dashboard)/dashboard/direct-upload/_components/source-collection.tsx',
    'app/(dashboard)/dashboard/bookkeeping/_components/bookkeeping-review.tsx',
    'app/(dashboard)/dashboard/payroll/_components/payroll-workspace.tsx',
    'app/(dashboard)/dashboard/reminders/_components/internal-reminders-workspace.tsx',
  ]

  it('keeps preview-only state demonstrations out of live workspaces', () => {
    for (const file of workspaceFiles) {
      const runtimeSource = source(file)
      expect(runtimeSource).not.toContain('StateCoverageSection')
      expect(runtimeSource).not.toContain('PreviewNote')
      expect(runtimeSource).not.toContain('화면 상태 예시')
      expect(runtimeSource).not.toContain('Preview 안내')
    }
  })

  it('does not expose a data-free confirmed-filing selector on company home', () => {
    expect(source(workspaceFiles[0])).not.toContain('확정 신고')
  })

  it('uses user-facing filing and settings language instead of internal project terms', () => {
    const filingHub = source('app/(dashboard)/dashboard/filing-preparation/_components/filing-preparation-hub.tsx')
    const filingSummary = source('lib/filing-preparation/summary.ts')
    const paymentStatement = source('app/(dashboard)/dashboard/filing-preparation/payment-statements/_components/payment-statement-review.tsx')
    const directEntry = source('app/(dashboard)/dashboard/filing-preparation/payment-statements/_components/simplified-wage-efiling-panel.tsx')
    const settings = source('app/(dashboard)/dashboard/settings/_components/settings-panel.tsx')

    for (const removed of ['신고 handoff', '병렬 신고 트랙', 'JC-023']) {
      expect(filingHub).not.toContain(removed)
    }
    for (const removed of ['handoff:', 'JC-024', 'JC-027', 'JC-030 파일']) {
      expect(filingSummary).not.toContain(removed)
    }
    expect(paymentStatement).not.toContain('(JC-030)')
    expect(directEntry).not.toContain('Path 1b')
    expect(settings).not.toContain('세목 트랙')
    expect(settings).not.toContain('Billing 화면')
  })

  it('uses the company home as the single-company entry point (S-40/S-41)', () => {
    const signIn = source('app/(auth)/sign-in/page.tsx')
    const onboarding = source('app/onboarding/page.tsx')
    const onboardingRoute = source('app/api/onboarding/route.ts')

    expect(signIn).toContain("router.push('/dashboard')")
    expect(signIn).not.toContain("router.push('/dashboard/clients')")
    expect(onboarding).toContain("router.replace('/dashboard')")
    expect(onboarding).toContain("router.push('/dashboard')")
    expect(onboarding).not.toContain('서브도메인')
    expect(onboarding).not.toContain('setSubdomain')
    expect(onboardingRoute).toContain('buildCompanyOrganizationSlug')
  })

  it('keeps company settings focused on company information and users (S-42/S-44)', () => {
    const settingsPage = source('app/(dashboard)/dashboard/settings/page.tsx')
    const settingsPanel = source('app/(dashboard)/dashboard/settings/_components/settings-panel.tsx')

    expect(settingsPanel).toContain("const SETTINGS_TABS = ['tenant', 'staff'] as const")
    expect(settingsPanel).toContain("{ key: 'tenant', label: '회사 정보' }")
    expect(settingsPanel).toContain("{ key: 'staff', label: '사용자 관리' }")
    expect(settingsPanel).toContain('일반 사용자')
    for (const removed of ['담당자 관리', '업무메일 설정', '사업장 관리', '업무 메일함', 'tenant-subdomain']) {
      expect(settingsPanel).not.toContain(removed)
    }
    expect(settingsPage).not.toContain('staffMailbox')
    expect(settingsPage).not.toContain('workEmailAddresses')
  })

  it('uses one shared blocker surface across filing screens (S-45/S-46)', () => {
    const blockerScreens = [
      'app/(dashboard)/dashboard/filing-preparation/_components/filing-preparation-hub.tsx',
      'app/(dashboard)/dashboard/filing-preparation/payment-statements/_components/payment-statement-review.tsx',
      'app/(dashboard)/dashboard/filing-preparation/local-income-tax/_components/local-income-tax-review.tsx',
      'app/(dashboard)/dashboard/filing-preparation/business-status-report/_components/business-status-report-review.tsx',
    ]

    for (const file of blockerScreens) {
      const runtimeSource = source(file)
      expect(runtimeSource).toContain('<ActionBlockerList')
      expect(runtimeSource).not.toContain('grid-cols-[12px_1fr_auto]')
    }

    const sharedList = source('app/(dashboard)/dashboard/filing-preparation/_components/action-blocker-list.tsx')
    expect(sharedList).toContain('if (items.length === 0) return null')
    expect(sharedList).toContain('sm:grid-cols-[10px_minmax(0,1fr)_auto]')
  })

  it('uses one period context surface and only server-built navigation hrefs (S-47)', () => {
    const periodScreens = [
      'app/(dashboard)/dashboard/filing-preparation/_components/filing-preparation-hub.tsx',
      'app/(dashboard)/dashboard/filing-preparation/payment-statements/_components/payment-statement-review.tsx',
      'app/(dashboard)/dashboard/filing-preparation/local-income-tax/_components/local-income-tax-review.tsx',
      'app/(dashboard)/dashboard/filing-preparation/business-status-report/_components/business-status-report-review.tsx',
      'app/(dashboard)/dashboard/filing-preparation/year-end-settlement/_components/year-end-settlement-review.tsx',
    ]

    for (const file of periodScreens) {
      expect(source(file)).toContain('<PeriodContextControl')
    }

    const periodPages = [
      'app/(dashboard)/dashboard/filing-preparation/page.tsx',
      'app/(dashboard)/dashboard/filing-preparation/payment-statements/page.tsx',
      'app/(dashboard)/dashboard/filing-preparation/local-income-tax/page.tsx',
      'app/(dashboard)/dashboard/filing-preparation/business-status-report/page.tsx',
      'app/(dashboard)/dashboard/filing-preparation/year-end-settlement/page.tsx',
    ]
    for (const file of periodPages) {
      expect(source(file)).toContain('buildPeriodNavigationHrefs')
    }

    const sharedControl = source('app/(dashboard)/dashboard/filing-preparation/_components/period-context-control.tsx')
    expect(sharedControl).toContain("data-period-navigation={hasNavigation ? 'navigable' : 'read-only'}")
    expect(sharedControl).not.toContain('URLSearchParams')
    expect(sharedControl).not.toContain('router.')
  })

  it('uses one portal guide without overstating the pending Wetax source (S-48/S-49)', () => {
    const withholding = source('app/(dashboard)/dashboard/filing-support/_components/withholding-efiling-panel.tsx')
    const localIncomeTax = source('app/(dashboard)/dashboard/filing-preparation/local-income-tax/_components/local-income-tax-review.tsx')
    const sharedGuide = source('app/(dashboard)/dashboard/filing-preparation/_components/filing-portal-guide.tsx')

    expect(withholding).toContain('<FilingPortalGuide')
    expect(withholding).toContain("portal: 'hometax'")
    expect(withholding).toContain("portal: 'wetax'")
    expect(localIncomeTax).toContain('<FilingPortalGuide')
    expect(localIncomeTax).toContain("readiness: 'source_pending'")
    expect(sharedGuide.indexOf('SemuAgent에서 준비')).toBeLessThan(sharedGuide.indexOf('사용자가 수행'))
    expect(sharedGuide).toContain('공식 원본 입수 대기')

    for (const overstatement of ['파일 다운로드', '업로드 가능', '검증 완료']) {
      expect(`${withholding}\n${localIncomeTax}\n${sharedGuide}`).not.toContain(overstatement)
    }
  })
})
