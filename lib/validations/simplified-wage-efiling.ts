import { z } from 'zod'

const residentIdSchema = z.string().regex(/^\d{13}$/, '13자리 숫자가 필요합니다.')

export const simplifiedWageEfilingGenerateSchema = z
  .object({
    year: z.number().int().min(2020).max(2100),
    half: z.union([z.literal(1), z.literal(2)]),
    taxOfficeCode: z.string().regex(/^\d{3}$/, '세무서코드는 3자리 숫자입니다.'),
    contactDepartment: z.string().max(30).optional(),
    contactName: z.string().min(1, '담당자 성명이 필요합니다.').max(30),
    contactPhone: z.string().min(1, '담당자 연락처가 필요합니다.').max(15),
    hometaxId: z.string().max(20).optional(),
    representativeId: residentIdSchema,
    employeePii: z.record(z.string().min(1), z.object({ residentId: residentIdSchema })),
    encryptionPassword: z.string().min(8).max(15).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.encryptionPassword) {
      ctx.addIssue({
        code: 'custom',
        message: '암호화 파일 생성은 슬라이스 2b(NTS-CRYPTO)에서 지원 예정입니다.',
        path: ['encryptionPassword'],
      })
    }
  })

export type SimplifiedWageEfilingGenerateInput = z.infer<typeof simplifiedWageEfilingGenerateSchema>

export function periodKeyFromGenerateInput(input: Pick<SimplifiedWageEfilingGenerateInput, 'year' | 'half'>): string {
  return `${input.year}-H${input.half}`
}
