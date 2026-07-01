import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  getUploadBaseUrl: () => {
    const raw = process.env.PUBLIC_UPLOAD_BASE_URL
      ?? process.env.NEXT_PUBLIC_APP_URL
      ?? 'http://localhost:3000'
    return raw.replace(/\/$/, '')
  },
}))

import { resolveStoredUploadUrl } from './resolve-upload-url'

describe('resolveStoredUploadUrl', () => {
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const prevUploadBase = process.env.PUBLIC_UPLOAD_BASE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://jaaryo.online'
    delete process.env.PUBLIC_UPLOAD_BASE_URL
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = prevAppUrl
    if (prevUploadBase === undefined) {
      delete process.env.PUBLIC_UPLOAD_BASE_URL
    } else {
      process.env.PUBLIC_UPLOAD_BASE_URL = prevUploadBase
    }
  })

  it('replaces legacy host while keeping upload token path', () => {
    expect(
      resolveStoredUploadUrl(
        'https://jaryo-giwa.vercel.app/upload/abc123token',
      ),
    ).toBe('https://jaaryo.online/upload/abc123token')
  })

  it('preserves query string (purposeRequest)', () => {
    expect(
      resolveStoredUploadUrl(
        'https://jaryo-giwa.vercel.app/upload/abc123?purposeRequest=req-1',
      ),
    ).toBe('https://jaaryo.online/upload/abc123?purposeRequest=req-1')
  })

  it('returns null for empty input', () => {
    expect(resolveStoredUploadUrl(null)).toBeNull()
    expect(resolveStoredUploadUrl(undefined)).toBeNull()
  })

  it('prefers PUBLIC_UPLOAD_BASE_URL over NEXT_PUBLIC_APP_URL', () => {
    process.env.PUBLIC_UPLOAD_BASE_URL = 'https://upload.example.com'
    expect(
      resolveStoredUploadUrl('https://legacy.example/upload/token-x'),
    ).toBe('https://upload.example.com/upload/token-x')
  })
})
