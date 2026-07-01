import { describe, expect, it } from 'vitest'
import { resolveUiTermAnswer } from '@/lib/usage-help/ui-term-answers'

describe('resolveUiTermAnswer', () => {
  it('answers 사유입력 UI term questions', () => {
    const answer = resolveUiTermAnswer('사유입력은 무엇인가?')
    expect(answer).not.toBeNull()
    expect(answer?.body).toContain('사유 입력')
    expect(answer?.body).toContain('제출 없음')
    expect(answer?.sourceLabel).toBe('자료 검토 · 제출 자료 현황')
  })

  it('answers spaced 사유 입력 variant', () => {
    const answer = resolveUiTermAnswer('사유 입력은 뭐예요?')
    expect(answer?.body).toContain('담당자 승인')
  })
})
