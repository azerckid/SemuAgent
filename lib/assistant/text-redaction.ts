const REDACTION_REPLACEMENT = '[민감 정보는 표시하지 않습니다]'

const SENSITIVE_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /\b\d{6}[-\s]?[1-4]\d{6}\b/g,
  /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/g,
  /(?:계좌(?:번호)?|account)\s*[:#-]?\s*[\d-]{8,}/gi,
  /\b(?:\d[ -]?){13,19}\b/g,
  /https?:\/\/[^\s]*vercel-storage\.com[^\s]*/gi,
  /\/upload\/[A-Za-z0-9_-]{12,}/gi,
  /\bblob_[A-Za-z0-9_-]{20,}\b/g,
  /\b0x[0-9a-fA-F]{32,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~-]{12,}\b/gi,
  /(?:비밀번호|password|token|인증\s*토큰)\s*[:=]\s*\S+/gi,
] as const

const DUPLICATE_REDACTION_PATTERN = new RegExp(
  `${REDACTION_REPLACEMENT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*${REDACTION_REPLACEMENT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})+`,
  'g',
)

export type AssistantTextRedactionResult = {
  text: string
  redacted: boolean
}

function patternMatches(text: string, pattern: RegExp) {
  return new RegExp(pattern.source, pattern.flags).test(text)
}

export function redactAssistantText(value: string): AssistantTextRedactionResult {
  let text = value
  let redacted = false

  for (const pattern of SENSITIVE_PATTERNS) {
    const next = text.replace(pattern, REDACTION_REPLACEMENT)
    if (next !== text) redacted = true
    text = next
  }

  return {
    text: text.replace(DUPLICATE_REDACTION_PATTERN, REDACTION_REPLACEMENT).trim(),
    redacted,
  }
}

export function containsAssistantSensitiveText(value: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => patternMatches(value, pattern))
}
