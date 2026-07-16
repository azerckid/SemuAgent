import { describe, expect, it } from 'vitest'
import {
  containsAssistantSensitiveText,
  redactAssistantText,
} from './text-redaction'

describe('redactAssistantText', () => {
  it('redacts Korean identifiers, payment data, and secrets', () => {
    const result = redactAssistantText(
      '주민 900101-1234567, 전화 010-1234-5678, 카드 1234-5678-9012-3456, password: secret123',
    )

    expect(result.redacted).toBe(true)
    expect(containsAssistantSensitiveText(result.text)).toBe(false)
    expect(result.text).not.toContain('900101-1234567')
    expect(result.text).not.toContain('010-1234-5678')
  })

  it('leaves ordinary product questions unchanged', () => {
    const text = '부가세 화면에서 추가 공제 가능성은 어디에서 확인하나요?'
    expect(redactAssistantText(text)).toEqual({ text, redacted: false })
  })
})
