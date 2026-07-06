import type { ValidationIssue } from './types'

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error')
}
