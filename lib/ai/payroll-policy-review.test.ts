import { describe, expect, it, vi } from 'vitest'
import {
  normalizePayrollPolicyReviewResponse,
  parsePayrollPolicyReviewOutput,
  reviewPayrollPolicyCandidatesWithProviderFallback,
  sanitizePayrollPolicyReviewStaffCopy,
  type PayrollPolicyReviewRunner,
} from './payroll-policy-review'
import type { PayrollPolicyReviewWarningCandidate } from '@/lib/payroll/internal-policy-notes'

const candidate: PayrollPolicyReviewWarningCandidate = {
  id: 'candidate-1',
  type: 'long_term_business_trip_allowance',
  title: '장기 출장수당',
  summary: '사내 규정 감지: 장기 출장수당. 대상자와 기간 확인이 필요합니다.',
  evidence: ['Long-term Business Trip Allowance: 50% of monthly Base Salary'],
  recommendedAction: '대상자와 기간을 확인하세요.',
  aiReviewRecommended: true,
  sourceWarning: '사내 규정 감지: 장기 출장수당.',
}

const answered = {
  candidateType: 'long_term_business_trip_allowance' as const,
  classification: 'company_policy' as const,
  summaryForStaff: '장기 출장수당 규칙으로 보입니다.',
  possiblePayrollImpact: '국내출장수당 또는 기타 수당에 영향을 줄 수 있습니다.',
  missingInformation: ['대상자', '출장 기간', '계산 기준'],
  recommendedAction: '대상자와 기간을 확인한 뒤 담당자가 수당 반영 여부를 결정하세요.',
  canAutoApply: false,
  confidence: 'medium' as const,
  sourceEvidenceUsed: ['Long-term Business Trip Allowance: 50% of monthly Base Salary'],
  warnings: [],
}

describe('payroll policy review', () => {
  it('falls back through providers using payroll AI provider order', async () => {
    const runner = vi.fn<PayrollPolicyReviewRunner>(async ({ provider }) => {
      if (provider === 'gemini') {
        return { success: false, provider, error: 'Gemini unavailable' }
      }
      return { success: true, provider, data: answered }
    })

    const result = await reviewPayrollPolicyCandidatesWithProviderFallback(
      [candidate],
      '2026-06',
      { providers: ['gemini', 'openai', 'claude'], runner },
    )

    expect(runner).toHaveBeenCalledTimes(2)
    expect(runner.mock.calls.map(([input]) => input.provider)).toEqual(['gemini', 'openai'])
    expect(result.reviews[0]).toMatchObject({
      provider: 'openai',
      candidateTitle: '장기 출장수당',
    })
    expect(result.warnings).toEqual([
      [
        '사내 규칙 1건은 자동 반영하지 않았습니다.',
        '',
        '- 장기 출장수당: 대상 직원, 출장 기간, 계산 기준이 부족해 반영하지 않았습니다.',
      ].join('\n'),
    ])
  })

  it('does not call providers for non-recommended metadata candidates', async () => {
    const runner = vi.fn<PayrollPolicyReviewRunner>()
    const result = await reviewPayrollPolicyCandidatesWithProviderFallback(
      [{ ...candidate, type: 'company_organization_metadata', title: '회사/조직 메타정보', aiReviewRecommended: false }],
      '2026-06',
      { providers: ['gemini'], runner },
    )

    expect(runner).not.toHaveBeenCalled()
    expect(result).toEqual({ reviews: [], warnings: [] })
  })

  it('normalizes model auto-apply claims back to staff-only guidance', () => {
    const normalized = normalizePayrollPolicyReviewResponse({
      ...answered,
      canAutoApply: true,
    })

    expect(normalized.canAutoApply).toBe(false)
    expect(normalized.warnings.join('\n')).toContain('자동 반영 가능하다고 응답했지만')
  })

  it('parses JSON responses through the schema', () => {
    const result = parsePayrollPolicyReviewOutput(JSON.stringify(answered))

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.summaryForStaff).toBe('장기 출장수당 규칙으로 보입니다.')
    }
  })

  it('removes internal payroll field names from staff-facing review copy', async () => {
    const sanitized = sanitizePayrollPolicyReviewStaffCopy('domesticTravelAllowance와 retroactivePay 확인이 필요합니다.')
    expect(sanitized).toContain('국내출장수당')
    expect(sanitized).toContain('소급 지급 항목')
    expect(sanitized).not.toContain('domesticTravelAllowance')
    expect(sanitized).not.toContain('retroactivePay')

    const runner = vi.fn<PayrollPolicyReviewRunner>(async ({ provider }) => ({
      success: true,
      provider,
      data: {
        ...answered,
        summaryForStaff: 'domesticTravelAllowance 규칙으로 보입니다.',
        possiblePayrollImpact: 'retroactivePay 또는 otherAllowance에 영향을 줄 수 있습니다.',
        missingInformation: ['employeeCode', 'baseSalary'],
        recommendedAction: 'employeeName 기준으로 deductionAmount 적용 여부를 확인하세요.',
      },
    }))

    const result = await reviewPayrollPolicyCandidatesWithProviderFallback(
      [candidate],
      '2026-06',
      { providers: ['openai'], runner },
    )

    const message = result.warnings.join('\n')
    expect(message).toContain('사내 규칙 1건은 자동 반영하지 않았습니다.')
    expect(message).toContain('대상 직원, 출장 기간, 계산 기준이 부족해 반영하지 않았습니다.')
    expect(message).not.toContain('domesticTravelAllowance')
    expect(message).not.toContain('retroactivePay')
    expect(message).not.toContain('employeeCode')
  })

  it('groups multiple policy findings into one concise staff warning', async () => {
    const yearEndCandidate: PayrollPolicyReviewWarningCandidate = {
      ...candidate,
      id: 'candidate-2',
      type: 'year_end_tax_settlement_installment',
      title: '연말정산 분할납부',
      summary: '사내 규정 감지: 연말정산 분할납부.',
    }
    const runner = vi.fn<PayrollPolicyReviewRunner>(async ({ provider, candidate: inputCandidate }) => ({
      success: true,
      provider,
      data: {
        ...answered,
        candidateType: inputCandidate.type,
        missingInformation: ['대상자', '금액'],
      },
    }))

    const result = await reviewPayrollPolicyCandidatesWithProviderFallback(
      [candidate, yearEndCandidate],
      '2026-06',
      { providers: ['openai'], runner },
    )

    expect(result.warnings).toEqual([
      [
        '사내 규칙 2건은 자동 반영하지 않았습니다.',
        '',
        '- 장기 출장수당: 대상 직원, 출장 기간, 계산 기준이 부족해 반영하지 않았습니다.',
        '- 연말정산 분할납부: 직원별 정산액과 월별 분할 금액이 부족해 반영하지 않았습니다.',
      ].join('\n'),
    ])
  })
})
