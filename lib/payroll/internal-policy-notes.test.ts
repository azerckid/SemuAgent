import { describe, expect, it } from 'vitest'
import {
  collectPayrollPolicyReviewCandidatesFromWarnings,
  extractPayrollInternalPolicyCandidates,
  formatPayrollInternalPolicyWarning,
} from './internal-policy-notes'

describe('payroll internal policy notes', () => {
  it('extracts business-trip allowance and year-end settlement policies from memo text', () => {
    const candidates = extractPayrollInternalPolicyCandidates([
      'B. Long-term Business Trip Allowance: 50% of monthly Base Salary incl. (Fixed OT allowance, Car allowance, Childcare Allowance)',
      'i. Kim : Travel to US (Apr 1, 2026 - July 10, 2026)',
      'A. Reflecting Year-End Tax Settlement Results',
      'Kim (김OO), An (안OO), and Shin (신OO) — Payable in Three Monthly Installments',
    ].join('\n'))

    expect(candidates).toHaveLength(2)
    expect(candidates[0]).toMatchObject({
      type: 'long_term_business_trip_allowance',
      title: '장기 출장수당',
      aiReviewRecommended: true,
    })
    expect(candidates[0]?.summary).toContain('50%')
    expect(candidates[0]?.summary).toContain('Kim')
    expect(candidates[1]).toMatchObject({
      type: 'year_end_tax_settlement_installment',
      title: '연말정산 분할납부',
      aiReviewRecommended: true,
    })
    expect(candidates[1]?.recommendedAction).toContain('세액 정산/공제')
  })

  it('formats policy warnings without internal extraction field names', () => {
    const [candidate] = extractPayrollInternalPolicyCandidates(
      'B. Long-term Business Trip Allowance: 50% of monthly Base Salary incl. (Fixed OT allowance, Car allowance, Childcare Allowance)\n'
      + 'i. Kim : Travel to US (Apr 1, 2026 - July 10, 2026)',
    )

    const warning = formatPayrollInternalPolicyWarning(candidate!)

    expect(warning).toContain('사내 규정 감지: 장기 출장수당')
    expect(warning).toContain('월할/일할 적용 기준')
    expect(warning).not.toContain('domesticTravelAllowance')
    expect(warning).not.toContain('User ID')
  })

  it('extracts company and organization metadata as non-calculation context', () => {
    const candidates = extractPayrollInternalPolicyCandidates([
      'Company: SampleC Korea',
      'Department Mapping: Sales / R&D / Executive',
      'Prepared by HR Team',
    ].join('\n'))

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      type: 'company_organization_metadata',
      title: '회사/조직 메타정보',
      aiReviewRecommended: false,
    })

    const warning = formatPayrollInternalPolicyWarning(candidates[0]!)
    expect(warning).toContain('메타정보 감지: 회사/조직 메타정보')
    expect(warning).toContain('급여 금액에 직접 반영하지 말고')
  })

  it('does not treat ordinary payroll table headers as metadata notes', () => {
    const candidates = extractPayrollInternalPolicyCandidates(
      'User ID Name (Kor) Department Job Title/Rank Annual Base Salary Monthly Salary OT Allowance',
    )

    expect(candidates).toEqual([])
  })

  it('collects AI review candidates from formatted policy warnings only', () => {
    const policyWarnings = extractPayrollInternalPolicyCandidates([
      'Long-term Business Trip Allowance:',
      'i. User ID 1001 is seconded overseas during June.',
      'Reflecting Year-End Tax Settlement Results',
      'User ID 1002 has installment tax settlement.',
      'Company Name: Demo Corp',
    ].join('\n')).map(formatPayrollInternalPolicyWarning)

    const candidates = collectPayrollPolicyReviewCandidatesFromWarnings(policyWarnings)

    expect(candidates).toHaveLength(2)
    expect(candidates.map((candidate) => candidate.type)).toEqual([
      'long_term_business_trip_allowance',
      'year_end_tax_settlement_installment',
    ])
    expect(candidates.every((candidate) => candidate.aiReviewRecommended)).toBe(true)
    expect(candidates.map((candidate) => candidate.title)).not.toContain('회사/조직 메타정보')
  })
})
