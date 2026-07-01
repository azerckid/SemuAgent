import { z } from 'zod'

export const criterionResultSchema = z.object({
  criterion_text: z.string(),
  criterion_type: z.enum(['material', 'reconciliation', 'format_check', 'other']).default('material'),
  status: z.enum(['satisfied', 'missing', 'non_compliant', 'uncertain']),
  related_filenames: z.array(z.string()).optional().default([]),
  reason: z.string(),
  requested_action: z.string().nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
})

export const sessionEvaluationSchema = z.object({
  overall_verdict: z.enum(['sufficient', 'needs_resubmission', 'uncertain']),
  criteria: z.array(criterionResultSchema),
  summary: z.string(),
  applied_criteria_snapshot: z.string().nullable().optional(),
})

export type CriterionResult = z.infer<typeof criterionResultSchema>
export type SessionEvaluation = z.infer<typeof sessionEvaluationSchema>
