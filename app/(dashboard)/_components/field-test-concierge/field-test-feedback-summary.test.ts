import { describe, expect, it } from 'vitest'
import { formatFieldTestFeedbackSummary } from './field-test-feedback-summary'

describe('formatFieldTestFeedbackSummary', () => {
  it('formats issue and note summaries without requiring persistence', () => {
    const summary = formatFieldTestFeedbackSummary({
      completedStepCount: 3,
      skippedStepCount: 1,
      issues: [
        {
          scenarioTitle: 'Dashboard',
          stepLabel: 'Step 2',
          screen: '/dashboard',
          expected: '우선순위가 명확해야 함',
          actual: '상태가 중복되어 헷갈림',
          priority: 'Medium',
          problemType: 'workflow mismatch',
          suggestion: '표시 건수 문구 보강',
        },
      ],
      notes: [
        {
          scenarioTitle: 'Mail',
          stepLabel: 'Step 4',
          note: '테스트 수신함 안내가 필요함',
        },
      ],
    })

    expect(summary).toContain('Completed steps: 3')
    expect(summary).toContain('Skipped steps: 1')
    expect(summary).toContain('Priority: Medium')
    expect(summary).toContain('Problem type: workflow mismatch')
    expect(summary).toContain('테스트 수신함 안내가 필요함')
  })

  it('prints explicit empty states when no feedback exists', () => {
    const summary = formatFieldTestFeedbackSummary({
      completedStepCount: 0,
      skippedStepCount: 0,
      issues: [],
      notes: [],
    })

    expect(summary).toContain('Notes\n- None')
    expect(summary).not.toContain('Issues')
  })
})
