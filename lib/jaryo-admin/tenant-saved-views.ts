import { z } from 'zod'

/**
 * "지원 메모 있음" stays disabled — there is no support-note table yet (Slice 4).
 * Showing it as a working filter would imply data that does not exist.
 *
 * "갱신 임박"(renewal_upcoming) replaces an earlier "연 결제 갱신" idea. The
 * billing engine has no annual cycle at all (lib/billing/subscription.ts
 * always renews provider_auto_billing monthly), so an annual-only filter
 * would be guessed data. "갱신 임박" is cycle-agnostic: any
 * provider_auto_billing subscription whose nextBillingAt falls within the
 * lookahead window, which is a real stored signal.
 */
export const TENANT_SAVED_VIEWS = [
  { id: 'all', label: '전체', enabled: true },
  { id: 'payment_issue', label: '결제 문제', enabled: true },
  { id: 'billing_profile_missing', label: '청구정보 미완성', enabled: true },
  { id: 'pilot', label: '파일럿', enabled: true },
  { id: 'renewal_upcoming', label: '갱신 임박', enabled: true },
  { id: 'support_note', label: '지원 메모 있음', enabled: false },
] as const

export type TenantSavedViewId = (typeof TENANT_SAVED_VIEWS)[number]['id']

const enabledViewIds = TENANT_SAVED_VIEWS.filter((view) => view.enabled).map((view) => view.id) as [
  TenantSavedViewId,
  ...TenantSavedViewId[],
]

export const tenantSavedViewSchema = z.enum(enabledViewIds).default('all')

/** Narrows to the views that have a real, implemented filter — never the disabled placeholders. */
export type EnabledTenantSavedViewId = (typeof enabledViewIds)[number]
