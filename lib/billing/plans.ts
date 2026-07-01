import { z } from 'zod'

export const BILLING_PLAN_CODES = ['starter', 'growth', 'pro', 'enterprise'] as const
export const BILLING_CONTRACT_PLAN_CODES = ['starter', 'growth', 'pro', 'enterprise', 'pilot'] as const

export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number]
export type BillingContractPlanCode = (typeof BILLING_CONTRACT_PLAN_CODES)[number]

export const billingPlanCodeSchema = z.enum(BILLING_PLAN_CODES)
export const billingContractPlanCodeSchema = z.enum(BILLING_CONTRACT_PLAN_CODES)

export type BillingPlanDefinition = {
  code: BillingPlanCode
  name: string
  maxClients: number | null
  monthlyPriceKrw: number | null
  description: string
  actionLabel: string
  featureHeading?: string
  features: string[]
  tone: 'info' | 'success' | 'warning' | 'secondary'
}

export const BILLING_PLANS: BillingPlanDefinition[] = [
  {
    code: 'starter',
    name: 'Starter',
    maxClients: 15,
    monthlyPriceKrw: 33000,
    description: '고객사 15개까지 정액제 시작 기준',
    tone: 'info',
    actionLabel: '15개 기준',
    features: [
      '관리 고객사 15개까지',
      '월 33,000원 정액제(VAT 포함)',
      '보안 업로드 포털',
      'AI 누락 자료 판단',
      '담당자 승인 후 보충 요청',
      '기본 사용량 모니터링',
    ],
  },
  {
    code: 'growth',
    name: 'Growth',
    maxClients: 60,
    monthlyPriceKrw: 99000,
    description: '고객사 60개까지 반복 업무 운영',
    tone: 'success',
    actionLabel: '60개 기준',
    features: [
      '관리 고객사 60개까지',
      '월 99,000원 정액제(VAT 포함)',
      '정기/비정기 요청 운영',
      '고객사별 수신/참조 설정',
      'AI 분석과 후속 메일 초안',
      'AI·메일 사용량 가드레일',
      '유료 파일럿 전환 우선 기준',
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    maxClients: 90,
    monthlyPriceKrw: 148500,
    description: '고객사 90개까지 다수 담당자 운영',
    tone: 'warning',
    actionLabel: '90개 기준',
    featureHeading: 'Growth 포함, 추가로:',
    features: [
      '관리 고객사 90개까지',
      '월 148,500원 정액제(VAT 포함)',
      '다수 담당자 운영 규모',
      '자료 요청·업로드량 확대',
      'AI 분석 비용 가드레일 확대',
      '권한/보안 설계 우선 적용',
      '운영 지원 우선순위',
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    maxClients: null,
    monthlyPriceKrw: null,
    description: '90개 초과 또는 보안·권한 맞춤 지원',
    tone: 'secondary',
    actionLabel: '별도 견적 기준',
    featureHeading: 'Pro 포함, 추가로:',
    features: [
      '고객사 90개 초과',
      '맞춤 권한·보안 요구사항',
      '사무장/관리자 운영 구조 협의',
      '세금계산서·계약 조건 협의',
      '전담 온보딩과 운영 지원',
    ],
  },
]

export const PILOT_MONTHLY_PRICE_KRW = 33000
export const ANNUAL_DISCOUNT_RATE = 0.2

export function getBillingPlan(code: BillingPlanCode): BillingPlanDefinition {
  const plan = BILLING_PLANS.find((item) => item.code === code)
  if (!plan) throw new Error(`Unknown billing plan: ${code}`)
  return plan
}

export function getSuggestedBillingPlan(clientCount: number): BillingPlanDefinition {
  return (
    BILLING_PLANS.find((plan) => plan.maxClients === null || clientCount <= plan.maxClients) ??
    BILLING_PLANS[BILLING_PLANS.length - 1]
  )
}

export function formatKRW(value: number | null): string {
  if (value === null) return '별도 견적'
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`
}

export function annualPriceLabel(value: number | null): string {
  if (value === null) return '상담 후 확정'
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(value * 12 * (1 - ANNUAL_DISCOUNT_RATE)))}원/년`
}

export function planLimitLabel(plan: Pick<BillingPlanDefinition, 'maxClients'>): string {
  return plan.maxClients === null ? '90개 초과' : `${plan.maxClients}개까지`
}

export function usagePercent(clientCount: number, plan: Pick<BillingPlanDefinition, 'maxClients'>): number {
  if (plan.maxClients === null) return 100
  if (plan.maxClients === 0) return 0
  return Math.min(100, Math.round((clientCount / plan.maxClients) * 100))
}
