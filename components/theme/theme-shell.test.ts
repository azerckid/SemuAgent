import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

const layoutSource = readFileSync(join(root, 'app/layout.tsx'), 'utf8')
const providerSource = readFileSync(join(root, 'components/theme/theme-provider.tsx'), 'utf8')
const menuSource = readFileSync(join(root, 'components/theme/theme-mode-menu.tsx'), 'utf8')
const modeSource = readFileSync(join(root, 'lib/theme/mode.ts'), 'utf8')
const globalsSource = readFileSync(join(root, 'app/globals.css'), 'utf8')
const sidebarSource = readFileSync(join(root, 'app/(dashboard)/_components/sidebar.tsx'), 'utf8')
const sebiseoWorkspaceSource = readFileSync(
  join(root, 'app/(dashboard)/dashboard/sebiseo/_components/sebiseo-workspace.tsx'),
  'utf8',
)

describe('JC-045 T1 theme shell contracts', () => {
  it('wires next-themes with hydration-safe root and system default', () => {
    expect(layoutSource).toContain('suppressHydrationWarning')
    expect(layoutSource).toContain('AppThemeProvider')
    expect(providerSource).toContain('attribute="class"')
    expect(providerSource).toContain('defaultTheme="system"')
    expect(providerSource).toContain('enableSystem')
    expect(providerSource).toContain('disableTransitionOnChange')
    expect(providerSource).toContain('storageKey="semuagent-theme"')
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
    expect(menuSource).toContain('role="menuitemradio"')
    expect(menuSource).toContain('aria-checked={selected}')
    expect(menuSource).toContain('선택됨')
    expect(menuSource).toContain('useSyncExternalStore')
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
