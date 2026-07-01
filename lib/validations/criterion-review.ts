import { z } from 'zod'

export const criterionReviewPatchSchema = z.object({
  reviewStatus: z.enum(['confirmed', 'overridden', 'excluded']),
  staffNote: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (
    (value.reviewStatus === 'overridden' || value.reviewStatus === 'excluded') &&
    (!value.staffNote || value.staffNote.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '담당자 승인/제외에는 사유 메모가 필요합니다.',
      path: ['staffNote'],
    })
  }
})

export type CriterionReviewPatchInput = z.infer<typeof criterionReviewPatchSchema>
