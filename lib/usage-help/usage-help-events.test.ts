import { describe, expect, it, vi } from 'vitest'
import {
  logUsageHelpEvent,
  logUsageHelpProviderFailure,
} from '@/lib/usage-help/usage-help-events'

describe('usage help events', () => {
  it('logs metadata only for request outcomes', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logUsageHelpEvent({
      outcome: 'answered',
      routeKey: '/dashboard/reviews',
      llmInvoked: true,
      durationMs: 120,
      redacted: true,
    })

    expect(infoSpy).toHaveBeenCalledOnce()
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[1]))
    expect(payload).toEqual({
      event: 'usage_help_request',
      outcome: 'answered',
      routeKey: '/dashboard/reviews',
      llmInvoked: true,
      durationMs: 120,
      redacted: true,
      scopeRefused: false,
    })
    expect(payload).not.toHaveProperty('question')
    expect(payload).not.toHaveProperty('answer')
    expect(payload).not.toHaveProperty('prompt')
    expect(payload).not.toHaveProperty('stack')

    infoSpy.mockRestore()
  })

  it('logs provider failure metadata without error message content', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logUsageHelpProviderFailure({
      routeKey: '/dashboard/payroll',
      errorName: 'AnthropicError',
    })

    expect(infoSpy).toHaveBeenCalledOnce()
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[1]))
    expect(payload).toEqual({
      event: 'usage_help_provider_failure',
      routeKey: '/dashboard/payroll',
      errorName: 'AnthropicError',
    })

    infoSpy.mockRestore()
  })
})
