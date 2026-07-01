import { z } from 'zod'
import { invalidCcEmails } from '@/lib/email/cc'

export const optionalCcEmailsSchema = z
  .string()
  .trim()
  .max(1000, '참조 이메일은 1000자 이하로 입력해 주세요')
  .optional()
  .superRefine((value, ctx) => {
    const invalid = invalidCcEmails(value)
    if (invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `유효하지 않은 참조 이메일입니다: ${invalid.join(', ')}`,
      })
    }
  })
