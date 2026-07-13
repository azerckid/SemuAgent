import { z } from 'zod'

export const HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_URL = 'https://www.hometax.go.kr/'

export const NTS_SIMPLIFIED_WAGE_SUBMISSION_METHOD_URL =
  'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239045&mi=40990'

export const NTS_SIMPLIFIED_WAGE_DUTY_URL =
  'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239032&mi=40678'

export const HOMETAX_RESOURCE_PORTAL_URL = 'https://www.hometax.go.kr/'

export const HOMETAX_SIMPLIFIED_WAGE_MENU_PATH =
  '지급명세·자료·공익법인 → 일용·간이지급명세서/사업장제공자 등의 과세자료 제출명세서 제출(매월·반기) → 직접작성 제출'

export const hometaxDirectEntryStepSchema = z.object({
  order: z.number().int().positive(),
  label: z.string().min(1),
})

export type HometaxDirectEntryStep = z.infer<typeof hometaxDirectEntryStepSchema>

export const HOMETAX_SIMPLIFIED_WAGE_DIRECT_ENTRY_STEPS: HometaxDirectEntryStep[] = [
  { order: 1, label: '홈택스에 로그인합니다.' },
  { order: 2, label: HOMETAX_SIMPLIFIED_WAGE_MENU_PATH },
  { order: 3, label: '간이지급명세서(근로소득)를 선택하고 아래 정리값을 소득자별로 입력합니다.' },
]
