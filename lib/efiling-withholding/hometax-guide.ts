import { z } from 'zod'

/** Layout Acquisition §4 — 홈택스 원천세 변환제출 (메뉴 경로; tmIdx는 환경별 변동 가능) */
export const HOMETAX_WITHHOLDING_CONVERT_URL = 'https://www.hometax.go.kr/'

export const NTS_WITHHOLDING_WRITING_GUIDE_URL =
  'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=74837&mi=40990'

export const hometaxWithholdingUploadStepSchema = z.object({
  order: z.number().int().positive(),
  label: z.string().min(1),
})

export type HometaxWithholdingUploadStep = z.infer<typeof hometaxWithholdingUploadStepSchema>

export const HOMETAX_WITHHOLDING_UPLOAD_STEPS: HometaxWithholdingUploadStep[] = [
  { order: 1, label: '홈택스 로그인' },
  { order: 2, label: '신고/납부 → 원천세 → 변환 파일제출(회계·급여 프로그램 이용)' },
  { order: 3, label: '원천징수이행상황신고서 변환 파일 업로드' },
  { order: 4, label: '형식·내용 검증 → 제출 (암호화 파일은 슬라이스 2b)' },
  { order: 5, label: '접수증 저장 — 신고지원 제출 접수증 보관에 업로드' },
]
