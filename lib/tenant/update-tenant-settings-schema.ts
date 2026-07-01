import { z } from 'zod'
import { REMINDER_DAYS_BEFORE_MAX, REMINDER_DAYS_BEFORE_MIN } from '@/lib/tenant/reminder-days'

const reminderDaysBeforeSchema = z
  .number()
  .int()
  .min(REMINDER_DAYS_BEFORE_MIN, { message: '1~14 사이의 일수를 입력해 주세요.' })
  .max(REMINDER_DAYS_BEFORE_MAX, { message: '1~14 사이의 일수를 입력해 주세요.' })

export const updateTenantSettingsSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().min(1).max(50),
  reminderDaysBefore: reminderDaysBeforeSchema,
})

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>

export function parseUpdateTenantSettingsInput(value: unknown) {
  return updateTenantSettingsSchema.safeParse(value)
}
