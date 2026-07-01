import { formatGeneralDefaultCriteriaForEmail } from '@/lib/review/default-criteria-data'
import type { MailTemplateWorkType } from './default-templates'

export function appendDefaultCriteriaSection(
  body: string,
  workType: MailTemplateWorkType,
): string {
  if (workType === 'payroll' || body.includes('요청 자료 기준')) return body

  const criteriaWorkType = workType === 'vat' ? 'vat' : 'bookkeeping'
  return `${body.trim()}\n\n${formatGeneralDefaultCriteriaForEmail(criteriaWorkType)}`
}
