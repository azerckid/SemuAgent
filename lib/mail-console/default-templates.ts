export const MAIL_TEMPLATE_WORK_TYPES = ['bookkeeping', 'payroll', 'vat'] as const

export type MailTemplateWorkType = (typeof MAIL_TEMPLATE_WORK_TYPES)[number]

export type SystemMailTemplate = {
  id: `system:${MailTemplateWorkType}`
  workType: MailTemplateWorkType
  frequency: 'monthly'
  name: string
  subject: string
  body: string
}

export const MAIL_TEMPLATE_WORK_TYPE_LABEL: Record<MailTemplateWorkType, string> = {
  bookkeeping: '기장 자료 요청',
  payroll: '급여정산 자료 요청',
  vat: '부가세 자료 요청',
}

export const SYSTEM_MAIL_TEMPLATES: SystemMailTemplate[] = [
  {
    id: 'system:bookkeeping',
    workType: 'bookkeeping',
    frequency: 'monthly',
    name: '기장 자료 요청 기본 템플릿',
    subject: '[[고객명]] [[회계기간]] 기장 자료 요청드립니다',
    body: `안녕하세요, [[고객명]] [[담당자명]]님.\n\n[[회계기간]] 기장 업무를 위해 자료 제출을 요청드립니다.\n아래 업로드 링크로 [[제출기한]]까지 자료를 제출해 주세요.\n\n업로드 링크: [[업로드링크]]\n\n감사합니다.`,
  },
  {
    id: 'system:payroll',
    workType: 'payroll',
    frequency: 'monthly',
    name: '급여정산 자료 요청 기본 템플릿',
    subject: '[[고객명]] [[회계기간]] 급여정산 자료 요청드립니다',
    body: `안녕하세요, [[고객명]] [[담당자명]]님.\n\n[[회계기간]] 급여정산을 위해 자료 제출을 요청드립니다.\n아래 업로드 링크로 [[제출기한]]까지 자료를 제출해 주세요.\n\n업로드 링크: [[업로드링크]]\n\n감사합니다.`,
  },
  {
    id: 'system:vat',
    workType: 'vat',
    frequency: 'monthly',
    name: '부가세 자료 요청 기본 템플릿',
    subject: '[[고객명]] [[회계기간]] 부가세 자료 요청드립니다',
    body: `안녕하세요, [[고객명]] [[담당자명]]님.\n\n[[회계기간]] 부가세 신고 준비를 위해 자료 제출을 요청드립니다.\n아래 업로드 링크로 [[제출기한]]까지 자료를 제출해 주세요.\n\n업로드 링크: [[업로드링크]]\n\n감사합니다.`,
  },
]

export function getSystemMailTemplate(workType: MailTemplateWorkType): SystemMailTemplate {
  return SYSTEM_MAIL_TEMPLATES.find((template) => template.workType === workType)
    ?? SYSTEM_MAIL_TEMPLATES[0]
}
