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
})
