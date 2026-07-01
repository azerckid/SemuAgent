import { z } from 'zod'

export const uploadFileReviewPatchSchema = z.object({
  staffReviewStatus: z.enum(['none', 'excluded']),
  staffReviewNote: z.string().trim().max(500).optional(),
})

export type UploadFileReviewPatchInput = z.infer<typeof uploadFileReviewPatchSchema>
