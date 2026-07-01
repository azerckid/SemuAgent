import { hasPayrollMaterialMismatch, hasPeriodMismatch, hasPolicyOrMetadataOnlyContext } from './extraction-message'

export type PayrollAdaptiveStructuringEligibility = {
  eligible: boolean
  reason: string
}

type PayrollBatchStatus = 'pending' | 'running' | 'needs_review' | 'completed' | 'failed'

// Slice 1: 새 wrong-file 분류기를 만들지 않고, 기존 급여 추출 결과(batch status,
// row pass/fail count, errorMessage 분류기, 파일 비밀번호 상태)만으로 "구조화 제안"
// 노출 여부를 판단한다. AI 호출이나 새 DB 조회는 없다.
export function getPayrollAdaptiveStructuringEligibility(params: {
  hasFiles: boolean
  hasPasswordBlockedFile: boolean
  batchStatus: PayrollBatchStatus | null
  batchErrorMessage: string | null
  passCount: number
  failCount: number
}): PayrollAdaptiveStructuringEligibility {
  if (!params.hasFiles) {
    return { eligible: false, reason: '구조화 후보 없음' }
  }

  if (params.hasPasswordBlockedFile) {
    return { eligible: false, reason: '파일 확인 필요' }
  }

  if (params.batchStatus === null) {
    return { eligible: false, reason: '구조화 후보 없음' }
  }

  if (params.batchStatus === 'pending' || params.batchStatus === 'running') {
    return { eligible: false, reason: '검토 완료 후 가능' }
  }

  // row가 하나라도 추출됐다면 기존 추출기가 이 워크북을 읽은 것이다 — pass/fail
  // 보완 대상이지 구조화 제안 대상이 아니다.
  if (params.passCount > 0 || params.failCount > 0) {
    if (params.failCount === 0) {
      return { eligible: false, reason: '기존 구조화 로직으로 처리됨' }
    }
    return {
      eligible: false,
      reason: '추출은 되었지만 row 보완 대상입니다. 구조화 제안 대상은 추출 실패·미인식 양식입니다.',
    }
  }

  const message = params.batchErrorMessage ?? ''

  if (hasPolicyOrMetadataOnlyContext(message)) {
    return { eligible: false, reason: '사내 규정/메타정보만 감지되어 구조화 제안 대상이 아닙니다.' }
  }

  // 기간 불일치 출력 문구도 "급여 지급 데이터" 표현을 포함해 hasPayrollMaterialMismatch와
  // 겹친다. 기존 추출기가 양식은 정상 인식했고 단지 요청 기간에 해당하는 행이 없는
  // 경우이므로, 구조화 제안 대상이 아니라 기간/자료 재확인 대상으로 먼저 분류한다.
  if (hasPeriodMismatch(message)) {
    return { eligible: false, reason: '요청 기간에 해당하는 데이터가 없어 발생한 오류로 보입니다. 구조화 제안 대상이 아닙니다.' }
  }

  if (hasPayrollMaterialMismatch(message)) {
    return { eligible: true, reason: '급여 지급 데이터로 보이나 기존 추출기가 인식하지 못했습니다.' }
  }

  return { eligible: false, reason: '구조화 제안 대상인지 추가 확인이 필요합니다.' }
}
