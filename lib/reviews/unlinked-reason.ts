import { z } from 'zod'

export const unmatchReasonCodeSchema = z.enum([
  'filename_content_mismatch',
  'period_out_of_scope',
  'not_checklist_material',
  'summary_not_transaction_detail',
  'journal_entry_candidate',
  'other',
])

export type UnmatchReasonCode = z.infer<typeof unmatchReasonCodeSchema>

export const unlinkedContextSchema = z.object({
  filename_label: z.string().min(1).max(120).optional(),
  detected_shape: z.string().min(1).max(200).optional(),
  requested_period: z.string().min(1).max(80).optional(),
  next_step: z.string().min(1).max(200).optional(),
})

export type UnlinkedContext = z.infer<typeof unlinkedContextSchema>

export const unlinkedReasonFieldsSchema = z.object({
  staff_unlinked_reason: z.string().min(1).max(400).nullable().optional(),
})

export type UnlinkedReasonFields = z.infer<typeof unlinkedReasonFieldsSchema>

export function parseUnlinkedReasonFields(parsed: unknown): UnlinkedReasonFields | null {
  const result = unlinkedReasonFieldsSchema.safeParse(parsed)
  return result.success ? result.data : null
}

export function resolveUnlinkedReason(params: {
  parsed: unknown
}): string | null {
  const fields = parseUnlinkedReasonFields(params.parsed)
  const reason = fields?.staff_unlinked_reason?.trim()
  return reason ? reason : null
}

export function requiresStaffUnlinkedReason(params: {
  checklist_item_id?: string | null
  routing_status?: string | null
}): boolean {
  if (params.checklist_item_id) return false
  if (params.routing_status === 'failed') return false
  return true
}
