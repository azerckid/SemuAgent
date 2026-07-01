export type TenantSubscriptionStatus =
  | 'manual_pilot'
  | 'pending_payment'
  | 'active'
  | 'past_due'
  | 'canceled'
  | null

export type DeriveTenantNextActionInput = {
  subscriptionStatus: TenantSubscriptionStatus
  hasBillingProfile: boolean
}

/**
 * Pure derivation of the row-level "다음 작업" label.
 * Billing profile completeness is checked before subscription status because
 * an incomplete profile blocks any invoice/charge flow regardless of status.
 */
export function deriveTenantNextAction(input: DeriveTenantNextActionInput): string {
  if (!input.hasBillingProfile) return '청구정보 요청'

  switch (input.subscriptionStatus) {
    case 'past_due':
      return '결제 실패 follow-up'
    case 'manual_pilot':
      return '수동 invoice 확인'
    case 'pending_payment':
      return '결제 수단 등록 대기'
    case 'canceled':
      return '해지 후속 확인'
    case 'active':
      return '정상 운영'
    default:
      return '구독 상태 확인'
  }
}
