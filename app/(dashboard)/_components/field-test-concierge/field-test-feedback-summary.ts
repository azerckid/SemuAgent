import type { FieldTestIssue, FieldTestNote } from './field-test-types'

export function formatFieldTestFeedbackSummary({
  issues,
  notes,
  completedStepCount,
  skippedStepCount,
}: {
  issues: FieldTestIssue[]
  notes: FieldTestNote[]
  completedStepCount: number
  skippedStepCount: number
}) {
  const lines = [
    'JARYO Beta field test feedback',
    '',
    `Completed steps: ${completedStepCount}`,
    `Skipped steps: ${skippedStepCount}`,
    `Notes: ${notes.length}`,
  ]

  if (issues.length > 0) {
    lines.push('', `Issues: ${issues.length}`, 'Issues')
    for (const issue of issues) {
      lines.push(
        `- Scenario: ${issue.scenarioTitle}`,
        `  Step: ${issue.stepLabel}`,
        `  Screen: ${issue.screen ?? '-'}`,
        `  Expected: ${issue.expected || '-'}`,
        `  Actual: ${issue.actual || '-'}`,
        `  Priority: ${issue.priority}`,
        `  Problem type: ${issue.problemType}`,
        `  Suggested wording or behavior: ${issue.suggestion || '-'}`,
      )
    }
  }

  lines.push('', 'Notes')

  if (notes.length === 0) {
    lines.push('- None')
  } else {
    for (const note of notes) {
      lines.push(
        `- Scenario: ${note.scenarioTitle}`,
        `  Step: ${note.stepLabel}`,
        `  Note: ${note.note || '-'}`,
      )
    }
  }

  return lines.join('\n')
}
