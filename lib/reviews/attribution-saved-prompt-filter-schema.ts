import { z } from 'zod'
import {
  materialAttributionDecisionSchema,
  materialAttributionPeriodRelationSchema,
} from '@/lib/bookkeeping/schemas'

const duplicateStatusSchema = z.enum(['none', 'possible_duplicate'])

const staffDecisionFilterSchema = z.enum([
  ...materialAttributionDecisionSchema.options,
  'undecided',
] as const)

const sortFieldSchema = z.enum(['amountKrw', 'evidenceDate', 'attributedPeriod'])
const sortDirectionSchema = z.enum(['asc', 'desc'])

const containsArraySchema = z
  .array(z.string().trim().min(1).max(50))
  .max(10)
  .optional()

export const reviewAttributionFilterSpecV1Schema = z
  .object({
    version: z.literal(1),
    amountKrw: z
      .object({
        min: z.number().int().min(0).optional(),
        max: z.number().int().min(0).optional(),
      })
      .optional(),
    periodRelationIn: z.array(materialAttributionPeriodRelationSchema).min(1).optional(),
    attributedPeriodIn: z.array(z.string().trim().min(1).max(20)).min(1).optional(),
    counterpartyContains: containsArraySchema,
    descriptionContains: containsArraySchema,
    textContains: containsArraySchema,
    duplicateStatusIn: z.array(duplicateStatusSchema).min(1).optional(),
    aiRecommendationIn: z.array(materialAttributionDecisionSchema).min(1).optional(),
    staffDecisionIn: z.array(staffDecisionFilterSchema).min(1).optional(),
    sort: z
      .object({
        field: sortFieldSchema,
        direction: sortDirectionSchema,
      })
      .optional(),
    limit: z.number().int().min(1).max(500).optional(),
    explanationKo: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.amountKrw?.min !== undefined && value.amountKrw?.max !== undefined && value.amountKrw.min > value.amountKrw.max) {
      ctx.addIssue({ code: 'custom', message: 'amountKrw.min은 max보다 클 수 없습니다', path: ['amountKrw'] })
    }

    const hasFilter =
      value.amountKrw?.min !== undefined ||
      value.amountKrw?.max !== undefined ||
      (value.periodRelationIn?.length ?? 0) > 0 ||
      (value.attributedPeriodIn?.length ?? 0) > 0 ||
      (value.counterpartyContains?.length ?? 0) > 0 ||
      (value.descriptionContains?.length ?? 0) > 0 ||
      (value.textContains?.length ?? 0) > 0 ||
      (value.duplicateStatusIn?.length ?? 0) > 0 ||
      (value.aiRecommendationIn?.length ?? 0) > 0 ||
      (value.staffDecisionIn?.length ?? 0) > 0

    if (!hasFilter) {
      ctx.addIssue({ code: 'custom', message: '최소 1개 이상의 필터 조건이 필요합니다', path: ['version'] })
    }
  })

export type ReviewAttributionFilterSpecV1 = z.infer<typeof reviewAttributionFilterSpecV1Schema>

export function parseReviewAttributionFilterSpecV1(value: unknown) {
  return reviewAttributionFilterSpecV1Schema.safeParse(value)
}

export function parseReviewAttributionFilterSpecJson(json: string) {
  try {
    return parseReviewAttributionFilterSpecV1(JSON.parse(json))
  } catch {
    return { success: false as const, error: new z.ZodError([]) }
  }
}
