const STARTABLE_BOOKKEEPING_SESSION_STATUSES = [
  'active',
  'submitted',
  'ai_checking',
  'needs_resubmission',
  'ready_for_accountant',
  'completed',
] as const

const PENDING_FILE_ANALYSIS_STATUSES = ['uploaded', 'analyzing'] as const

type FileAnalysisState = {
  status: string
}

export type BookkeepingMaterialAttributionStartState = {
  eligible: boolean
  reason: string
}

export function hasPendingMaterialFileAnalysis(files: FileAnalysisState[]) {
  return files.some((file) => (PENDING_FILE_ANALYSIS_STATUSES as readonly string[]).includes(file.status))
}

export function getBookkeepingMaterialAttributionStartState(params: {
  sessionStatus: string
  files: FileAnalysisState[]
  workType?: string | null
}): BookkeepingMaterialAttributionStartState {
  if (params.workType !== undefined && params.workType !== 'bookkeeping') {
    return {
      eligible: false,
      reason: '기장 자료 세션에서만 귀속기간 검토를 시작할 수 있습니다.',
    }
  }

  if (params.files.length === 0) {
    return {
      eligible: false,
      reason: '업로드 파일이 없어 귀속기간 검토를 시작할 수 없습니다.',
    }
  }

  if (hasPendingMaterialFileAnalysis(params.files)) {
    return {
      eligible: false,
      reason: '파일 분석이 끝난 뒤 귀속기간 검토를 시작할 수 있습니다.',
    }
  }

  if (!(STARTABLE_BOOKKEEPING_SESSION_STATUSES as readonly string[]).includes(params.sessionStatus)) {
    return {
      eligible: false,
      reason: '현재 세션 상태에서는 귀속기간 검토를 시작할 수 없습니다.',
    }
  }

  return {
    eligible: true,
    reason: '분석 완료 파일이 있어 귀속기간 검토를 시작할 수 있습니다.',
  }
}

export function canStartBookkeepingMaterialAttribution(params: {
  sessionStatus: string
  files: FileAnalysisState[]
  workType?: string | null
}) {
  return getBookkeepingMaterialAttributionStartState(params).eligible
}
