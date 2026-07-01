import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import {
  getStaffDirectUploadExpiresAt,
  getStaffDirectUploadExpiryDate,
  STAFF_DIRECT_UPLOAD_EXPIRY_YEARS,
} from './expiry'

describe('staff direct upload expiry', () => {
  it('sets staff direct upload sessions to expire one year after creation', () => {
    const reference = DateTime.fromISO('2026-06-06T10:30:00.000+09:00', { zone: 'Asia/Seoul' })

    expect(STAFF_DIRECT_UPLOAD_EXPIRY_YEARS).toBe(1)
    expect(getStaffDirectUploadExpiryDate(reference)).toBe('2027-06-06')
    expect(getStaffDirectUploadExpiresAt(reference).toISO()).toBe('2027-06-06T23:59:59.000+09:00')
  })
})
