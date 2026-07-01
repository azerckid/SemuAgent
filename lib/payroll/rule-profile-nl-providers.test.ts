import { describe, expect, it } from 'vitest'
import {
  buildUserPrompt,
  PAYROLL_RULE_FT_LEGAL_DEFAULT_BOUNDARY,
  SYSTEM_PROMPT,
} from './rule-profile-nl-prompt'

describe('payroll rule structure prompts', () => {
  it('pins the F~T statutory/default boundary in the system prompt', () => {
    expect(SYSTEM_PROMPT).toContain(PAYROLL_RULE_FT_LEGAL_DEFAULT_BOUNDARY)
    expect(SYSTEM_PROMPT).toContain('4대보험·소득세·지방소득세')
    expect(SYSTEM_PROMPT).toContain('F~T 지급항목 프로필과 무관')
    expect(SYSTEM_PROMPT).toContain('세법은 지급 의무를 만들지 않습니다')
    expect(SYSTEM_PROMPT).toContain('법정 기본 지급액이 없습니다')
    expect(SYSTEM_PROMPT).toContain('해당 월의 원자료 지급액')
    expect(SYSTEM_PROMPT).toContain('반복 적용 근거가 없으면 사내규칙 프로필 rules로 만들지 마세요')
  })

  it('tells AI not to turn missing company rules into draft rules', () => {
    const prompt = buildUserPrompt('사내규정 없음. 법에 따라 처리.', 'natural_language')

    expect(prompt).toContain('사내규정이 없다는 사실만으로 법정/default 항목을 rules에 만들지 마세요')
    expect(prompt).toContain('AI 구조화 draft는 입력에 명시된 회사별 지급 규칙만 담습니다')
    expect(prompt).toContain('rules는 빈 배열')
    expect(prompt).toContain('사내규정 없음')
  })

  it('keeps tax and insurance out of upload profile rules', () => {
    const prompt = buildUserPrompt('식대 비과세, 국민연금은 공단 고지액', 'rule_document')

    expect(prompt).toContain('식대(H)')
    expect(prompt).toContain('소득세법상 비과세/실비변상 판단 대상')
    expect(prompt).toContain('회사가 지급한다고 명시한 금액/공식이 있을 때만 rules에 넣으세요')
    expect(prompt).toContain('4대보험·소득세·지방소득세 등 공제/보험/세금은 F~T 지급항목 프로필과 무관')
  })

  it('requires structured legal and calculation fields', () => {
    const prompt = buildUserPrompt('야근은 1일 10만원, 근무표 야근일수 기준', 'natural_language')

    expect(prompt).toContain('"basisType": "company_rule | statutory_default | source_amount | tax_treatment | unknown"')
    expect(prompt).toContain('"lawBasis"')
    expect(prompt).toContain('"calculation"')
    expect(prompt).toContain('"unitAmount"')
    expect(prompt).toContain('"quantityInputKey"')
    expect(prompt).toContain('unitAmount * nightWorkDays')
    expect(prompt).toContain('ordinaryHourlyWage * nightWorkHours * 0.5')
    expect(prompt).toContain('근로기준법 제56조')
  })

  it('distinguishes monthly F~T source amounts from reusable company rules', () => {
    const prompt = buildUserPrompt('6월 급여표: 식대 200000, 상여 500000. 별도 사내규정 없음.', 'excel_embedded')

    expect(prompt).toContain('급여정산표 F~T 칸에 이미 값이 적혀 있으면')
    expect(prompt).toContain('해당 월의 원자료 지급액')
    expect(prompt).toContain('월별 급여 추출에서 보존')
    expect(prompt).toContain('사내규칙 프로필 rules로 만들지 마세요')
    expect(prompt).toContain('6월 급여표')
  })
})
