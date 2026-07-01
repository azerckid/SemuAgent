import { createHash } from 'crypto'
import { z } from 'zod'
import { MAIL_TEMPLATE_WORK_TYPES } from './default-templates'
export { appendDefaultCriteriaSection } from './default-criteria-section'

const accountingPeriodSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0?[1-9]|1[0-2])$/, 'YYYY-MM 형식이어야 합니다')
  .transform((value) => {
    const [year, month] = value.split('-')
    return `${year}-${month.padStart(2, '0')}`
  })

const ccGroupIdSchema = z.string().trim().min(1).max(200).nullable()

export const mailConsoleBulkSendRequestSchema = z.object({
  requestBatchId: z.string().uuid(),
  clientIds: z.array(z.string().uuid()).min(1).max(200),
  workType: z.enum(MAIL_TEMPLATE_WORK_TYPES),
  frequency: z.enum(['monthly', 'quarterly', 'semiannual', 'annual', 'custom']),
  accountingPeriod: accountingPeriodSchema,
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다'),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  requestTemplateId: z.string().uuid().nullable().optional(),
  analysisCriteriaSnapshot: z.string().nullable().optional(),
  clientCcSelections: z
    .array(
      z.object({
        clientId: z.string().uuid(),
        ccGroupId: ccGroupIdSchema,
      }),
    )
    .optional(),
  confirmed: z.literal(true),
})

export type MailConsoleBulkSendRequest = z.infer<typeof mailConsoleBulkSendRequestSchema>

export type MailConsoleBulkSendClient = {
  id: string
  name: string
  managerName: string
}

const TOKEN_PATTERN = /\[\[[^\]]+\]\]/g

export function getMailConsoleTokenReplacements(
  input: Pick<MailConsoleBulkSendRequest, 'accountingPeriod' | 'dueDate'>,
  client: MailConsoleBulkSendClient,
  uploadLink: string = '[[업로드링크]]',
): Record<string, string> {
  return {
    '[[고객명]]': client.name,
    '[[담당자명]]': client.managerName,
    '[[회계기간]]': input.accountingPeriod,
    '[[제출기한]]': input.dueDate,
    '[[업로드링크]]': uploadLink,
  }
}

export function applyMailConsoleTokens(
  value: string,
  input: Pick<MailConsoleBulkSendRequest, 'accountingPeriod' | 'dueDate'>,
  client: MailConsoleBulkSendClient,
  uploadLink?: string,
): string {
  const replacements = getMailConsoleTokenReplacements(input, client, uploadLink)
  return Object.entries(replacements).reduce(
    (result, [token, replacement]) => result.split(token).join(replacement),
    value,
  )
}

export function unresolvedMailConsoleTokens(
  input: Pick<MailConsoleBulkSendRequest, 'accountingPeriod' | 'dueDate' | 'subject' | 'body'>,
  client: MailConsoleBulkSendClient,
): string[] {
  const replacements = getMailConsoleTokenReplacements(input, client, 'reserved')
  const tokens = Array.from(new Set(`${input.subject}\n${input.body}`.match(TOKEN_PATTERN) ?? []))
  return tokens.filter((token) => !replacements[token])
}

export function requestKindForWorkType(
  workType: MailConsoleBulkSendRequest['workType'],
): 'general' | 'payroll' {
  return workType === 'payroll' ? 'payroll' : 'general'
}

export function titleForBulkSend(
  input: Pick<MailConsoleBulkSendRequest, 'workType' | 'accountingPeriod'>,
): string {
  const label = input.workType === 'payroll'
    ? '급여정산'
    : input.workType === 'vat'
      ? '부가세'
      : '기장'
  return `${input.accountingPeriod} ${label} 자료 요청`
}

export function labelForMailConsoleWorkType(workType: MailConsoleBulkSendRequest['workType']): string {
  if (workType === 'payroll') return '급여정산 자료 요청'
  if (workType === 'vat') return '부가세 자료 요청'
  return '기장 자료 요청'
}

export function formatMailConsoleAccountingMonth(accountingPeriod: string): string {
  const match = accountingPeriod.match(/^(20\d{2})-(\d{2})$/)
  if (!match) return accountingPeriod
  return `${match[1]}년 ${Number(match[2])}월`
}

export function duplicateBasicRequestMessage(
  input: Pick<MailConsoleBulkSendRequest, 'workType' | 'accountingPeriod'>,
): string {
  return `이미 ${formatMailConsoleAccountingMonth(input.accountingPeriod)} ${labelForMailConsoleWorkType(input.workType)}이 발송되었습니다. 기존 요청을 확인하거나, 비정기 요청으로 새로 생성하세요.`
}

export function deterministicBulkEventId({
  tenantId,
  requestBatchId,
  clientId,
}: {
  tenantId: string
  requestBatchId: string
  clientId: string
}): string {
  const hash = createHash('sha256')
    .update(`${tenantId}:${requestBatchId}:${clientId}`)
    .digest('hex')
    .slice(0, 32)
  return `bulk_${hash}`
}
