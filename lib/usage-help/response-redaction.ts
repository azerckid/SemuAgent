const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BLOB_URL_PATTERN = /https?:\/\/[^\s]*vercel-storage\.com[^\s]*/gi
const UPLOAD_TOKEN_PATH_PATTERN = /\/upload\/[A-Za-z0-9_-]{12,}/gi
const CONTENT_HASH_PATTERN = /\b0x[0-9a-fA-F]{32,}\b/g
const STORAGE_KEY_PATTERN = /\bblob_[A-Za-z0-9_-]{20,}\b/g

const REDACTION_PATTERNS = [
  EMAIL_PATTERN,
  BLOB_URL_PATTERN,
  UPLOAD_TOKEN_PATH_PATTERN,
  CONTENT_HASH_PATTERN,
  STORAGE_KEY_PATTERN,
] as const

const REDACTION_REPLACEMENT = '[민감 정보는 표시하지 않습니다]'
const DUPLICATE_REDACTION_PATTERN =
  /\[민감 정보는 표시하지 않습니다\](?:\s*\[민감 정보는 표시하지 않습니다\])+/g

export type UsageHelpRedactionResult = {
  answer: string
  redacted: boolean
}

function patternMatches(text: string, pattern: RegExp) {
  const matcher = new RegExp(pattern.source, pattern.flags)
  return matcher.test(text)
}

export function redactUsageHelpLlmAnswer(answer: string): UsageHelpRedactionResult {
  let redacted = false
  let sanitized = answer

  for (const pattern of REDACTION_PATTERNS) {
    const replaced = sanitized.replace(pattern, REDACTION_REPLACEMENT)
    if (replaced !== sanitized) {
      redacted = true
      sanitized = replaced
    }
  }

  sanitized = sanitized.replace(DUPLICATE_REDACTION_PATTERN, REDACTION_REPLACEMENT)

  return { answer: sanitized.trim(), redacted }
}

export function containsUsageHelpSensitiveContent(text: string) {
  return REDACTION_PATTERNS.some((pattern) => patternMatches(text, pattern))
}
