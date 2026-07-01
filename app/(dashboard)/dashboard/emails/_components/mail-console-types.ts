import type { MailTemplateWorkType } from '@/lib/mail-console/default-templates'

export type MailConsoleSendReady = 'ready' | 'blocked'
export type MailConsoleCcGroupPurpose = 'general' | 'payroll' | 'all'
export type MailHistoryEmailStatus = 'draft' | 'sent' | 'failed' | 'rejected'
export type MailHistoryEmailType =
  | 'upload_request'
  | 'missing_request'
  | 'completion_thanks'
  | 'reminder'
  | 'staff_notification'
  | 'transaction_purpose_request'
export type MailTemplateFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'

export interface MailConsoleCcGroupOption {
  id: string
  name: string
  purpose: MailConsoleCcGroupPurpose
  emails: string
  isDefault: boolean
}

export interface MailConsoleClient {
  id: string
  name: string
  managerName: string
  toEmail: string | null
  ccGroups: MailConsoleCcGroupOption[]
  ccGroup: string | null
  ccEmails: string | null
  ccGroupPurpose: MailConsoleCcGroupPurpose | null
  sendReady: MailConsoleSendReady
}

export interface MailConsoleTemplateDraft {
  requestTemplateId?: string | null
  appliedTemplateId?: string | null
  workType: MailTemplateWorkType
  frequency: MailTemplateFrequency
  accountingPeriod: string
  dueDate: string
  subject: string
  body: string
  analysisCriteriaSnapshot?: string | null
}

export const mailTemplateTokens = [
  '[[고객명]]',
  '[[담당자명]]',
  '[[회계기간]]',
  '[[제출기한]]',
  '[[업로드링크]]',
]

export interface MailHistoryRow {
  id: string
  type: MailHistoryEmailType
  subject: string
  toEmail: string
  ccEmail: string | null
  status: MailHistoryEmailStatus
  sentAt: string | null
  createdAt: string
  sessionId: string
  accountingPeriod: string
  clientName: string
}

export interface MailTemplateRow {
  id: string
  name: string
  workType: MailTemplateWorkType | null
  frequency: MailTemplateFrequency
  clientName: string | null
  emailSubjectTemplate: string
  emailBodyTemplate: string
  analysisCriteriaTemplate: string | null
  isDefaultForWorkType: boolean
  isActive: boolean
  updatedAt: string
  createdAt: string
}

export type InboundEmailProcessingStatus = 'received' | 'stored' | 'held' | 'ignored' | 'failed'
export type InboundEmailDirection = 'inbound' | 'outbound'

export interface InboundMailRow {
  id: string
  staffMailboxId: string
  direction: InboundEmailDirection
  fromEmail: string | null
  toEmail: string
  subject: string | null
  receivedAt: string | null
  clientLabelId: string | null
  clientLabelName: string | null
  processingStatus: InboundEmailProcessingStatus
  createdAt: string
  attachmentCount: number
}

export interface InboundMailAttachment {
  id: string
  originalFilename: string | null
  contentType: string | null
  fileSize: number | null
  status: 'stored' | 'ignored' | 'failed'
  downloadReady: boolean
}

export interface InboundMailDetail extends InboundMailRow {
  ccEmail: string | null
  textBody: string | null
  htmlBody: string | null
}

export interface InboundMailClientOption {
  id: string
  name: string
}

export interface WorkEmailAddressRow {
  id: string
  address: string
  state: string
  staffId: string | null
  staffName: string | null
}

export interface WorkEmailStaffOption {
  id: string
  name: string
  email: string
  active: boolean
}

export interface WorkEmailInternalCcGroupOption {
  id: string
  name: string
  purpose: MailConsoleCcGroupPurpose
  emails: string
  isDefault: boolean
}
