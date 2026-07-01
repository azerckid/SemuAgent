import { z } from 'zod'
import { invalidCcEmails } from '@/lib/email/cc'

export const internalCcGroupPurposeSchema = z.enum(['general', 'payroll', 'all'])

const internalCcGroupEmailsSchema = z
  .string()
  .trim()
  .min(1, '참조 이메일을 1개 이상 입력해 주세요')
  .max(1000, '참조 이메일은 1000자 이내로 입력해 주세요')
  .superRefine((value, ctx) => {
    const invalid = invalidCcEmails(value)
    if (invalid.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `잘못된 이메일 형식: ${invalid.join(', ')}`,
      })
    }
  })

export const createInternalCcGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  purpose: internalCcGroupPurposeSchema.default('general'),
  emails: internalCcGroupEmailsSchema,
  isDefault: z.boolean().default(false),
})

export const updateInternalCcGroupSchema = createInternalCcGroupSchema.partial()
