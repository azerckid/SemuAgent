import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/api/sebiseo/chat/route.ts'), 'utf8')

describe('POST /api/sebiseo/chat contract', () => {
  it('requires tenant auth and delegates to the guarded chat handler', () => {
    expect(source).toContain('requireTenantSession')
    expect(source).toContain('sebiseoChatRequestSchema.safeParse')
    expect(source).toContain('handleSebiseoChat')
  })

  it('does not write canonical data or call upload analysis', () => {
    expect(source).not.toMatch(/\.insert\(/)
    expect(source).not.toMatch(/\.update\(/)
    expect(source).not.toMatch(/\.delete\(/)
    expect(source).not.toContain("@/lib/ai/analyze")
  })
})
