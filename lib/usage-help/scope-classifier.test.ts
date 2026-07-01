import { describe, expect, it } from 'vitest'
import { classifyUsageHelpScope } from '@/lib/usage-help/scope-classifier'

describe('classifyUsageHelpScope', () => {
  it('allows JARYO usage questions', () => {
    expect(classifyUsageHelpScope('자료검토 화면은 무엇을 보는 곳인가요?').kind).toBe('usage')
    expect(classifyUsageHelpScope('제출 없음은 무슨 뜻인가요?').kind).toBe('usage')
    expect(classifyUsageHelpScope('급여 결과 엑셀은 어디서 다운로드하나요?').kind).toBe('usage')
    expect(classifyUsageHelpScope('메일 일괄 발송은 어디서 하나요?').kind).toBe('usage')
  })

  it('refuses customer-specific accounting judgment', () => {
    const result = classifyUsageHelpScope('이 고객사는 세금계산서를 안 내도 되나요?')
    expect(result.kind).toBe('refused')
    if (result.kind === 'refused') {
      expect(result.reason).toBe('customer_data')
    }
  })

  it('refuses general payroll or tax knowledge', () => {
    const result = classifyUsageHelpScope('2026년 국민연금 요율 알려줘')
    expect(result.kind).toBe('refused')
    if (result.kind === 'refused') {
      expect(result.reason).toBe('tax_legal')
    }
  })

  it('refuses action execution requests', () => {
    const result = classifyUsageHelpScope('이 파일을 삭제해줘')
    expect(result.kind).toBe('refused')
    if (result.kind === 'refused') {
      expect(result.reason).toBe('action')
    }
  })

  it('refuses web search requests', () => {
    const result = classifyUsageHelpScope('인터넷에서 더존 양식 찾아줘')
    expect(result.kind).toBe('refused')
    if (result.kind === 'refused') {
      expect(result.reason).toBe('web_search')
    }
  })

  it('refuses customer email summarization', () => {
    const result = classifyUsageHelpScope('고객사 이메일 내용을 요약해줘')
    expect(result.kind).toBe('refused')
    if (result.kind === 'refused') {
      expect(result.reason).toBe('customer_data')
    }
  })
})
