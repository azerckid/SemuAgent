'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { SEMUAGENT_THEME_STORAGE_KEY } from '@/lib/theme/init-script'
import { parseThemeMode, type ThemeMode } from '@/lib/theme/mode'

type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  readonly theme: ThemeMode
  readonly setTheme: (theme: string) => void
  readonly resolvedTheme: ResolvedTheme
  readonly themes: readonly string[]
  readonly systemTheme: ResolvedTheme
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const THEME_CHANGE_EVENT = 'semuagent-theme-change'

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyDocumentTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = mode === 'system' ? readSystemTheme() : mode
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
  return resolved
}

function subscribeThemePreference(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange)
  }
}

function getThemePreferenceSnapshot(): ThemeMode {
  return parseThemeMode(window.localStorage.getItem(SEMUAGENT_THEME_STORAGE_KEY))
}

function getThemePreferenceServerSnapshot(): ThemeMode {
  return 'system'
}

function subscribeSystemTheme(onStoreChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onStoreChange)
  return () => media.removeEventListener('change', onStoreChange)
}

function getSystemThemeSnapshot(): ResolvedTheme {
  return readSystemTheme()
}

function getSystemThemeServerSnapshot(): ResolvedTheme {
  return 'light'
}

export function AppThemeProvider({ children }: { readonly children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeThemePreference,
    getThemePreferenceSnapshot,
    getThemePreferenceServerSnapshot,
  )
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    getSystemThemeServerSnapshot,
  )
  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme

  // Sync document class/color-scheme only — no React setState in this effect.
  useEffect(() => {
    applyDocumentTheme(theme)
  }, [theme, systemTheme])

  const setTheme = useCallback((value: string) => {
    const mode = parseThemeMode(value)
    window.localStorage.setItem(SEMUAGENT_THEME_STORAGE_KEY, mode)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme,
    resolvedTheme,
    themes: ['light', 'dark', 'system'],
    systemTheme,
  }), [theme, setTheme, resolvedTheme, systemTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

/** Drop-in for next-themes `useTheme` used by shell chrome only. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      theme: 'system',
      setTheme: () => {},
      resolvedTheme: 'light',
      themes: ['light', 'dark', 'system'],
      systemTheme: 'light',
    }
  }
  return context
}
