import { z } from 'zod'

export const sendWorkEmailSchema = z.object({
  staffMailboxId: z.string().min(1),
  to: z.string().trim().email('받는 사람 이메일 형식이 올바르지 않습니다'),
  cc: z.string().trim().max(1000).optional(),
  ccGroupId: z.string().min(1).nullable().optional(),
  ccInternalGroupId: z.string().min(1).nullable().optional(),
  subject: z.string().trim().min(1, '제목을 입력해 주세요').max(300),
  body: z.string().trim().min(1, '본문을 입력해 주세요').max(20_000),
  clientLabelId: z.string().min(1).nullable().optional(),
})
