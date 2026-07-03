import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
import { FIRST_RUN_SAMPLE_DELETE_TABLES } from './cleanup'

describe('first-run sample cleanup safety', () => {
  it('keeps cleanup limited to an explicit whitelist and leaves business entity rows alone (S-70)', () => {
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).toContain('request_item_validation_file')
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).toContain('internal_reminder_send_log')
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).not.toContain('client')
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).not.toContain('tenant')
    expect(FIRST_RUN_SAMPLE_DELETE_TABLES).not.toContain('staff')
  })

  it('does not build arbitrary SQL delete strings (S-71)', () => {
    const source = readFileSync(new URL('./cleanup.ts', import.meta.url), 'utf8')

    expect(source).not.toContain('delete from ${')
    expect(source).not.toContain('sql`delete')
    expect(source).toContain('switch (ref.entityTable)')
  })
})
