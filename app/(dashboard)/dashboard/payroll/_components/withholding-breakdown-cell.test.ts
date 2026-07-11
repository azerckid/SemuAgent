import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const cellSource = readFileSync(new URL('./withholding-breakdown-cell.tsx', import.meta.url), 'utf8')
const workspaceSource = readFileSync(new URL('./payroll-workspace.tsx', import.meta.url), 'utf8')

describe('withholding breakdown cell static contract (JC-012)', () => {
  it('is a client component using the shared popover (click to open)', () => {
    expect(cellSource).toContain("'use client'")
    expect(cellSource).toContain("from '@/components/ui/popover'")
    expect(cellSource).toContain('PopoverTrigger')
    expect(cellSource).toContain('PopoverContent')
  })

  it('shows the honest income-tax + local-income-tax breakdown with a source per employment type', () => {
    for (const token of ['원천세 구성', '소득세', '지방소득세', '합계', '지방세로 별도 신고']) {
      expect(cellSource).toContain(token)
    }
  })

  it('cites the correct calculation basis per employment type (정규직=간이세액표, 프리랜서=3.3%, 일용직=일용 산식)', () => {
    // 정규직만 근로소득 간이세액표(별표2) 조회이며, 다른 고용형태에는 그 문구를 쓰지 않는다.
    expect(cellSource).toContain('간이세액표(별표2) 조회값')
    expect(cellSource).toContain('공제대상가족')
    expect(cellSource).toContain('사업소득 원천징수 3.3%')
    expect(cellSource).toContain('일용근로소득 산식')
    // 연말정산 확정 문구는 정규직 근로소득에만 붙는다.
    expect(cellSource).toContain('연말정산에서 확정')
    // 값이 하드코딩 업로드 자료라는 옛 표현이나 오해 소지 문구는 남기지 않는다.
    for (const removed of ['업로드 자료', '세액표 기준 산정', '자동 계산됨']) {
      expect(cellSource).not.toContain(removed)
    }
  })

  it('is wired into the payroll register in place of the plain money cell', () => {
    expect(workspaceSource).toContain('WithholdingBreakdownCell')
    expect(workspaceSource).not.toContain('<MoneyCell value={row.withholdingTaxKrw}')
  })
})
