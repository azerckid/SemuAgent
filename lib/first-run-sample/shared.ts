// Client-safe types/helpers for first-run sample data.
// IMPORTANT: 이 파일은 절대 `@/lib/db`(=`@/lib/env`)를 import하지 않는다.
// SampleDataBanner 같은 client 컴포넌트가 여기서 import하므로, db를 끌어들이면
// 서버 전용 env 검증이 브라우저 번들에서 실행되어 대시보드가 크래시한다(JC-019 회귀).

export type FirstRunSampleVisibleStatus = 'creating' | 'active' | 'delete_pending' | 'failed'

export type FirstRunSampleState =
  | { status: 'none'; visible: false }
  | { status: 'deleted'; visible: false; datasetId: string; clientId: string }
  | {
      status: FirstRunSampleVisibleStatus
      visible: true
      datasetId: string
      clientId: string
      clientName: string | null
      seedVersion: string
      periodKey: string
      payrollPeriodKey: string
      errorMessage: string | null
    }

export const VISIBLE_SAMPLE_STATUSES = ['creating', 'active', 'delete_pending', 'failed'] as const

export function sampleStatusLabel(status: FirstRunSampleVisibleStatus) {
  switch (status) {
    case 'creating':
      return '샘플 생성 중'
    case 'delete_pending':
      return '샘플 삭제 중'
    case 'failed':
      return '샘플 생성 실패'
    case 'active':
    default:
      return '샘플 데이터'
  }
}
