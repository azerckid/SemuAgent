import { z } from 'zod'

// ---------------------------------------------------------------------------
// request_item_validation 관련 Zod 스키마
// ---------------------------------------------------------------------------

export const validationStatusSchema = z.enum([
  'satisfied',
  'partially_satisfied',
  'missing',
  'non_compliant',
  'uncertain',
])

export const reviewStatusSchema = z.enum([
  'ai_suggested',
  'confirmed',
  'overridden',
  'excluded',
])

export const requirednessSchema = z.enum(['required', 'conditional', 'optional'])
export const criterionTypeSchema = z.enum(['material', 'reconciliation', 'format_check', 'other'])

// AI가 생성한 요청 항목 검증 결과 (DB 저장 입력용)
export const requestItemValidationInputSchema = z.object({
  uploadSessionId: z.string().uuid(),
  requestEventId: z.string().uuid().nullable().optional(),
  itemName: z.string().min(1).max(500),
  itemGroup: z.string().max(100).optional(),
  criterionType: criterionTypeSchema.optional(),
  requiredness: requirednessSchema.default('required'),
  conditionText: z.string().max(1000).optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  validationStatus: validationStatusSchema,
  aiReasoning: z.string().max(2000).optional(),
  // 연결 파일 목록 (id + 기여도)
  files: z.array(z.object({
    uploadFileId: z.string().uuid(),
    contribution: z.enum(['satisfied', 'partial', 'non_compliant', 'unrelated', 'uncertain']).optional(),
  })).default([]),
})

export type RequestItemValidationInput = z.infer<typeof requestItemValidationInputSchema>

// 담당자 검토 PATCH 입력 — ai_suggested는 시스템 초기값이므로 담당자가 PATCH로 보낼 수 없음
export const reviewRequestItemSchema = z.object({
  reviewStatus: z.enum(['confirmed', 'overridden', 'excluded']),
  staffNote: z.string().max(2000).optional(),
})

export type ReviewRequestItemInput = z.infer<typeof reviewRequestItemSchema>
