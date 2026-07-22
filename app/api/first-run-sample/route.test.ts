import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('first-run sample API route contract', () => {
  it('keeps the route behind tenant session and active staff guards (S-40)', () => {
    const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')

    expect(source).toContain('requireTenantSession')
    expect(source).toContain('getActiveStaffForUser')
    expect(source).toContain('ensureFirstRunSampleDataset')
    expect(source).toContain('deleteFirstRunSampleDataset')
    expect(source).toContain('purgeFirstRunSampleDataset')
    expect(source).toContain('after(async () =>')
  })
})
