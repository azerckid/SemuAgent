import { z } from 'zod'

// local-part: 소문자/숫자/하이픈/점, 영문자나 숫자로 시작·종료.
const aliasPattern = /^[a-z0-9]([a-z0-9.-]{0,30}[a-z0-9])?$/

export const aliasSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'alias를 입력해 주세요')
  .max(32, 'alias는 32자 이내로 입력해 주세요')
  .regex(aliasPattern, '소문자, 숫자, 하이픈(-), 점(.)만 사용할 수 있습니다')

export const createStaffMailboxSchema = z.object({
  staffId: z.string().min(1),
  alias: aliasSchema,
})

export const staffMailboxActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume') }),
  z.object({ action: z.literal('retire') }),
  z.object({ action: z.literal('transfer'), staffId: z.string().min(1) }),
])
