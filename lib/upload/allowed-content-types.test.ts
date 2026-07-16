import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isUploadAllowedContentType,
  isUploadAllowedFile,
  UPLOAD_ALLOWED_CONTENT_TYPES,
  UPLOAD_MAX_FILE_BYTES,
} from './allowed-content-types'

describe('upload allowed content types', () => {
  it('keeps the supported MIME set and size limit explicit', () => {
    expect(UPLOAD_ALLOWED_CONTENT_TYPES).toContain('application/pdf')
    expect(UPLOAD_ALLOWED_CONTENT_TYPES).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(UPLOAD_MAX_FILE_BYTES).toBe(50 * 1024 * 1024)
    expect(isUploadAllowedContentType('text/csv')).toBe(false)
    expect(isUploadAllowedContentType('application/zip')).toBe(false)
  })

  it('uses the extension fallback only when the browser omits MIME', () => {
    expect(isUploadAllowedFile({ name: 'report.xlsx', type: '' })).toBe(true)
    expect(isUploadAllowedFile({ name: 'report.xlsx', type: 'application/zip' })).toBe(false)
    expect(isUploadAllowedFile({ name: 'report.pdf', type: 'text/csv' })).toBe(false)
  })

  it('is the single source used by the upload API route', () => {
    const routeSource = readFileSync(join(process.cwd(), 'app/api/upload/route.ts'), 'utf8')

    expect(routeSource).toContain('UPLOAD_ALLOWED_CONTENT_TYPES')
    expect(routeSource).toContain('UPLOAD_MAX_FILE_BYTES')
    expect(routeSource).not.toMatch(/const ALLOWED_CONTENT_TYPES\s*=/)
    expect(routeSource).not.toMatch(/const MAX_FILE_SIZE\s*=/)
  })
})
