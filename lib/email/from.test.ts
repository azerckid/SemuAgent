import { describe, expect, it, vi } from 'vitest'
import { extractEmailAddress, formatEmailFrom, sanitizeDisplayName } from '@/lib/email/from'

vi.mock('@/lib/db', () => ({
  db: {},
}))

describe('sanitizeDisplayName', () => {
  it('removes header injection and address wrapper characters', () => {
    expect(sanitizeDisplayName('가온\r\nBcc: bad@example.com <tag> "quote"')).toBe(
      '가온Bcc: bad@example.com tag quote',
    )
  })

  it('returns an empty string for blank input', () => {
    expect(sanitizeDisplayName(null)).toBe('')
    expect(sanitizeDisplayName('   ')).toBe('')
  })
})

describe('extractEmailAddress', () => {
  it('extracts the address from a display-name formatted sender', () => {
    expect(extractEmailAddress('JARYO <noreply@web3people.online>')).toBe('noreply@web3people.online')
  })

  it('keeps a bare email address unchanged', () => {
    expect(extractEmailAddress('noreply@web3people.online')).toBe('noreply@web3people.online')
  })
})

describe('formatEmailFrom', () => {
  it('uses the tenant display name while preserving the configured address', () => {
    expect(formatEmailFrom('JARYO <noreply@web3people.online>', '세무법인 가온')).toBe(
      '세무법인 가온 <noreply@web3people.online>',
    )
  })

  it('falls back to the base sender when the display name is empty after sanitization', () => {
    expect(formatEmailFrom('JARYO <noreply@web3people.online>', '\r\n<> "')).toBe(
      'JARYO <noreply@web3people.online>',
    )
  })
})
