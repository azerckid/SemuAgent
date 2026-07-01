import { z } from 'zod'
import { MAIL_TEMPLATE_WORK_TYPES } from '@/lib/mail-console/default-templates'
import { optionalCcEmailsSchema } from '@/lib/validations/email'

// ---------------------------------------------------------------------------
// JSON 내부 구조 스키마
// due_rule, request_items 컬럼은 text(JSON)으로 저장되므로
// 읽기·쓰기 시 반드시 이 스키마로 safeParse 한다.
// ---------------------------------------------------------------------------

export const dueRuleSchema = z.discriminatedUnion('type', [
  z.object({
    // 매월 N일 기준 (monthly)
    type: z.literal('day_of_month'),
    dayOfMonth: z.number().int().min(1).max(28), // 28일 이하로 고정해 월말 오차 방지
  }),
  z.object({
    // 회계 기간 종료 후 N일 (quarterly / semiannual / annual)
    type: z.literal('days_after_period_end'),
    daysAfterPeriodEnd: z.number().int().min(1).max(90),
  }),
])

export type DueRule = z.infer<typeof dueRuleSchema>

// sendRule: Cron이 자동 발송을 트리거할 날짜 규칙
export const sendRuleSchema = z.discriminatedUnion('type', [
  z.object({
    // 매월 N일 발송 (monthly)
    type: z.literal('day_of_month'),
    dayOfMonth: z.number().int().min(1).max(28),
  }),
  z.object({
    // 기간 종료 N일 전 발송 (quarterly / semiannual / annual)
    type: z.literal('days_before_period_end'),
    daysBefore: z.number().int().min(1).max(90),
  }),
])

export type SendRule = z.infer<typeof sendRuleSchema>

export function parseSendRule(raw: string | null | undefined): SendRule | null {
  if (!raw) return null
  try {
    const result = sendRuleSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export const requestItemSchema = z.object({
  name: z.string().min(1).max(200),
  required: z.boolean().default(true),
  description: z.string().max(500).optional(),
})

export const requestItemsSchema = z.array(requestItemSchema).max(100)

export type RequestItem = z.infer<typeof requestItemSchema>

export const mailTemplateWorkTypeSchema = z.enum(MAIL_TEMPLATE_WORK_TYPES)
export const requestTemplateFrequencySchema = z.enum(['monthly', 'quarterly', 'semiannual', 'annual', 'custom'])

// ---------------------------------------------------------------------------
// request_template 입력 스키마
// ---------------------------------------------------------------------------

// requestItems, dueRule은 DB 컬럼이 nullable이지만(마이그레이션 호환성)
// 앱 레이어에서는 빈 템플릿 저장을 차단한다.
// 항목 없이는 무엇을, 기한 규칙 없이는 언제 요청할지 알 수 없기 때문이다.
export const createRequestTemplateSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  checklistTemplateId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  workType: mailTemplateWorkTypeSchema.nullable().optional(),
  frequency: requestTemplateFrequencySchema,
  // v1: 자료 요구사항 본문(emailBodyTemplate)이 핵심. 구조화 항목은 optional.
  requestItems: requestItemsSchema.optional(),
  emailSubjectTemplate: z.string().min(1).max(500),
  emailBodyTemplate: z.string().min(1),
  analysisCriteriaTemplate: z.string().optional(),
  dueRule: dueRuleSchema.optional(),
  sendRule: sendRuleSchema.optional(),
  sendPolicy: z
    .enum(['approval_required', 'scheduled_draft', 'auto_send_candidate'])
    .default('approval_required'),
  isDefaultForWorkType: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export type CreateRequestTemplateInput = z.infer<typeof createRequestTemplateSchema>

export const updateRequestTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  workType: mailTemplateWorkTypeSchema.nullable().optional(),
  frequency: requestTemplateFrequencySchema.optional(),
  requestItems: requestItemsSchema.optional(),
  emailSubjectTemplate: z.string().min(1).max(500).optional(),
  emailBodyTemplate: z.string().min(1).optional(),
  analysisCriteriaTemplate: z.string().optional(),
  dueRule: dueRuleSchema.optional(),
  sendRule: sendRuleSchema.optional(),
  sendPolicy: z
    .enum(['approval_required', 'scheduled_draft', 'auto_send_candidate'])
    .optional(),
  isDefaultForWorkType: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateRequestTemplateInput = z.infer<typeof updateRequestTemplateSchema>

// ---------------------------------------------------------------------------
// client_request_schedule 입력 스키마
// ---------------------------------------------------------------------------

export const createClientRequestScheduleSchema = z.object({
  clientId: z.string().uuid(),
  requestTemplateId: z.string().uuid().nullable().optional(),
  frequency: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다'),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다')
    .nullable()
    .optional(),
  timezone: z.string().min(1).default('Asia/Seoul'),
  generationPolicy: z.enum(['manual', 'auto_generate_draft']).default('auto_generate_draft'),
  sendPolicy: z
    .enum(['approval_required', 'scheduled_draft', 'auto_send_candidate'])
    .default('approval_required'),
  sendRule: sendRuleSchema,
  dueRule: dueRuleSchema,
  // 인라인 메일 초안 (templateId 없이 간편 설정 시)
  emailSubjectTemplate: z.string().min(1).max(500),
  emailBodyTemplate: z.string().min(1),
  emailGreetingTemplate: z.string().max(1000).optional(),
  senderPhoneTemplate: z.string().max(100).optional(),
  ccEmailTemplate: optionalCcEmailsSchema,
  analysisCriteriaTemplate: z.string().optional(),
  isActive: z.boolean().default(true),
})

export type CreateClientRequestScheduleInput = z.infer<typeof createClientRequestScheduleSchema>

// ---------------------------------------------------------------------------
// client_request_event 입력 스키마
// ---------------------------------------------------------------------------

const PERIOD_PATTERN: Record<string, RegExp> = {
  monthly:    /^\d{4}-\d{2}$/,
  quarterly:  /^\d{4}-Q[1-4]$/,
  semiannual: /^\d{4}-H[1-2]$/,
  annual:     /^\d{4}$/,
}

export const createClientRequestEventSchema = z
  .object({
    clientId: z.string().uuid(),
    requestScheduleId: z.string().uuid().nullable().optional(),
    requestTemplateId: z.string().uuid().nullable().optional(),
    accountingPeriod: z
      .string()
      .regex(
        /^(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|\d{4}-Q[1-4]|\d{4}-H[1-2]|\d{4})$/,
        '2026-05 / 2026-05-15 / 2026-Q2 / 2026-H1 / 2026 형식이어야 합니다',
      ),
    frequency: z.enum(['monthly', 'quarterly', 'semiannual', 'annual', 'custom']),
    title: z.string().min(1).max(500),
    dueAt: z.string().datetime({ offset: true, message: 'ISO 8601 datetime 형식이어야 합니다' }),
    requestItemsSnapshot: requestItemsSchema.optional(),
    emailSubjectSnapshot: z.string().max(500).optional(),
    emailBodySnapshot: z.string().optional(),
    emailGreetingSnapshot: z.string().max(1000).optional(),
    senderPhoneSnapshot: z.string().max(100).optional(),
    ccEmailSnapshot: optionalCcEmailsSchema,
    analysisCriteriaSnapshot: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const pattern = PERIOD_PATTERN[data.frequency]
    if (pattern && !pattern.test(data.accountingPeriod)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accountingPeriod'],
        message: `frequency "${data.frequency}"에 맞지 않는 accountingPeriod 형식입니다 (예: ${
          data.frequency === 'monthly'    ? '2026-05'  :
          data.frequency === 'quarterly'  ? '2026-Q2'  :
          data.frequency === 'semiannual' ? '2026-H1'  : '2026'
        })`,
      })
    }
  })

export type CreateClientRequestEventInput = z.infer<typeof createClientRequestEventSchema>

// ---------------------------------------------------------------------------
// JSON text 컬럼 파싱 헬퍼
// DB에서 읽은 text 값을 Zod 스키마로 검증한다.
// JSON.parse 자체가 throw할 수 있으므로 try/catch로 감싼다.
// ---------------------------------------------------------------------------

export function parseDueRule(raw: string | null | undefined): DueRule | null {
  if (!raw) return null
  try {
    const result = dueRuleSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function parseRequestItems(raw: string | null | undefined): RequestItem[] {
  if (!raw) return []
  try {
    const result = requestItemsSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : []
  } catch {
    return []
  }
}
