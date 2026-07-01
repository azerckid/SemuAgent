import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractPayrollWithClaudeInBatches,
  extractPayrollWithProviderFallback,
  getPayrollAiProviderOrder,
  mergePayrollExtractionResponses,
  selectPayrollSourceTextsForPeriod,
  type PayrollSourceText,
} from './payroll-extract'
import type { PayrollExtractionResponse } from '@/lib/validations/payroll'

const aiProviderMocks = vi.hoisted(() => ({
  geminiGenerateContent: vi.fn(),
  openAiCreate: vi.fn(),
  anthropicCreate: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  requireAnthropicEnv: () => ({ ANTHROPIC_API_KEY: 'test-anthropic-key' }),
  requireGoogleAiEnv: () => ({
    GOOGLE_AI_API_KEY: 'test-google-key',
    GEMINI_ANALYSIS_MODEL: 'gemini-3.5-flash',
  }),
  requireOpenAiEnv: () => ({ OPENAI_API_KEY: 'test-openai-key' }),
  isGeminiEnabled: () => process.env.GEMINI_ENABLED !== 'false',
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function GoogleGenerativeAI() {
    return {
      getGenerativeModel: vi.fn(() => ({
        generateContent: aiProviderMocks.geminiGenerateContent,
      })),
    }
  }),
}))

vi.mock('openai', () => ({
  default: vi.fn(function OpenAI() {
    return {
      chat: {
        completions: {
          create: aiProviderMocks.openAiCreate,
        },
      },
    }
  }),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function Anthropic() {
    return {
      messages: {
        create: aiProviderMocks.anthropicCreate,
      },
    }
  }),
}))

beforeEach(() => {
  delete process.env.GEMINI_ENABLED
  aiProviderMocks.geminiGenerateContent.mockReset()
  aiProviderMocks.openAiCreate.mockReset()
  aiProviderMocks.anthropicCreate.mockReset()
})

describe('getPayrollAiProviderOrder', () => {
  it('tries Gemini first, then OpenAI, and keeps Claude as the last fallback', () => {
    expect(getPayrollAiProviderOrder()).toEqual(['gemini', 'openai', 'claude'])
  })

  it('starts with OpenAI when Gemini is disabled', () => {
    process.env.GEMINI_ENABLED = 'false'
    expect(getPayrollAiProviderOrder()).toEqual(['openai', 'claude'])
  })
})

describe('extractPayrollWithProviderFallback', () => {
  const sourceTexts: PayrollSourceText[] = [{
    filename: '급여.xlsx',
    text: '성명 | 기본급\n한은숙 | 3200000',
    summary: 'payroll sample',
  }]

  const response: PayrollExtractionResponse = {
    payrollPeriod: '2026-06',
    rows: [{
      employeeName: '한은숙',
      baseSalary: 3200000,
      confidence: 'high',
      aiVerdict: 'pass',
      aiVerdictReason: null,
      sourceReference: { filename: '급여.xlsx' },
    }],
    warnings: [],
  }

  it('does not call OpenAI or Claude when Gemini succeeds', async () => {
    aiProviderMocks.geminiGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(response) },
    })

    const result = await extractPayrollWithProviderFallback(sourceTexts, '2026-06')

    expect(result.success).toBe(true)
    expect(aiProviderMocks.geminiGenerateContent).toHaveBeenCalledTimes(1)
    expect(aiProviderMocks.openAiCreate).not.toHaveBeenCalled()
    expect(aiProviderMocks.anthropicCreate).not.toHaveBeenCalled()
  })

  it('falls back to OpenAI before Claude when Gemini fails', async () => {
    aiProviderMocks.geminiGenerateContent.mockRejectedValue(new Error('Gemini unavailable'))
    aiProviderMocks.openAiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    })

    const result = await extractPayrollWithProviderFallback(sourceTexts, '2026-06')

    expect(result.success).toBe(true)
    expect(aiProviderMocks.geminiGenerateContent).toHaveBeenCalledTimes(1)
    expect(aiProviderMocks.openAiCreate).toHaveBeenCalledTimes(1)
    expect(aiProviderMocks.anthropicCreate).not.toHaveBeenCalled()
    if (result.success) {
      expect(result.data.warnings).toContain('Gemini 실패 후 OpenAI로 급여 추출을 완료했습니다.')
      // provider 에러 원문은 서버 로그에만 남기고 담당자 경고에는 노출하지 않는다.
      expect(result.data.warnings.join('\n')).not.toContain('Gemini unavailable')
    }
  })

  it('skips Gemini entirely when GEMINI_ENABLED=false', async () => {
    process.env.GEMINI_ENABLED = 'false'
    aiProviderMocks.openAiCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    })

    const result = await extractPayrollWithProviderFallback(sourceTexts, '2026-06')

    expect(result.success).toBe(true)
    expect(aiProviderMocks.geminiGenerateContent).not.toHaveBeenCalled()
    expect(aiProviderMocks.openAiCreate).toHaveBeenCalledTimes(1)
    expect(aiProviderMocks.anthropicCreate).not.toHaveBeenCalled()
  })
})

describe('mergePayrollExtractionResponses', () => {
  it('merges rows from separate chunks by employee code', () => {
    const responses: PayrollExtractionResponse[] = [
      {
        payrollPeriod: '2026-06',
        rows: [{
          employeeCode: 'PAY-001',
          employeeName: '한은숙',
          department: '경영지원팀',
          jobTitle: '과장',
          jobType: null,
          baseSalary: 3200000,
          bonus: null,
          mealAllowance: null,
          transportationAllowance: null,
          holidayWorkAllowance: null,
          domesticTravelAllowance: null,
          annualLeaveAllowance: null,
          rndAllowance: null,
          otherAllowance: null,
          performanceIncentive: null,
          nightWorkAllowance: null,
          deductionAmount: null,
          confidence: 'high',
          aiVerdict: 'pass',
          aiVerdictReason: null,
          sourceReference: { filename: '급여.xlsx', sheetName: '기초자료', rowHint: '2' },
        }],
        warnings: [],
      },
      {
        payrollPeriod: '2026-06',
        rows: [{
          employeeCode: 'PAY-001',
          employeeName: '한은숙',
          department: null,
          jobTitle: null,
          jobType: null,
          baseSalary: null,
          bonus: 100000,
          mealAllowance: null,
          transportationAllowance: null,
          holidayWorkAllowance: null,
          domesticTravelAllowance: null,
          annualLeaveAllowance: 250000,
          rndAllowance: null,
          otherAllowance: null,
          performanceIncentive: null,
          nightWorkAllowance: null,
          deductionAmount: null,
          confidence: 'medium',
          aiVerdict: 'pass',
          aiVerdictReason: null,
          sourceReference: { filename: '급여.xlsx', sheetName: '연차수당', rowHint: '15' },
        }],
        warnings: [],
      },
    ]

    const merged = mergePayrollExtractionResponses(responses, '2026-06')

    expect(merged.rows).toHaveLength(1)
    expect(merged.rows[0]).toMatchObject({
      employeeCode: 'PAY-001',
      employeeName: '한은숙',
      baseSalary: 3200000,
      bonus: 100000,
      annualLeaveAllowance: 250000,
      confidence: 'medium',
      aiVerdict: 'pass',
    })
    expect(merged.rows[0].sourceReference).toEqual({
      sources: [
        { filename: '급여.xlsx', sheetName: '기초자료', rowHint: '2' },
        { filename: '급여.xlsx', sheetName: '연차수당', rowHint: '15' },
      ],
    })
  })

  it('marks merged rows as fail when chunks disagree on the same amount field', () => {
    const responses: PayrollExtractionResponse[] = [
      {
        payrollPeriod: '2026-06',
        rows: [{
          employeeCode: 'PAY-002',
          employeeName: '박순',
          baseSalary: 2900000,
          confidence: 'high',
          aiVerdict: 'pass',
          aiVerdictReason: null,
          sourceReference: { sheetName: '기초자료', rowHint: '3' },
        }],
        warnings: [],
      },
      {
        payrollPeriod: '2026-06',
        rows: [{
          employeeCode: 'PAY-002',
          employeeName: '박순',
          baseSalary: 3100000,
          confidence: 'high',
          aiVerdict: 'pass',
          aiVerdictReason: null,
          sourceReference: { sheetName: '지급대장', rowHint: '3' },
        }],
        warnings: [],
      },
    ]

    const merged = mergePayrollExtractionResponses(responses, '2026-06')

    expect(merged.rows).toHaveLength(1)
    expect(merged.rows[0].baseSalary).toBe(2900000)
    expect(merged.rows[0].aiVerdict).toBe('fail')
    expect(merged.rows[0].aiVerdictReason).toContain('baseSalary 금액이 chunk 간 다릅니다')
    expect(merged.warnings.some((warning) => warning.includes('baseSalary 금액이 chunk 간 다릅니다'))).toBe(true)
  })

  it('merges name-only chunk rows into existing code and name rows', () => {
    const responses: PayrollExtractionResponse[] = [
      {
        payrollPeriod: '2026-06',
        rows: [{
          employeeCode: null,
          employeeName: '이주현',
          annualLeaveAllowance: 180000,
          confidence: 'medium',
          aiVerdict: 'pass',
          aiVerdictReason: null,
          sourceReference: { sheetName: '연차수당', rowHint: '22' },
        }],
        warnings: [],
      },
      {
        payrollPeriod: '2026-06',
        rows: [{
          employeeCode: 'PAY-003',
          employeeName: '이주현',
          department: '재무팀',
          baseSalary: 2700000,
          confidence: 'high',
          aiVerdict: 'pass',
          aiVerdictReason: null,
          sourceReference: { sheetName: '기초자료', rowHint: '4' },
        }],
        warnings: [],
      },
    ]

    const merged = mergePayrollExtractionResponses(responses, '2026-06')

    expect(merged.rows).toHaveLength(1)
    expect(merged.rows[0]).toMatchObject({
      employeeCode: 'PAY-003',
      employeeName: '이주현',
      department: '재무팀',
      baseSalary: 2700000,
      annualLeaveAllowance: 180000,
      aiVerdict: 'pass',
    })
  })
})

describe('extractPayrollWithClaudeInBatches', () => {
  it('fails safely before calling AI when source text exceeds the batch limit', async () => {
    const result = await extractPayrollWithClaudeInBatches(
      Array.from({ length: 7 }, (_, index) => ({
        filename: `급여-${index + 1}.xlsx`,
        text: 'x'.repeat(55000),
        summary: 'test chunk',
      })),
      '2026-06',
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('안전 제한')
      expect(result.error).toContain('파일을 나누어 다시 업로드')
    }
  })
})

describe('selectPayrollSourceTextsForPeriod', () => {
  it('keeps base and requested-period payroll change chunks while excluding unrelated sheets', () => {
    const filename = '급여관련테스트자료_0606_2021-01_급여변동_기초자료정리.xlsx'
    const largePadding = 'x'.repeat(30000)
    const fileTexts: PayrollSourceText[] = [
      {
        filename,
        sheetName: '기초자료',
        rowStart: 1,
        rowEnd: 81,
        summary: 'base',
        text: [
          `파일명: ${filename}`,
          '## 시트: 기초자료',
          '1: 개인번호 | 성명 | 직급 | 직명 | 기본급 | 통상임금',
          '2: 118809719 | 이성기 | M급 | 지점장 | 2253000 | 4938000',
        ].join('\n'),
      },
      {
        filename,
        sheetName: '초년도연차전체',
        rowStart: 1,
        rowEnd: 120,
        summary: 'annual leave',
        text: [
          `파일명: ${filename}`,
          '## 시트: 초년도연차전체',
          '1: 순번 | 사무소 | 직급 | 개인번호 | 성명 | 정산년월',
          '2: 1 | 포천농협 | 6급 | 131921175 | 김기덕 | 202007',
          largePadding,
        ].join('\n'),
      },
      {
        filename,
        sheetName: '병역사항',
        rowStart: 1,
        rowEnd: 83,
        summary: 'military',
        text: [
          `파일명: ${filename}`,
          '## 시트: 병역사항',
          '1: 사무소 | 직급 | 개인번호 | 성명 | 입대일 | 제대일',
          largePadding,
        ].join('\n'),
      },
      {
        filename,
        sheetName: '2021-01_급여변동',
        rowStart: 1,
        rowEnd: 81,
        summary: 'requested period change',
        text: [
          `파일명: ${filename}`,
          '## 시트: 2021-01_급여변동',
          '1: 급여기간 | 개인번호 | 이름 | 입퇴사기록 | 연장근로시간 | 주말근무시간 | 조퇴/지각 | 식대',
          '2: 2021-01 | 118809719 | 이성기 |  | 30 | 8 |  | 200000',
        ].join('\n'),
      },
    ]

    const selection = selectPayrollSourceTextsForPeriod(fileTexts, '2021-01')

    expect(selection.filtered).toBe(true)
    expect(selection.fileTexts.map((source) => source.sheetName)).toEqual([
      '기초자료',
      '2021-01_급여변동',
    ])
    expect(selection.warnings.join('\n')).toContain('초년도연차전체')
    expect(selection.warnings.join('\n')).toContain('병역사항')
  })

  it('does not filter a large workbook when no requested-period sheet is detectable', () => {
    const fileTexts: PayrollSourceText[] = Array.from({ length: 3 }, (_, index) => ({
      filename: '급여대장.xlsx',
      sheetName: `급여대장_${index + 1}`,
      rowStart: 1,
      rowEnd: 120,
      summary: 'generic payroll sheet',
      text: [
        '## 시트: 급여대장',
        '1: 개인번호 | 성명 | 기본급 | 식대',
        '2: PAY-001 | 한은숙 | 3200000 | 200000',
        'x'.repeat(30000),
      ].join('\n'),
    }))

    const selection = selectPayrollSourceTextsForPeriod(fileTexts, '2026-06')

    expect(selection.filtered).toBe(false)
    expect(selection.fileTexts).toHaveLength(fileTexts.length)
    expect(selection.warnings).toEqual([])
  })
})
