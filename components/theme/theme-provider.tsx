'use client'

import type { ReactNode } from 'react'
import { AppThemeProvider as ThemeContextProvider } from '@/lib/theme/theme-context'

export type AppThemeProviderProps = {
  readonly children: ReactNode
}

/**
 * JC-045 T1: root theme controller.
 * Persists only a non-tax UI preference in browser storage.
 *
 * Avoids Client Component inline script injection
 * (React 19 / Next 16 rejects that pattern). FOUC prevention lives in
 * `app/layout.tsx` via `SEMUAGENT_THEME_INIT_SCRIPT`.
 */
export function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <ThemeContextProvider>
      {children}
    </ThemeContextProvider>
  )
}
