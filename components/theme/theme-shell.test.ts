import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

const layoutSource = readFileSync(join(root, 'app/layout.tsx'), 'utf8')
const providerSource = readFileSync(join(root, 'components/theme/theme-provider.tsx'), 'utf8')
const menuSource = readFileSync(join(root, 'components/theme/theme-mode-menu.tsx'), 'utf8')
const toasterSource = readFileSync(join(root, 'components/theme/app-toaster.tsx'), 'utf8')
const modeSource = readFileSync(join(root, 'lib/theme/mode.ts'), 'utf8')
const contextSource = readFileSync(join(root, 'lib/theme/theme-context.tsx'), 'utf8')
const globalsSource = readFileSync(join(root, 'app/globals.css'), 'utf8')
const sidebarSource = readFileSync(join(root, 'app/(dashboard)/_components/sidebar.tsx'), 'utf8')
const sebiseoWorkspaceSource = readFileSync(
  join(root, 'app/(dashboard)/dashboard/sebiseo/_components/sebiseo-workspace.tsx'),
  'utf8',
)

describe('JC-045 T1 theme shell contracts', () => {
  it('wires hydration-safe root theme without next-themes client script', () => {
    expect(layoutSource).toContain('suppressHydrationWarning')
    expect(layoutSource).toContain('AppThemeProvider')
    expect(layoutSource).toContain('AppThemeProvider')
    expect(layoutSource).not.toContain('<script')
    expect(layoutSource).not.toContain('beforeInteractive')
    expect(providerSource).toContain('ThemeContextProvider')
    expect(providerSource).not.toMatch(/from ['"]next-themes['"]/)
    expect(contextSource).toContain('SEMUAGENT_THEME_STORAGE_KEY')
    // Prefer external-store subscription over effect-time setState (react-hooks/set-state-in-effect).
    expect(contextSource).toContain('useSyncExternalStore')
    expect(contextSource).not.toContain('useState')
    expect(contextSource).not.toContain('setThemeState')
    expect(contextSource).not.toContain('setResolvedTheme')
    expect(contextSource).not.toContain('setSystemTheme')
    expect(menuSource).toContain("from '@/lib/theme/theme-context'")
    expect(toasterSource).toContain("from '@/lib/theme/theme-context'")
    expect(menuSource).not.toMatch(/from ['"]next-themes['"]/)
    expect(toasterSource).not.toMatch(/from ['"]next-themes['"]/)
    expect(providerSource).not.toContain('tenant')
  })

  it('completes company shell dark tokens and native color-scheme', () => {
    expect(globalsSource).toContain('color-scheme: light')
    expect(globalsSource).toContain('color-scheme: dark')
    expect(globalsSource).toMatch(/\.dark\s*\{[\s\S]*--company-bg:\s*#171717/)
    expect(globalsSource).toMatch(/\.dark\s*\{[\s\S]*--company-surface:\s*#212121/)
  })

  it('exposes an accessible sidebar theme selector with Korean mode labels', () => {
    expect(sidebarSource).toContain('ThemeModeMenu')
    expect(menuSource).toContain('aria-label="테마 선택"')
    expect(menuSource).toContain('THEME_MODE_OPTIONS')
    expect(menuSource).toContain('<select')
    expect(menuSource).toContain('useSyncExternalStore')
    expect(menuSource).not.toContain('DropdownMenu')
    expect(modeSource).toContain("'시스템 설정'")
    expect(modeSource).toContain("'라이트'")
    expect(modeSource).toContain("'다크'")
  })

  it('migrates Sebiseo canvas to shared company tokens (T2)', () => {
    expect(sebiseoWorkspaceSource).toContain('bg-company-bg')
    expect(sebiseoWorkspaceSource).toContain('text-foreground')
    expect(sebiseoWorkspaceSource).not.toContain('bg-[#171717]')
    expect(sebiseoWorkspaceSource).not.toContain('ThemeModeMenu')
    expect(sebiseoWorkspaceSource).not.toContain('useTheme')
  })
})
