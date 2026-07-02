import { z } from 'zod'

export const internalReminderDomainSchema = z.enum([
  'source_collection',
  'bookkeeping_review',
  'vat',
  'payroll',
  'filing_support',
])

export const internalReminderRulePatchSchema = z.object({
  enabled: z.boolean(),
})

export const internalReminderSendNowSchema = z.object({
  ruleId: z.string().min(1).optional(),
})

export type InternalReminderRulePatchInput = z.infer<typeof internalReminderRulePatchSchema>
export type InternalReminderSendNowInput = z.infer<typeof internalReminderSendNowSchema>
