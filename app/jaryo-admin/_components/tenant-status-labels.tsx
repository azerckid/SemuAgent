import type { TenantSubscriptionStatus } from '@/lib/jaryo-admin/tenant-next-action'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info'

export function subscriptionStatusLabel(status: TenantSubscriptionStatus): string {
  if (!status) return '구독 없음'
  return status
}

export function subscriptionStatusBadgeVariant(status: TenantSubscriptionStatus): BadgeVariant {
  switch (status) {
    case 'active':
      return 'success'
    case 'past_due':
      return 'destructive'
    case 'manual_pilot':
      return 'warning'
    case 'pending_payment':
      return 'secondary'
    case 'canceled':
      return 'outline'
    default:
      return 'outline'
  }
}

export function contractTypeLabel(contractType: 'manual_pilot' | 'manual_invoice' | 'provider_auto_billing' | null): string {
  switch (contractType) {
    case 'manual_pilot':
      return '수동 파일럿'
    case 'manual_invoice':
      return '수동 청구'
    case 'provider_auto_billing':
      return '자동 결제'
    default:
      return '미설정'
  }
}

export function invoiceEventStatusBadgeVariant(status: 'pending' | 'succeeded' | 'failed' | 'skipped'): BadgeVariant {
  switch (status) {
    case 'succeeded':
      return 'success'
    case 'failed':
      return 'destructive'
    case 'pending':
      return 'warning'
    default:
      return 'outline'
  }
}

export function webhookEventStatusBadgeVariant(status: 'received' | 'processed' | 'skipped' | 'failed'): BadgeVariant {
  switch (status) {
    case 'processed':
      return 'success'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}
