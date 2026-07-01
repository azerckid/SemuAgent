import { z } from 'zod'

export const manualBillingModeSchema = z.enum(['manual_invoice', 'manual_pilot'])
export const manualBillingPlanCodeSchema = z.enum(['starter', 'growth', 'pro'])

export const manualBillingUpdateSchema = z.object({
  planCode: manualBillingPlanCodeSchema,
  mode: manualBillingModeSchema,
})

export type ManualBillingUpdateInput = z.input<typeof manualBillingUpdateSchema>
