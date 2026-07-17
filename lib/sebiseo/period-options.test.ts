import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DateTime } from '@/lib/time'
import {
  buildSebiseoPeriodOptions,
  findSebiseoPeriodOption,
  formatSebiseoPeriodLabel,
  resolveSebiseoPeriodKeyFromAccountingPeriod,
} from './period-options'

describe('buildSebiseoPeriodOptions', () => {
  it('defaults to H1 mid-year and includes previous half for mis-attribution prevention', () => {
    const today = DateTime.fromObject(
      { year: 2026, month: 7, day: 17 },
      { zone: 'Asia/Seoul' },
    )
    const payload = buildSebiseoPeriodOptions({ today })

    expect(payload.defaultKey).toBe('2026-H1')
    expect(findSebiseoPeriodOption(payload.options, '2026-H1')?.accountingPeriod).toBe(
      '2026-01~2026-06',
    )
    expect(findSebiseoPeriodOption(payload.options, '2026-H2')?.confirmLabel).toBe('2026년 2기')
    expect(findSebiseoPeriodOption(payload.options, '2026-07')?.accountingPeriod).toBe('2026-07')
    expect(findSebiseoPeriodOption(payload.options, '2026-06')?.confirmLabel).toBe('2026년 6월')
  })

  it('defaults to H2 after July', () => {
    const today = DateTime.fromObject(
      { year: 2026, month: 8, day: 1 },
      { zone: 'Asia/Seoul' },
    )
    const payload = buildSebiseoPeriodOptions({ today })
    expect(payload.defaultKey).toBe('2026-H2')
  })

  it('stays client-safe and does not import server-only company-home/db', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/sebiseo/period-options.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/from ['"]@\/lib\/company-home/)
    expect(source).not.toMatch(/from ['"]@\/lib\/db/)
    expect(source).not.toContain("import 'server-only'")
  })
})

describe('resolveSebiseoPeriodKeyFromAccountingPeriod', () => {
  it('maps month and half-year ranges', () => {
    expect(resolveSebiseoPeriodKeyFromAccountingPeriod('2026-07')).toBe('2026-07')
    expect(resolveSebiseoPeriodKeyFromAccountingPeriod('2026-01~2026-06')).toBe('2026-H1')
    expect(resolveSebiseoPeriodKeyFromAccountingPeriod('2026-07~2026-12')).toBe('2026-H2')
  })

  it('returns null for non-canonical forms', () => {
    expect(resolveSebiseoPeriodKeyFromAccountingPeriod('')).toBeNull()
    expect(resolveSebiseoPeriodKeyFromAccountingPeriod('2026-H1')).toBeNull()
    expect(resolveSebiseoPeriodKeyFromAccountingPeriod('2026-Q1')).toBeNull()
    expect(resolveSebiseoPeriodKeyFromAccountingPeriod('2025-01~2026-06')).toBeNull()
    expect(resolveSebiseoPeriodKeyFromAccountingPeriod('2026-02~2026-06')).toBeNull()
    expect(resolveSebiseoPeriodKeyFromAccountingPeriod('2026-07~2026-11')).toBeNull()
  })
})

describe('formatSebiseoPeriodLabel', () => {
  it('formats current-year month and half keys', () => {
    expect(formatSebiseoPeriodLabel('2026-07')).toBe('2026년 7월')
    expect(formatSebiseoPeriodLabel('2026-H1')).toBe('2026년 상반기')
    expect(formatSebiseoPeriodLabel('2026-H2')).toBe('2026년 하반기')
  })

  it('formats past-year month and half keys without option list', () => {
    expect(formatSebiseoPeriodLabel('2025-03')).toBe('2025년 3월')
    expect(formatSebiseoPeriodLabel('2025-H1')).toBe('2025년 상반기')
    expect(formatSebiseoPeriodLabel('2024-H2')).toBe('2024년 하반기')
  })

  it('returns null for unknown keys', () => {
    expect(formatSebiseoPeriodLabel('')).toBeNull()
    expect(formatSebiseoPeriodLabel('2026-Q1')).toBeNull()
    expect(formatSebiseoPeriodLabel('2026-13')).toBeNull()
    expect(formatSebiseoPeriodLabel('bad')).toBeNull()
  })
})
