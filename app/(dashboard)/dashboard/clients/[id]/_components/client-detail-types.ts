export interface ClientDetailEvent {
  id: string
  accountingPeriod: string
  frequency: string
  requestKind: string
  title: string
  dueAt: string
  status: string
  uploadSessionId: string | null
  createdAt: string
}

export interface ClientDetailSession {
  id: string
  accountingPeriod: string
  status: string
  expiresAt: string
  lastAccessedAt: string | null
  createdAt: string
  requestEventId: string | null
  requestKind: string
}

export interface ClientDetailSchedule {
  id: string
  frequency: string
  startsOn: string
  endsOn: string | null
  sendRule: string | null
  dueRule: string | null
  emailSubjectTemplate: string | null
  isActive: boolean
  createdAt: string
}

export interface ClientDetailTemplate {
  id: string
  name: string
  frequency: string
  emailBodyTemplate: string | null
  analysisCriteriaTemplate: string | null
  isActive: boolean
  createdAt: string
}

export interface ClientDetailCcGroup {
  id: string
  name: string
  purpose: 'general' | 'payroll' | 'all'
  emails: string
  isDefault: boolean
}

export interface ClientDetailDocument {
  id: string
  documentType: string
  originalFilename: string
  contentType: string
  fileSize: number
  memo: string | null
  uploadedByStaffName: string | null
  createdAt: string
}
