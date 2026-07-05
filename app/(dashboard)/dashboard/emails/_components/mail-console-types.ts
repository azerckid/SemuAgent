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
