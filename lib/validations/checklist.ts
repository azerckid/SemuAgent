import { z } from 'zod'

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const createItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  required: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
})

export const assignTemplateSchema = z.object({
  clientId: z.string().min(1),
  templateId: z.string().min(1),
})

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type CreateItemInput = z.infer<typeof createItemSchema>
export type AssignTemplateInput = z.infer<typeof assignTemplateSchema>
