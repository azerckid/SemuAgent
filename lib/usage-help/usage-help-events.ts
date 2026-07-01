import type { UsageHelpRouteKey } from '@/lib/usage-help/route-context'

export type UsageHelpEventOutcome =
  | 'answered'
  | 'refused'
  | 'error'
  | 'rate_limited'

export type UsageHelpEventPayload = {
  outcome: UsageHelpEventOutcome
  routeKey: UsageHelpRouteKey | null
  llmInvoked: boolean
  durationMs?: number
  redacted?: boolean
  scopeRefused?: boolean
}

export function logUsageHelpEvent(payload: UsageHelpEventPayload) {
  console.info('[usage-help]', JSON.stringify({
    event: 'usage_help_request',
    outcome: payload.outcome,
    routeKey: payload.routeKey,
    llmInvoked: payload.llmInvoked,
    durationMs: payload.durationMs ?? null,
    redacted: payload.redacted ?? false,
    scopeRefused: payload.scopeRefused ?? false,
  }))
}

export function logUsageHelpProviderFailure(params: {
  routeKey: UsageHelpRouteKey | null
  errorName: string
}) {
  console.info('[usage-help]', JSON.stringify({
    event: 'usage_help_provider_failure',
    routeKey: params.routeKey,
    errorName: params.errorName,
  }))
}
