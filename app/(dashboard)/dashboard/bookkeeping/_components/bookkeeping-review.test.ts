import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentsDir = new URL('.', import.meta.url)
const workspaceRoot = join(componentsDir.pathname, '../../../../..')

describe('bookkeeping review UI boundaries (JC-010)', () => {
  const source = readFileSync(new URL('./bookkeeping-review.tsx', import.meta.url), 'utf8')
  const pageSource = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')
  const sidebarSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sidebar.tsx'), 'utf8')
  const sidebarNavLinkSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sidebar-nav-link.tsx'), 'utf8')
  const layoutSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/layout.tsx'), 'utf8')
  const companyHomeSummarySource = readFileSync(join(workspaceRoot, 'lib/company-home/summary.ts'), 'utf8')
  const reconciliationPageSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/dashboard/bookkeeping/reconciliation-ledger/page.tsx'), 'utf8')
  const reconciliationViewSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/dashboard/bookkeeping/reconciliation-ledger/_components/reconciliation-ledger-display-fixture-view.tsx'), 'utf8')

  it('renders the approved preview section order and core labels (S-01)', () => {
    expect(source).toContain('기장검토')
    expect(source).toContain('거래 분류 현황')
    expect(source).toContain('검토 대기')
    expect(source).toContain('신뢰도 낮음')
    expect(source).toContain('거래내용 / 상대처')
    expect(source).toContain('추천 계정과목')
    expect(source).toContain('선택 거래 상세')
    expect(source).toContain('분개 미리보기')
    expect(source).toContain('기간 귀속 · 승인')
    expect(source).toContain('화면 상태 예시')
  })

  it('does not import or render the GIWA reviews workspace components (S-60)', () => {
    const forbidden = [
      '/dashboard/reviews',
      'ReviewWorkspace',
      'ReviewWorkspaceDeferredPreviews',
      'review-workspace',
      'review-validation-table',
    ]

    for (const token of forbidden) {
      expect(source).not.toContain(token)
      expect(pageSource).not.toContain(token)
    }
  })

  it('does not use accounting-firm or customer-request wording (S-62)', () => {
    const forbiddenWords = ['고객사', '세무사', '회계법인', '고객 요청']
    for (const word of forbiddenWords) {
      expect(source).not.toContain(word)
      expect(pageSource).not.toContain(word)
    }
  })

  it('routes company navigation to the preview-aligned bookkeeping screen (S-02)', () => {
    expect(sidebarSource).toContain("href: '/dashboard/bookkeeping'")
    expect(sidebarSource).toContain("href: '/dashboard/bookkeeping/reconciliation-ledger'")
    expect(sidebarSource).toContain('자료대조원장')
    expect(companyHomeSummarySource).toContain("bookkeeping: '/dashboard/bookkeeping'")
    expect(companyHomeSummarySource).toContain("reconciliationLedger: '/dashboard/bookkeeping/reconciliation-ledger'")
    expect(companyHomeSummarySource).toContain('자료대조원장 열기')
  })

  it('renders the reconciliation ledger route as a dedicated Path 1 gate', () => {
    expect(reconciliationPageSource).toContain('ReconciliationLedgerDisplayFixtureView')
    expect(reconciliationViewSource).toContain('자료대조원장')
    expect(reconciliationViewSource).toContain('PeriodScopeControl')
    expect(reconciliationViewSource).not.toContain('Path 1 데이터 준비 관문')
    expect(reconciliationViewSource).toContain('filter="bank"')
    expect(reconciliationPageSource).toContain('normalizeReconciliationDisplayFilter(source)')
  })

  it('serves the live ReconciliationLedgerDisplayModel by default and fixture only when requested', () => {
    expect(reconciliationPageSource).toContain('isReconciliationDisplayFixtureMode(display)')
    expect(reconciliationPageSource).toContain('buildLiveReconciliationLedgerDisplayModel(summary)')
    expect(reconciliationPageSource).toContain('loadReconciliationLedgerDisplayFixture()')
  })

  it('renders the pending-count sidebar badge from the server layout for Preview parity', () => {
    expect(sidebarSource).toContain('bookkeepingPendingCount')
    expect(sidebarSource).toContain('badge={badge}')
    expect(sidebarNavLinkSource).toContain('bg-[#fef2f2]')
    expect(sidebarNavLinkSource).toContain('text-[#dc2626]')
    expect(layoutSource).toContain('loadBookkeepingReviewPendingCount')
    expect(layoutSource).toContain('bookkeepingPendingCount={bookkeepingPendingCount}')
  })

  it('keeps the queue panel height aligned with the approved Preview', () => {
    expect(source).toContain('max-h-[350px] overflow-y-auto')
  })
})
