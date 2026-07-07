import { z } from 'zod'

/** Layout Acquisition §4 — 홈택스 간이지급 변환제출 진입 URL */
export const HOMETAX_SIMPLIFIED_WAGE_CONVERT_URL =
  'https://www.hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=44&tm2lIdx=4401000000&tm3lIdx=4401100000'

export const NTS_SIMPLIFIED_WAGE_SUBMISSION_METHOD_URL =
  'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239045&mi=40990'

export const NTS_SIMPLIFIED_WAGE_DUTY_URL =
  'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239032&mi=40678'

export const HOMETAX_RESOURCE_PORTAL_URL = 'https://www.hometax.go.kr/'

export const hometaxUploadStepSchema = z.object({
  order: z.number().int().positive(),
  label: z.string().min(1),
})

export type HometaxUploadStep = z.infer<typeof hometaxUploadStepSchema>

export const HOMETAX_SIMPLIFIED_WAGE_UPLOAD_STEPS: HometaxUploadStep[] = [
  { order: 1, label: '홈택스 로그인' },
  { order: 2, label: '지급명세·자료 → 일용·간이지급명세서/사업장제공자 등의 과세자료 제출명세서 제출(매월·반기)' },
  { order: 3, label: '변환 파일제출(회계·급여 프로그램 이용) 메뉴 확인' },
  { order: 4, label: 'plain 후보 파일은 사전검증용으로 확인' },
  { order: 5, label: '실제 업로드·제출은 암호화(NTS-CRYPTO)·적합성 검정 확인 후 진행' },
]

export const operationalChecklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
})

export type OperationalChecklistItem = z.infer<typeof operationalChecklistItemSchema>

/** Brief §9 HWP Refresh Checklist — 제출 반기마다 담당자 수행 */
export const SIMPLIFIED_WAGE_OPERATIONAL_CHECKLIST: OperationalChecklistItem[] = [
  {
    id: 'hwp-download',
    label: '홈택스 자료실에서 「간이지급명세서(근로소득) 전산매체 제출요령」+ 정오표 다운로드',
  },
  {
    id: 'scratch-refresh',
    label: 'scratch/jc-030-reference/ 갱신 · Field Mapping 변경 여부 기록',
  },
  {
    id: 'fixture-update',
    label: '단위 테스트 fixture 업데이트',
  },
  {
    id: 'staging-upload',
    label: '홈택스 변환제출 시험 검증(사용자 수동) — plain 후보/암호화 파일 수용 여부 확인',
  },
]
