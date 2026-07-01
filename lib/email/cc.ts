import { z } from 'zod'

const EMAIL_SEPARATOR = /[,;\n]+/
const emailSchema = z.email()

function splitEmails(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(EMAIL_SEPARATOR)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function invalidCcEmails(value: string | null | undefined): string[] {
  return splitEmails(value).filter((email) => !emailSchema.safeParse(email).success)
}

export function normalizeCcEmails(value: string | null | undefined): string | null {
  const emails = splitEmails(value)
  if (emails.length === 0) return null
  const invalid = invalidCcEmails(value)
  if (invalid.length > 0) {
    throw new Error(`유효하지 않은 참조 이메일: ${invalid.join(', ')}`)
  }
  return Array.from(new Set(emails)).join(', ')
}

export function ccEmailsForSend(value: string | null | undefined): string[] | undefined {
  const normalized = normalizeCcEmails(value)
  return normalized ? normalized.split(', ') : undefined
}
