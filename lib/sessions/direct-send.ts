import { createHash } from 'crypto'

export type DirectSessionEventIdInput = {
  tenantId: string
  clientId: string
  accountingPeriod: string
  closingDateISO: string
  requestEmailSubject: string
  requestEmailBody: string
  requestEmailGreeting?: string | null
  senderPhone?: string | null
  requestEmailCc?: string | null
  extractedCriteria?: string | null
  additionalCriteria?: string | null
  analysisNotes?: string | null
}

export function deterministicDirectSessionEventId(input: DirectSessionEventIdInput): string {
  const hash = createHash('sha256')
    .update([
      input.tenantId,
      input.clientId,
      input.accountingPeriod,
      input.closingDateISO,
      input.requestEmailSubject.trim(),
      input.requestEmailBody.trim(),
      input.requestEmailGreeting?.trim() ?? '',
      input.senderPhone?.trim() ?? '',
      input.requestEmailCc?.trim() ?? '',
      input.extractedCriteria?.trim() ?? '',
      input.additionalCriteria?.trim() ?? '',
      input.analysisNotes?.trim() ?? '',
    ].join('\u001f'))
    .digest('hex')
    .slice(0, 32)

  return `direct_${hash}`
}
