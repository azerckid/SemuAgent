import { describe, expect, it } from 'vitest'
import {
  matchUsageHelpRouteKey,
  resolveUsageHelpRouteContext,
  resolveRouteSuggestedQuestions,
} from '@/lib/usage-help/route-context'

describe('matchUsageHelpRouteKey', () => {
  it('maps session detail routes to sessions key', () => {
    expect(matchUsageHelpRouteKey('/dashboard/sessions/abc-123')).toBe('/dashboard/sessions')
  })

  it('maps client detail routes separately from list', () => {
    expect(matchUsageHelpRouteKey('/dashboard/clients')).toBe('/dashboard/clients')
    expect(matchUsageHelpRouteKey('/dashboard/clients/client-1')).toBe('/dashboard/clients/detail')
  })

  it('maps direct upload route', () => {
    expect(matchUsageHelpRouteKey('/dashboard/direct-upload')).toBe('/dashboard/direct-upload')
  })
})

describe('resolveUsageHelpRouteContext', () => {
  it('returns session detail screen label', () => {
    const context = resolveUsageHelpRouteContext('/dashboard/sessions/abc-123')
    expect(context.screenLabel).toBe('자료 검토 세션 상세')
    expect(context.defaultSourceLabel).toBe('자료 검토 세션 상세')
  })

  it('returns payroll suggestions on payroll route', () => {
    const questions = resolveRouteSuggestedQuestions('/dashboard/payroll')
    expect(questions[0]).toBe('급여 엑셀 초안은 어디서 만드나요?')
  })
})
