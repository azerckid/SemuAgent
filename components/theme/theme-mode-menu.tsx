'use client'

import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="테마 선택"
        aria-haspopup="menu"
        className={cn(
          'inline-flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-company-border bg-company-surface px-2.5 text-[13px] font-medium text-foreground',
          'hover:bg-company-nav-hover focus-visible:ring-3 focus-visible:ring-ring/50',
        )}
      >
        <ModeIcon mode={selectedMode} className="size-4 shrink-0" />
        <span className="truncate">{themeModeLabel(selectedMode)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={6} className="min-w-[12.5rem]">
        {THEME_MODE_OPTIONS.map((option) => {
          const selected = selectedMode === option.value
          return (
            <DropdownMenuItem
              key={option.value}
              role="menuitemradio"
              aria-checked={selected}
              aria-label={option.label}
              onClick={() => setTheme(option.value)}
              className="justify-between"
            >
              <span className="inline-flex items-center gap-2">
                <ModeIcon mode={option.value} className="size-4" />
                {option.label}
              </span>
              {selected ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
              {selected ? <span className="sr-only">선택됨</span> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
