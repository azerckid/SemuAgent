export type FieldTestPriority = 'High' | 'Medium' | 'Low'

export type FieldTestProblemType =
  | 'Bug'
  | 'confusing wording'
  | 'missing status'
  | 'workflow mismatch'
  | 'future idea'

export type FieldTestStep = {
  instruction: string
  expectedResult?: string
  screen?: string
}

export type FieldTestScenario = {
  id: string
  title: string
  purpose: string
  operatorSetup: string[]
  steps: FieldTestStep[]
  expectedResult: string[]
  feedbackPrompts: string[]
}

export type FieldTestIssue = {
  scenarioTitle: string
  stepLabel: string
  screen?: string
  expected: string
  actual: string
  priority: FieldTestPriority
  problemType: FieldTestProblemType
  suggestion: string
}

export type FieldTestNote = {
  scenarioTitle: string
  stepLabel: string
  note: string
}
