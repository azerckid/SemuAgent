'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

export type AppThemeProviderProps = {
  readonly children: ReactNode
}

/**
 * JC-045 T1: root theme controller.
 * Persists only a non-tax UI preference via next-themes browser storage.
 */
export function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
      storageKey="semuagent-theme"
    >
      {children}
    </NextThemesProvider>
  )
}
