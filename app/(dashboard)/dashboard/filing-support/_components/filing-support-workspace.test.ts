import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentsDir = new URL('.', import.meta.url)
const workspaceRoot = join(componentsDir.pathname, '../../../../..')
const workspaceSource = readFileSync(new URL('./filing-support-workspace.tsx', import.meta.url), 'utf8')
const actionsSource = readFileSync(new URL('./filing-actions.tsx', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')
const summarySource = readFileSync(join(workspaceRoot, 'lib/filing-support/summary.ts'), 'utf8')
const validationsSource = readFileSync(join(workspaceRoot, 'lib/validations/filing-support.ts'), 'utf8')
const receiptRouteSource = readFileSync(join(workspaceRoot, 'app/api/filing/receipts/route.ts'), 'utf8')
const receiptDeleteRouteSource = readFileSync(join(workspaceRoot, 'app/api/filing/receipts/[receiptId]/route.ts'), 'utf8')
const checklistRouteSource = readFileSync(join(workspaceRoot, 'app/api/filing/checklist-items/[itemId]/route.ts'), 'utf8')
const sidebarSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sidebar.tsx'), 'utf8')
const layoutSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/layout.tsx'), 'utf8')
const companyHomeSummarySource = readFileSync(join(workspaceRoot, 'lib/company-home/summary.ts'), 'utf8')

describe('filing support workspace static contract (JC-013)', () => {
  it('renders the approved Preview 4.6 section order (S-01, S-71)', () => {
    const sectionOrder = [
      'ResponsibilityBanner',
      'FilingItemsSection',
      'InputGuideCard',
      'ReceiptsCard',
      'ChecklistSection',
      'StateCoverageSection',
      'PreviewNote',
    ]
    const positions = sectionOrder.map((token) => workspaceSource.indexOf(`<${token}`))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('routes company navigation to the preview-aligned filing support screen (S-02, S-73)', () => {
    expect(sidebarSource).toContain("href: '/dashboard/filing-support'")
    expect(sidebarSource).toContain('filingAttentionCount')
    expect(layoutSource).toContain('loadFilingSupportAttentionCount')
    expect(companyHomeSummarySource).toContain("filingSupport: '/dashboard/filing-support'")
  })

  it('keeps the responsibility boundary visible and avoids misleading submission/payment CTAs (S-04, S-60~63)', () => {
    const renderSource = `${workspaceSource}\n${summarySource}\n${actionsSource}`

    expect(renderSource).toContain('신고서 제출을 대행하지 않습니다')
    expect(renderSource).toContain('자동 제출 아님')
    expect(renderSource).toContain('신고서 자동 제출·세금 자동 납부는 제공하지 않습니다')

    for (const forbidden of [
      '홈택스 제출하기',
      '자동 제출',
      '자동 납부',
      '납부하기</button>',
      '공동인증서 저장',
      'password',
      'certificate',
      'scrape',
    ]) {
      expect(actionsSource).not.toContain(forbidden)
      expect(receiptRouteSource).not.toContain(forbidden)
      expect(checklistRouteSource).not.toContain(forbidden)
    }
  })

  it('does not import old GIWA mail/request/customer portal workspaces (S-70)', () => {
    const implementationSource = [
      pageSource,
      workspaceSource,
      actionsSource,
      summarySource,
      receiptRouteSource,
      receiptDeleteRouteSource,
      checklistRouteSource,
    ].join('\n')

    for (const forbidden of [
      'client-request',
      'clientRequest',
      'mailbox',
      'inboundEmail',
      'outboundEmail',
      'request_template',
      'upload/[token]',
      'UploadPortal',
    ]) {
      expect(implementationSource).not.toContain(forbidden)
    }
  })

  it('keeps locked package buttons disabled with visible lock notes (S-20, S-72)', () => {
    expect(workspaceSource).toContain('aria-disabled="true"')
    expect(workspaceSource).toContain('disabled')
    expect(workspaceSource).toContain('item.lockReason')
    expect(summarySource).toContain('패키지 · 잠김')
  })

  it('wires receipt and checklist mutations to tenant-scoped API routes (S-40~43, S-50~53)', () => {
    expect(actionsSource).toContain("fetch('/api/filing/receipts'")
    expect(actionsSource).toContain('fetch(`/api/filing/receipts/${receiptId}`')
    expect(actionsSource).toContain('fetch(`/api/filing/checklist-items/${itemId}`')

    for (const routeSource of [receiptRouteSource, receiptDeleteRouteSource, checklistRouteSource]) {
      expect(routeSource).toContain('requireTenantSession')
      expect(routeSource).toContain('getActiveStaffForUser')
      expect(routeSource).toContain('tenantId')
      expect(routeSource).toContain("revalidatePath('/dashboard/filing-support')")
    }
  })

  it('validates filing input shape and never exposes private storage keys in the UI (S-44)', () => {
    expect(validationsSource).toContain('filingPeriodKeySchema')
    expect(validationsSource).toContain('filingReceiptCreateSchema')
    expect(validationsSource).toContain('filingChecklistPatchSchema')
    expect(receiptRouteSource).toContain('storageKey:')
    expect(workspaceSource).not.toContain('storageKey')
    expect(actionsSource).not.toContain('storageKey')
  })

  it('keeps visible copy aligned to the approved static preview', () => {
    const renderSource = `${workspaceSource}\n${summarySource}\n${actionsSource}`

    for (const token of [
      '신고 항목 · 첨부 패키지',
      '홈택스 입력 가이드 · 원천세',
      '가이드 값 복사',
      '제출 접수증 보관',
      '사후 체크리스트',
      '화면 상태 예시',
      '아직 신고할 항목이 없습니다',
      '책임 경계',
    ]) {
      expect(renderSource).toContain(token)
    }
  })
})
