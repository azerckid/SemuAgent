import { z } from 'zod'

export const updateMatchSchema = z.object({
  status: z.enum(['manual_approved', 'manual_rejected']),
})

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  subdomain: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, '소문자, 숫자, 하이픈만 사용 가능합니다'),
})

export type UpdateMatchInput = z.infer<typeof updateMatchSchema>
export type CreateTenantInput = z.infer<typeof createTenantSchema>
