import { z } from 'zod'

export type PayrollSourceDownloadState =
  | {
      enabled: true
      label: '부합 원자료 다운로드 가능'
      detail: string
    }
  | {
      enabled: false
      label: string
      detail: string
    }

export type PayrollResultExcelDownloadState =
  | {
      enabled: true
      label: '결과 엑셀 다운로드 가능'
      detail: string
    }
  | {
      enabled: false
      label: string
      detail: string
    }

export function parsePayrollSourceFileIds(value: string) {
  try {
    return z.array(z.string().min(1)).parse(JSON.parse(value))
  } catch {
    return []
  }
}

export function derivePayrollSourceDownloadState({
  batchStatus,
  rowVerdicts,
  sourceFileCount,
}: {
  batchStatus: string | null
  rowVerdicts: Array<string | null>
  sourceFileCount: number
}): PayrollSourceDownloadState {
  if (sourceFileCount === 0) {
    return {
      enabled: false,
      label: '업로드 파일 없음',
      detail: '업로드된 급여 원자료가 없습니다.',
    }
  }

  if (!batchStatus) {
    return {
      enabled: false,
      label: '추출 전',
      detail: '급여 정보 추출 완료 후 사용할 수 있습니다.',
    }
  }

  if (batchStatus === 'pending' || batchStatus === 'running') {
    return {
      enabled: false,
      label: '추출 완료 후 가능',
      detail: '급여 정보 추출이 끝난 뒤 부합 여부를 판단합니다.',
    }
  }

  if (batchStatus === 'failed') {
    return {
      enabled: false,
      label: '추출 실패',
      detail: '급여 정보 추출 실패를 해결한 뒤 다시 시도하세요.',
    }
  }

  if (batchStatus !== 'completed') {
    return {
      enabled: false,
      label: '담당자 확인 필요',
      detail: '최신 급여 추출 batch가 완료 상태가 아닙니다.',
    }
  }

  if (rowVerdicts.length === 0) {
    return {
      enabled: false,
      label: 'row 없음',
      detail: '추출된 급여 row가 없습니다.',
    }
  }

  const failCount = rowVerdicts.filter((verdict) => verdict !== 'pass').length
  if (failCount > 0) {
    return {
      enabled: false,
      label: '부적합 row 존재',
      detail: `부적합 row ${failCount}개를 해결해야 원자료를 부합 자료로 다운로드할 수 있습니다.`,
    }
  }

  return {
    enabled: true,
    label: '부합 원자료 다운로드 가능',
    detail: `모든 payroll row가 적합입니다. 원자료 ${sourceFileCount}개를 다운로드할 수 있습니다.`,
  }
}

export function derivePayrollResultExcelDownloadState({
  batchStatus,
  rowVerdicts,
}: {
  batchStatus: string | null
  rowVerdicts: Array<string | null>
}): PayrollResultExcelDownloadState {
  if (!batchStatus) {
    return {
      enabled: false,
      label: '추출 전',
      detail: '급여 정보 추출 완료 후 결과 엑셀을 다운로드할 수 있습니다.',
    }
  }

  if (batchStatus === 'pending' || batchStatus === 'running') {
    return {
      enabled: false,
      label: '추출 완료 후 가능',
      detail: '급여 정보 추출이 끝난 뒤 결과 엑셀을 다운로드할 수 있습니다.',
    }
  }

  if (batchStatus === 'failed') {
    return {
      enabled: false,
      label: '추출 실패',
      detail: '급여 정보 추출 실패를 해결한 뒤 다시 시도하세요.',
    }
  }

  if (batchStatus !== 'completed') {
    return {
      enabled: false,
      label: '담당자 확인 필요',
      detail: '최신 급여 추출 batch가 완료 상태가 아닙니다.',
    }
  }

  if (rowVerdicts.length === 0) {
    return {
      enabled: false,
      label: 'row 없음',
      detail: '추출된 급여 row가 없습니다.',
    }
  }

  const failCount = rowVerdicts.filter((verdict) => verdict !== 'pass').length
  if (failCount > 0) {
    return {
      enabled: false,
      label: '부적합 row 존재',
      detail: `부적합 row ${failCount}개를 해결해야 결과 엑셀을 다운로드할 수 있습니다.`,
    }
  }

  return {
    enabled: true,
    label: '결과 엑셀 다운로드 가능',
    detail: '모든 payroll row가 적합입니다. 작성된 결과 엑셀을 다운로드할 수 있습니다.',
  }
}
