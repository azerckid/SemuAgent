type RequestEventCadenceInput = {
  requestKind?: string | null
  frequency: string
}

const DETAILED_FREQUENCY_LABEL: Record<string, string> = {
  monthly: '월별',
  quarterly: '분기별',
  semiannual: '반기별',
  annual: '연간',
  custom: '비정기',
}

export function getRequestEventCadenceLabel(event: RequestEventCadenceInput): '정기' | '비정기' {
  if (event.requestKind === 'payroll') return '정기'
  return event.frequency === 'custom' ? '비정기' : '정기'
}

export function getRequestEventDetailedCadenceLabel(event: RequestEventCadenceInput): string {
  if (event.requestKind === 'payroll') return '정기'
  return DETAILED_FREQUENCY_LABEL[event.frequency] ?? event.frequency
}
