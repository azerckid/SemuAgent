import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentsDir = new URL('.', import.meta.url)
const workspaceRoot = join(componentsDir.pathname, '../../../../..')
const workspaceSource = readFileSync(new URL('./payroll-workspace.tsx', import.meta.url), 'utf8')
const actionsSource = readFileSync(new URL('./payroll-actions.tsx', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')
const summarySource = readFileSync(join(workspaceRoot, 'lib/payroll-workspace/summary.ts'), 'utf8')
const resolveRouteSource = readFileSync(join(workspaceRoot, 'app/api/payroll/employee-lines/[lineId]/resolve/route.ts'), 'utf8')
const closeRouteSource = readFileSync(join(workspaceRoot, 'app/api/payroll/periods/[period]/close/route.ts'), 'utf8')
const documentsRouteSource = readFileSync(join(workspaceRoot, 'app/api/payroll/periods/[period]/documents/route.ts'), 'utf8')
const noticeImportRouteSource = readFileSync(join(workspaceRoot, 'app/api/payroll/periods/[period]/insurance-notices/route.ts'), 'utf8')
const sidebarSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sidebar.tsx'), 'utf8')
const companyHomeSummarySource = readFileSync(join(workspaceRoot, 'lib/company-home/summary.ts'), 'utf8')

describe('payroll workspace static contract (JC-012)', () => {
  it('renders the approved Preview 4.5 section order (S-01)', () => {
    const sectionOrder = [
      'PayrollSummaryHero',
      'IssueAlert',
      'PayrollRegisterSection',
      'DeductionBreakdownCard',
      'PayrollDocumentsCard',
    ]
    const positions = sectionOrder.map((token) => workspaceSource.indexOf(`<${token}`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('does not render the old GIWA payroll request workspace at /dashboard/payroll (S-60)', () => {
    const forbidden = [
      'PayrollRequestList',
      'loadPayrollSummaries',
      'clientRequestEvent',
      '요청 목록을 테이블로 스캔',
      '기본업무메일',
    ]

    for (const token of forbidden) {
      expect(pageSource).not.toContain(token)
      expect(workspaceSource).not.toContain(token)
    }
  })

  it('keeps EDI automation and credential storage outside the actionable UI (S-36, S-91)', () => {
    expect(actionsSource).toContain('4대보험 고지액 수동 입력')
    expect(workspaceSource).not.toContain('자동 로그인')
    expect(workspaceSource).not.toContain('공동인증서 저장')
    expect(actionsSource).not.toContain('자동 로그인')
    expect(actionsSource).not.toContain('공동인증서 저장')
  })

  it('keeps the payroll close button visibly locked when closeAction is locked (S-50)', () => {
    expect(workspaceSource).toContain('PayrollCloseButton')
    expect(workspaceSource).toContain('closeAction={summary.closeAction}')
    expect(actionsSource).toContain('closeAction.locked')
    expect(actionsSource).toContain('aria-disabled={disabled}')
    expect(actionsSource).toContain('급여 마감·확정 · 잠김')
    // 마감 사유 문구는 하드코딩("1건")이 아니라 closeAction에서 계산된 lockReason을 노출한다.
    expect(workspaceSource).toContain('summary.closeAction.canClose')
    expect(workspaceSource).toContain('summary.closeAction.lockReason')
  })

  it('wires payroll mutations to tenant-scoped API routes (S-50~54)', () => {
    expect(workspaceSource).toContain('해당 직원 열기')
    expect(workspaceSource).toContain('임시 저장')
    expect(actionsSource).toContain('/api/payroll/employee-lines/${lineId}/resolve')
    expect(actionsSource).toContain('/api/payroll/periods/${periodKey}/documents')
    expect(actionsSource).toContain('/api/payroll/periods/${periodKey}/close')
    expect(actionsSource).toContain('/api/payroll/periods/${periodKey}/insurance-notices')

    for (const routeSource of [resolveRouteSource, closeRouteSource, documentsRouteSource, noticeImportRouteSource]) {
      expect(routeSource).toContain('requireTenantSession')
      expect(routeSource).toContain('getActiveStaffForUser')
      expect(routeSource).toContain('eq(')
      expect(routeSource).toContain('tenantId')
      expect(routeSource).toContain("revalidatePath('/dashboard/payroll')")
    }
  })

  it('keeps insurance notice import as upload/manual confirmation without credential storage (S-35~37)', () => {
    expect(noticeImportRouteSource).toContain('payrollInsuranceNoticeImportSchema.safeParse')
    expect(noticeImportRouteSource).toContain("storageKey: null")
    expect(noticeImportRouteSource).toContain('matchKeyHash')
    expect(noticeImportRouteSource).not.toContain('password')
    expect(noticeImportRouteSource).not.toContain('certificate')
    expect(noticeImportRouteSource).not.toContain('scrape')
  })

  it('routes company navigation to the preview-aligned payroll screen (S-02)', () => {
    expect(sidebarSource).toContain("href: '/dashboard/payroll'")
    expect(companyHomeSummarySource).toContain("payroll: '/dashboard/payroll'")
  })

  it('keeps the visible payroll UI aligned to the approved static preview copy', () => {
    const renderSource = `${workspaceSource}\n${summarySource}`

    for (const token of [
      '공제총액 (원천세·4대보험)',
      '확인 필요 직원 1명 — 마감 전 처리하세요',
      '직원별 지급·공제·실지급 내역',
      '엑셀 내보내기 →',
      '공제 상세 (원천세·4대보험)',
      '명세서 · 마감',
    ]) {
      expect(renderSource).toContain(token)
    }

    for (const removed of ['StateCoverageSection', '화면 상태 예시', 'Preview 안내']) {
      expect(workspaceSource).not.toContain(removed)
    }
  })
})
