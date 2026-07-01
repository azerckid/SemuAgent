import { normalizeCcEmails } from '@/lib/email/cc'

export function buildWorkEmailCcSnapshot(parts: Array<string | null | undefined>): string | null {
  const raw = parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')

  return normalizeCcEmails(raw)
}
