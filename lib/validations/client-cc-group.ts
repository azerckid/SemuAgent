import { z } from 'zod'
import { invalidCcEmails } from '@/lib/email/cc'

export const ccGroupPurposeSchema = z.enum(['general', 'payroll', 'all'])

const ccGroupEmailsSchema = z
  .string()
  .trim()
  .min(1, '참조 이메일을 1개 이상 입력해 주세요')
  .max(1000, '참조 이메일은 1000자 이하로 입력해 주세요')
  .superRefine((value, ctx) => {
    const invalid = invalidCcEmails(value)
    if (invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `유효하지 않은 참조 이메일입니다: ${invalid.join(', ')}`,
      })
    }
  })

export const createClientCcGroupSchema = z.object({
  name: z.string().trim().min(1, '그룹명을 입력해 주세요').max(100),
  purpose: ccGroupPurposeSchema.default('general'),
  emails: ccGroupEmailsSchema,
  isDefault: z.boolean().default(false),
})

export const updateClientCcGroupSchema = createClientCcGroupSchema.partial()

export type ClientCcGroupPurpose = z.infer<typeof ccGroupPurposeSchema>
export type CreateClientCcGroupInput = z.infer<typeof createClientCcGroupSchema>
