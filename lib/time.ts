import { DateTime } from 'luxon'

const DEFAULT_TZ = 'Asia/Seoul'

export function now(tz: string = DEFAULT_TZ): DateTime {
  return DateTime.now().setZone(tz)
}

export function fromISO(iso: string, tz: string = DEFAULT_TZ): DateTime {
  return DateTime.fromISO(iso, { zone: tz })
}

/**
 * Token expiry = submitted material deadline at 23:59:59 (Asia/Seoul)
 * e.g. closingDate '2026-05-10' → 2026-05-10T23:59:59+09:00
 */
export function tokenExpiry(closingDateISO: string, tz: string = DEFAULT_TZ): DateTime {
  return DateTime.fromISO(closingDateISO, { zone: tz })
    .set({ hour: 23, minute: 59, second: 59, millisecond: 0 })
}

export function toDBString(dt: DateTime): string {
  return dt.toISO() ?? ''
}

export { DateTime }
