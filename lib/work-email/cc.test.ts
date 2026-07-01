import { describe, expect, it } from 'vitest'
import { buildWorkEmailCcSnapshot } from './cc'

describe('buildWorkEmailCcSnapshot', () => {
  it('combines customer group, internal group, and direct CC emails', () => {
    expect(
      buildWorkEmailCcSnapshot([
        'tax@example.com',
        'internal@example.com, partner@example.com',
        'oneoff@example.com',
      ]),
    ).toBe('tax@example.com, internal@example.com, partner@example.com, oneoff@example.com')
  })

  it('normalizes and deduplicates emails across parts', () => {
    expect(
      buildWorkEmailCcSnapshot([
        'Tax@Example.com',
        'tax@example.com, HR@example.com',
        'hr@example.com',
      ]),
    ).toBe('tax@example.com, hr@example.com')
  })

  it('returns null when no CC email is present', () => {
    expect(buildWorkEmailCcSnapshot([null, undefined, '   '])).toBeNull()
  })

  it('rejects invalid direct CC input', () => {
    expect(() => buildWorkEmailCcSnapshot(['valid@example.com', 'broken'])).toThrow(
      '유효하지 않은 참조 이메일',
    )
  })
})
