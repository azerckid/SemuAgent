import { z } from 'zod'
import { unlinkedContextSchema, unmatchReasonCodeSchema } from '@/lib/reviews/unlinked-reason'

export const aiAnalysisSchema = z.object({
  detected_file_type: z.string(),
  readability_score: z.number().min(0).max(1),
  checklist_item_id: z.string().nullable(),
  classification_confidence: z.number().min(0).max(1),
  extracted_fields: z.record(z.string(), z.unknown()).default({}),
  period_match: z.enum(['matched', 'partial', 'unmatched', 'unknown']),
  material_status: z.enum(['sufficient', 'insufficient', 'unknown']),
  risk_flags: z.array(z.string()).default([]),
  routing_status: z.enum(['matched_candidate', 'needs_review', 'failed']),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
  uncertainty: z.string().nullable().optional(),
  recommended_action: z.string().nullable().optional(),
  criteria_summary: z.string().nullable().optional(),
  unmatch_reason_code: unmatchReasonCodeSchema.nullable().optional(),
  staff_unlinked_reason: z.string().min(1).max(400).nullable().optional(),
  unlinked_context: unlinkedContextSchema.nullable().optional(),
})

export type AiAnalysisResult = z.infer<typeof aiAnalysisSchema>

export interface ProviderResult {
  success: boolean
  rawOutput: string
  data?: AiAnalysisResult
  error?: string
}

export interface AnalyzeParams {
  fileBuffer: ArrayBuffer | null
  contentType: string
  fileType: 'pdf' | 'excel' | 'image' | 'other'
  originalFilename: string
  extractedText?: string | null
  extractionSummary?: string | null
  accountingPeriod: string
  checklistItems: Array<{ id: string; name: string; required: boolean }>
  clientAnalysisNotes?: string | null
  sessionAnalysisNotes?: string | null
  extractedCriteria?: string | null
  additionalCriteria?: string | null
}
