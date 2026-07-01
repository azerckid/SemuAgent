import type { DateTime } from 'luxon'
import { now, tokenExpiry } from '@/lib/time'

export const STAFF_DIRECT_UPLOAD_EXPIRY_YEARS = 1

export function getStaffDirectUploadExpiryDate(reference: DateTime = now()): string {
  const expiryDate = reference.plus({ years: STAFF_DIRECT_UPLOAD_EXPIRY_YEARS }).toISODate()
  if (!expiryDate) throw new Error('직접 업로드 만료일을 계산할 수 없습니다')
  return expiryDate
}

export function getStaffDirectUploadExpiresAt(reference: DateTime = now()): DateTime {
  return tokenExpiry(getStaffDirectUploadExpiryDate(reference))
}
