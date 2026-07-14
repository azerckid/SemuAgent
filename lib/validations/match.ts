import { z } from 'zod'

export const updateMatchSchema = z.object({
  status: z.enum(['manual_approved', 'manual_rejected']),
})

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
})

export type UpdateMatchInput = z.infer<typeof updateMatchSchema>
export type CreateTenantInput = z.infer<typeof createTenantSchema>
