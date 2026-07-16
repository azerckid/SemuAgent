import {
  containsAssistantSensitiveText,
  redactAssistantText,
} from '@/lib/assistant/text-redaction'

export type UsageHelpRedactionResult = {
  answer: string
  redacted: boolean
}

export function redactUsageHelpLlmAnswer(answer: string): UsageHelpRedactionResult {
  const result = redactAssistantText(answer)
  return { answer: result.text, redacted: result.redacted }
}

export function containsUsageHelpSensitiveContent(text: string) {
  return containsAssistantSensitiveText(text)
}
