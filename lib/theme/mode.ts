import { z } from 'zod'

/** JC-045: browser-local UI preference only. Never pass into tax/AI/domain APIs. */
export const themeModeSchema = z.enum(['system', 'light', 'dark'])

export type ThemeMode = z.infer<typeof themeModeSchema>

export const THEME_MODE_OPTIONS = [
  { value: 'system', label: '시스템 설정' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
] as const satisfies ReadonlyArray<{ readonly value: ThemeMode; readonly label: string }>

export function parseThemeMode(value: unknown): ThemeMode {
  const parsed = themeModeSchema.safeParse(value)
  return parsed.success ? parsed.data : 'system'
}

export function themeModeLabel(mode: ThemeMode): string {
  return THEME_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? '시스템 설정'
}
