import type { UsageHelpModelOutput } from '@/lib/usage-help/schemas'
import type { UsageHelpRefusalReason } from '@/lib/usage-help/refusal-templates'

const UNSAFE_PATTERNS: Array<{ pattern: RegExp; reason: UsageHelpRefusalReason }> = [
  { pattern: /고객\s*파일.*확인/, reason: 'customer_data' },
  { pattern: /업로드\s*파일.*확인했/, reason: 'customer_data' },
  { pattern: /이메일\s*내용.*확인/, reason: 'customer_data' },
  { pattern: /발송\s*(했|하겠|해\s*드)/, reason: 'action' },
  { pattern: /승인\s*(했|하겠|해\s*드)/, reason: 'action' },
  { pattern: /삭제\s*(했|하겠|해\s*드)/, reason: 'action' },
  { pattern: /제출하지\s*않아도\s*됩니다/, reason: 'tax_legal' },
  { pattern: /세금\s*계산/, reason: 'tax_legal' },
  { pattern: /법률\s*상/, reason: 'tax_legal' },
  { pattern: /국민연금\s*\d/, reason: 'tax_legal' },
  { pattern: /인터넷\s*검색/, reason: 'web_search' },
]

export function evaluateUsageHelpAnswerSafety(output: UsageHelpModelOutput) {
  if (output.status === 'refused') {
    return { safe: true as const }
  }

  for (const rule of UNSAFE_PATTERNS) {
    if (rule.pattern.test(output.answer)) {
      return { safe: false as const, reason: rule.reason }
    }
  }

  return { safe: true as const }
}
