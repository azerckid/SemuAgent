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

  it('shows the honest income-tax + local-income-tax breakdown with a confirmed-value source', () => {
    for (const token of ['원천세 구성', '소득세', '지방소득세', '합계', '급여자료 확정값', '업로드 자료', '위택스']) {
      expect(cellSource).toContain(token)
    }
  })

  it('never claims the amount was recomputed from the withholding tax table', () => {
    for (const misleading of ['세액표 기준 산출', '세액표로 계산', '세액표 재계산한 값입니다', '자동 계산됨']) {
      expect(cellSource).not.toContain(misleading)
    }
    expect(cellSource).toContain('간이세액표로 재계산한 값이 아닙니다')
  })

  it('is wired into the payroll register in place of the plain money cell', () => {
    expect(workspaceSource).toContain('WithholdingBreakdownCell')
    expect(workspaceSource).not.toContain('<MoneyCell value={row.withholdingTaxKrw}')
  })
})
