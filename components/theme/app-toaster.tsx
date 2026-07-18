'use client'

import { Toaster } from 'sonner'
import { useTheme } from '@/lib/theme/theme-context'

/** Toast chrome follows the resolved app theme; no tax/API side effects. */
export function AppToaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="top-right"
      richColors
      closeButton
    />
  )
}
