'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTheme } from '@/lib/theme/theme-context'
import {
  THEME_MODE_OPTIONS,
  parseThemeMode,
  themeModeLabel,
  type ThemeMode,
} from '@/lib/theme/mode'
import { cn } from '@/lib/utils'

function ModeIcon({ mode, className }: { readonly mode: ThemeMode; readonly className?: string }) {
  if (mode === 'light') return <Sun className={className} aria-hidden="true" />
  if (mode === 'dark') return <Moon className={className} aria-hidden="true" />
  return <Monitor className={className} aria-hidden="true" />
}

function subscribeNoop() {
  return () => {}
}

function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false)
}

/** Sidebar theme control. Native select avoids base-ui Menu SSR/hydration crashes. */
export function ThemeModeMenu() {
  const { theme, setTheme } = useTheme()
  const mounted = useIsClient()
  const selectedMode = parseThemeMode(theme)

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label="테마 선택"
        className="inline-flex h-9 w-full items-center gap-2 rounded-lg border border-company-border bg-company-surface px-2.5 text-[13px] font-medium text-company-fg-muted opacity-80"
      >
        <Monitor className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">테마</span>
      </button>
    )
  }

  return (
    <label
      className={cn(
        'inline-flex h-9 w-full items-center gap-2 rounded-lg border border-company-border bg-company-surface px-2.5 text-[13px] font-medium text-foreground',
        'hover:bg-company-nav-hover focus-within:ring-3 focus-within:ring-ring/50',
      )}
    >
      <ModeIcon mode={selectedMode} className="size-4 shrink-0" />
      <span className="sr-only">테마 선택</span>
      <select
        aria-label="테마 선택"
        value={selectedMode}
        onChange={(event) => setTheme(event.target.value)}
        className="min-w-0 flex-1 truncate bg-transparent text-[13px] font-medium text-foreground outline-none"
      >
        {THEME_MODE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {themeModeLabel(option.value)}
          </option>
        ))}
      </select>
    </label>
  )
}
