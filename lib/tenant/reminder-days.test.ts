import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import {
  DEFAULT_REMINDER_DAYS_BEFORE,
  isSessionInReminderWindow,
  resolveReminderDaysBefore,
} from '@/lib/tenant/reminder-days'
import { parseUpdateTenantSettingsInput } from '@/lib/tenant/update-tenant-settings-schema'

const referenceNow = DateTime.fromISO('2026-06-01T09:00:00+09:00', { zone: 'Asia/Seoul' })

describe('resolveReminderDaysBefore', () => {
  it('returns configured value inside 1~14', () => {
    expect(resolveReminderDaysBefore(5)).toBe(5)
    expect(resolveReminderDaysBefore(1)).toBe(1)
    expect(resolveReminderDaysBefore(14)).toBe(14)
  })

  it('falls back to 7 for missing or invalid values', () => {
    expect(resolveReminderDaysBefore(undefined)).toBe(DEFAULT_REMINDER_DAYS_BEFORE)
    expect(resolveReminderDaysBefore(null)).toBe(DEFAULT_REMINDER_DAYS_BEFORE)
    expect(resolveReminderDaysBefore(0)).toBe(DEFAULT_REMINDER_DAYS_BEFORE)
    expect(resolveReminderDaysBefore(15)).toBe(DEFAULT_REMINDER_DAYS_BEFORE)
    expect(resolveReminderDaysBefore(3.5)).toBe(DEFAULT_REMINDER_DAYS_BEFORE)
  })
})

describe('isSessionInReminderWindow', () => {
  it('includes sessions expiring within tenant days (5-day tenant)', () => {
    const fourDaysLater = referenceNow.plus({ days: 4 }).toISO()!
    const sixDaysLater = referenceNow.plus({ days: 6 }).toISO()!

    expect(isSessionInReminderWindow(fourDaysLater, 5, referenceNow)).toBe(true)
    expect(isSessionInReminderWindow(sixDaysLater, 5, referenceNow)).toBe(false)
  })

  it('uses 7-day window when tenant value is invalid', () => {
    const sevenDaysLater = referenceNow.plus({ days: 7 }).toISO()!
    const eightDaysLater = referenceNow.plus({ days: 8 }).toISO()!

    expect(isSessionInReminderWindow(sevenDaysLater, 99, referenceNow)).toBe(true)
    expect(isSessionInReminderWindow(eightDaysLater, 99, referenceNow)).toBe(false)
  })

  it('excludes already expired sessions', () => {
    const yesterday = referenceNow.minus({ days: 1 }).toISO()!
    expect(isSessionInReminderWindow(yesterday, 7, referenceNow)).toBe(false)
  })

  it('includes session expiring exactly on window boundary', () => {
    const exactlyFiveDays = referenceNow.plus({ days: 5 }).toISO()!
    expect(isSessionInReminderWindow(exactlyFiveDays, 5, referenceNow)).toBe(true)
  })
})

describe('parseUpdateTenantSettingsInput', () => {
  const validBase = {
    name: '테스트 회계법인',
    timezone: 'Asia/Seoul',
    reminderDaysBefore: 7,
  }

  it('accepts boundary values 1 and 14', () => {
    expect(parseUpdateTenantSettingsInput({ ...validBase, reminderDaysBefore: 1 }).success).toBe(true)
    expect(parseUpdateTenantSettingsInput({ ...validBase, reminderDaysBefore: 14 }).success).toBe(true)
  })

  it('rejects out-of-range and non-integer reminderDaysBefore', () => {
    for (const value of [0, 15, -1, 3.5, '7']) {
      const result = parseUpdateTenantSettingsInput({ ...validBase, reminderDaysBefore: value })
      expect(result.success).toBe(false)
    }
  })
})
