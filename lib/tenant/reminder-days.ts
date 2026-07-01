import { DateTime } from 'luxon'
import { fromISO, now } from '@/lib/time'

export const DEFAULT_REMINDER_DAYS_BEFORE = 7
export const REMINDER_DAYS_BEFORE_MIN = 1
export const REMINDER_DAYS_BEFORE_MAX = 14

export function resolveReminderDaysBefore(value: number | null | undefined): number {
  if (value == null || !Number.isInteger(value)) {
    return DEFAULT_REMINDER_DAYS_BEFORE
  }
  if (value < REMINDER_DAYS_BEFORE_MIN || value > REMINDER_DAYS_BEFORE_MAX) {
    return DEFAULT_REMINDER_DAYS_BEFORE
  }
  return value
}

export function isReminderDaysBeforeInRange(value: number): boolean {
  return Number.isInteger(value) && value >= REMINDER_DAYS_BEFORE_MIN && value <= REMINDER_DAYS_BEFORE_MAX
}

export function isSessionInReminderWindow(
  expiresAtIso: string,
  daysBefore: number,
  referenceNow: DateTime = now(),
): boolean {
  const windowDays = resolveReminderDaysBefore(daysBefore)
  const exp = fromISO(expiresAtIso)
  return exp >= referenceNow && exp <= referenceNow.plus({ days: windowDays })
}
