import { z } from 'zod'

export const createAttributionSavedPromptSchema = z.object({
  name: z.string().trim().min(1, '프롬프트 이름을 입력해 주세요').max(80),
  description: z.string().trim().max(200).optional().nullable(),
  promptText: z.string().trim().min(1, '프롬프트 문구를 입력해 주세요').max(2000),
})

export const updateAttributionSavedPromptSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(200).optional().nullable(),
  promptText: z.string().trim().min(1).max(2000).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
})

export const interpretAttributionPromptSchema = z.object({
  promptText: z.string().trim().min(1).max(2000),
  requestedPeriod: z.string().trim().min(1).max(20).optional(),
  closePeriod: z.string().trim().min(1).max(20).optional(),
})
