import { describe, expect, it } from 'vitest'
import {
  containsUsageHelpSensitiveContent,
  redactUsageHelpLlmAnswer,
} from '@/lib/usage-help/response-redaction'

describe('redactUsageHelpLlmAnswer', () => {
  it('leaves safe answers unchanged', () => {
    const answer = '자료 검토 화면에서는 제출 자료 현황과 누락 항목을 확인합니다.'
    expect(redactUsageHelpLlmAnswer(answer)).toEqual({
      answer,
      redacted: false,
    })
  })

  it('redacts email addresses in LLM answers', () => {
    const result = redactUsageHelpLlmAnswer('담당자 이메일은 client@example.com 입니다.')
    expect(result.redacted).toBe(true)
    expect(result.answer).not.toContain('client@example.com')
    expect(containsUsageHelpSensitiveContent(result.answer)).toBe(false)
  })

  it('redacts every email when multiple addresses appear', () => {
    const result = redactUsageHelpLlmAnswer(
      '담당자는 client@example.com 이고 보조는 backup@example.org 입니다.',
    )
    expect(result.redacted).toBe(true)
    expect(result.answer).not.toContain('client@example.com')
    expect(result.answer).not.toContain('backup@example.org')
    expect(containsUsageHelpSensitiveContent(result.answer)).toBe(false)
  })

  it('redacts upload token paths and blob URLs', () => {
    const result = redactUsageHelpLlmAnswer(
      '업로드 링크는 /upload/abcdefghijklmnopqrstuv 와 https://abc.public.blob.vercel-storage.com/file 입니다.',
    )
    expect(result.redacted).toBe(true)
    expect(result.answer).not.toContain('/upload/abcdefghijklmnopqrstuv')
    expect(result.answer).not.toContain('vercel-storage.com')
  })

  it('redacts every upload path when multiple paths appear', () => {
    const result = redactUsageHelpLlmAnswer(
      '첫 링크 /upload/abcdefghijklmnopqrstuv, 두 번째 /upload/zyxwvutsrqponmlkjihg 입니다.',
    )
    expect(result.redacted).toBe(true)
    expect(result.answer).not.toContain('/upload/abcdefghijklmnopqrstuv')
    expect(result.answer).not.toContain('/upload/zyxwvutsrqponmlkjihg')
    expect(containsUsageHelpSensitiveContent(result.answer)).toBe(false)
  })

  it('redacts every blob URL when multiple URLs appear', () => {
    const result = redactUsageHelpLlmAnswer(
      '파일1 https://a.public.blob.vercel-storage.com/one 파일2 https://b.public.blob.vercel-storage.com/two',
    )
    expect(result.redacted).toBe(true)
    expect(result.answer).not.toContain('vercel-storage.com')
    expect(containsUsageHelpSensitiveContent(result.answer)).toBe(false)
  })

  it('redacts repeated storage keys and content hashes', () => {
    const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const keyA = 'blob_abcdefghijklmnopqrstuvwx'
    const keyB = 'blob_zyxwvutsrqponmlkjihgfedcba'
    const result = redactUsageHelpLlmAnswer(
      `키 ${keyA}, 키 ${keyB}, 해시 ${hash}, 해시 ${hash}`,
    )
    expect(result.redacted).toBe(true)
    expect(result.answer).not.toContain(keyA)
    expect(result.answer).not.toContain(keyB)
    expect(result.answer).not.toContain(hash)
    expect(containsUsageHelpSensitiveContent(result.answer)).toBe(false)
  })
})
