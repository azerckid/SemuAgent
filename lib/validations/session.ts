import { z } from 'zod'
import { optionalCcEmailsSchema } from '@/lib/validations/email'

export const createSessionSchema = z.object({
  clientId: z.string().min(1),
  accountingPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM 형식이어야 합니다'),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다'),
  requestEmailSubject: z.string().trim().min(1, '요청 메일 제목을 입력해 주세요').max(200),
  requestEmailGreeting: z.string().trim().max(1000).optional(),
  requestEmailBody: z.string().trim().min(1, '요청 메일 본문을 입력해 주세요').max(10000),
  senderPhone: z.string().trim().max(100).optional(),
  requestEmailCc: optionalCcEmailsSchema,
  extractedCriteria: z.string().trim().max(10000).optional(),
  additionalCriteria: z.string().trim().max(10000).optional(),
  analysisNotes: z.string().optional(),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>
