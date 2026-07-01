export type ClientStatusTone = 'success' | 'warning' | 'destructive' | 'info' | 'secondary'

export interface ClientStatusBadge {
  label: string
  detail: string
  tone: ClientStatusTone
}

export interface ClientWorkspaceStatus {
  staff: ClientStatusBadge
  latestRequest: ClientStatusBadge
  upload: ClientStatusBadge
  review: ClientStatusBadge
  payroll: ClientStatusBadge
  cc: ClientStatusBadge
  summary: ClientStatusBadge
  isAssignedToCurrentStaff: boolean
  needsAttention: boolean
}

export interface ClientRow {
  id: string
  name: string
  contactName: string | null
  email: string
  staffId: string | null
  staffName: string | null
  address: string | null
  phone: string | null
  analysisNotes: string | null
  templateId: string | null
  status: ClientWorkspaceStatus
}
