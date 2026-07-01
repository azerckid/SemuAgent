import { z } from 'zod'

export const createClientSchema = z.object({
  name: z.string().min(1).max(100),
  contactName: z.string().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  staffId: z.string().optional(),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(20).optional(),
  analysisNotes: z.string().max(2000).optional(),
})

export const updateClientSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  contactName: z.string().min(1).max(100).nullable().optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  staffId: z.string().nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  analysisNotes: z.string().max(2000).nullable().optional(),
  templateId: z.string().nullable().optional(),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
