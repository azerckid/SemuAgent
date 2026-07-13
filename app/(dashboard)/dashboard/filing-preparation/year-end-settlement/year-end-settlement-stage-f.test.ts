import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceRoot = process.cwd()
const summarySource = readFileSync(join(workspaceRoot, 'lib/payment-statements/summary.ts'), 'utf8')
const reviewSource = readFileSync(join(
  workspaceRoot,
  'app/(dashboard)/dashboard/filing-preparation/year-end-settlement/_components/year-end-settlement-review.tsx',
), 'utf8')
const employeeRowSource = readFileSync(join(
  workspaceRoot,
  'app/(dashboard)/dashboard/filing-preparation/year-end-settlement/_components/year-end-settlement-employee-row.tsx',
), 'utf8')

describe('annual wage statement Stage F boundary', () => {
  it('keeps the approved Hometax handoff and compact employee workspace', () => {
    expect(reviewSource).toContain('홈택스 편리한 연말정산에서 지급명세서를 생성합니다')
    expect(reviewSource).toContain("['기초자료 등록', '공제신고서 확인', '지급명세서 생성', '확인·수정', '제출']")
    expect(reviewSource).toContain('직원별 급여 기초자료')
    expect(summarySource).toContain("ready: { label: '급여 준비 완료'")
    expect(reviewSource).toContain('급여 보완')
    expect(reviewSource).toContain('특례 확인')
    expect(reviewSource).toContain('결정세액·환급·추징도 홈택스 결과를 확인합니다')
    expect(reviewSource).not.toContain('ReviewHeroMetric')
    expect(reviewSource).not.toContain('ReviewBlockers')
    expect(reviewSource).not.toContain('readinessPercent')
  })

  it('keeps the runtime read-only and does not add PII, file, AI, or submission controls', () => {
    expect(employeeRowSource).not.toContain('fetch(')
    expect(employeeRowSource).not.toContain('<input')
    expect(employeeRowSource).not.toContain('type="file"')
    expect(employeeRowSource).not.toContain('AI')
    expect(reviewSource).not.toContain('자동 입력')
    expect(reviewSource).not.toContain('자동 제출')
    expect(summarySource).not.toContain('.insert(')
    expect(summarySource).not.toContain('.update(')
    expect(summarySource).not.toContain('.delete(')
  })

  it('pins every database read to tenant, client, and reporting-year periods', () => {
    expect(summarySource).toContain('eq(payrollPeriodSummary.tenantId, tenantId)')
    expect(summarySource).toContain('eq(payrollPeriodSummary.clientId, businessEntity.id)')
    expect(summarySource).toContain('inArray(payrollPeriodSummary.payrollPeriod, context.yearMonths)')
    expect(summarySource).toContain('eq(payrollEmployeeLine.tenantId, tenantId)')
    expect(summarySource).toContain('eq(payrollEmployeeLine.clientId, businessEntity.id)')
    expect(summarySource).toContain('eq(employeeProfile.tenantId, tenantId)')
    expect(summarySource).toContain('eq(employeeProfile.clientId, businessEntity.id)')
  })
})
