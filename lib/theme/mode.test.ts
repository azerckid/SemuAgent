import { describe, expect, it } from 'vitest'
import { parseThemeMode, themeModeLabel, themeModeSchema, THEME_MODE_OPTIONS } from './mode'

describe('theme mode (JC-045)', () => {
  it('accepts system, light, and dark only', () => {
    expect(themeModeSchema.parse('system')).toBe('system')
    expect(themeModeSchema.parse('light')).toBe('light')
    expect(themeModeSchema.parse('dark')).toBe('dark')
    expect(themeModeSchema.safeParse('sepia').success).toBe(false)
  })

  it('falls back to system for invalid stored preference', () => {
    expect(parseThemeMode('not-a-theme')).toBe('system')
    expect(parseThemeMode(undefined)).toBe('system')
    expect(parseThemeMode(null)).toBe('system')
  })

  it('exposes Korean labels for the sidebar selector', () => {
    expect(THEME_MODE_OPTIONS.map((option) => option.label)).toEqual([
      '시스템 설정',
      '라이트',
      '다크',
    ])
    expect(themeModeLabel('system')).toBe('시스템 설정')
  })
})
