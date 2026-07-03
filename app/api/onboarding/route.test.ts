import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('onboarding first-run sample integration', () => {
  it('creates first-run sample data after organization onboarding without blocking onboarding (S-01/S-05)', () => {
    const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')

    expect(source).toContain('requireSession')
    expect(source).toContain('createTenantWithOrg')
    expect(source).toContain('ensureFirstRunSampleDataset')
    expect(source).toContain("source: 'first_run_onboarding'")
    expect(source).toContain("return NextResponse.json({ orgId: org.id, sampleStatus: sampleResult.status })")
    expect(source).not.toContain('throw sampleResult')
  })
})
