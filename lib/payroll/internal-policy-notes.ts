export type PayrollInternalPolicyCandidateType =
  | 'long_term_business_trip_allowance'
  | 'year_end_tax_settlement_installment'
  | 'company_organization_metadata'

export type PayrollInternalPolicyCandidate = {
  type: PayrollInternalPolicyCandidateType
  title: string
  summary: string
  evidence: string[]
  recommendedAction: string
  aiReviewRecommended: boolean
}

export type PayrollPolicyReviewWarningCandidate = PayrollInternalPolicyCandidate & {
  id: string
  sourceWarning: string
}

function compactLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function findFirstLine(lines: string[], pattern: RegExp) {
  return lines.find((line) => pattern.test(line)) ?? null
}

function findFollowingLine(lines: string[], startPattern: RegExp) {
  const index = lines.findIndex((line) => startPattern.test(line))
  if (index < 0) return null
  return lines.slice(index + 1).find((line) => compactLine(line)) ?? null
}

const PAYROLL_TABLE_HEADER_PATTERN = /User\s*ID|Employee\s*ID|Name\s*\(|Annual\s+Base|Base\s+salary|Monthly\s+Salary|OT\s+Allowance|사번|성명|기본급|월급여/i
const METADATA_LINE_PATTERN = /Company|회사|사업자|Business\s*Registration|Representative|대표자|Address|주소|Prepared\s*by|작성자|담당자|Payroll\s*Month|급여\s*기준|Pay\s*Date|급여\s*지급일|Department\s*Mapping|Department|부서|Organization|조직|Cost\s*Center|Job\s*Title|Rank|Position|직급|직책/i
const POLICY_LINE_PATTERN = /Long-term Business Trip Allowance:|Reflecting Year-End Tax Settlement Results/i

function collectMetadataLines(lines: string[]) {
  return lines
    .filter((line) => METADATA_LINE_PATTERN.test(line))
    .filter((line) => !POLICY_LINE_PATTERN.test(line))
    .filter((line) => !PAYROLL_TABLE_HEADER_PATTERN.test(line))
}

export function extractPayrollInternalPolicyCandidates(text: string): PayrollInternalPolicyCandidate[] {
  const lines = text
    .split(/\r?\n/)
    .map(compactLine)
    .filter(Boolean)
  const candidates: PayrollInternalPolicyCandidate[] = []

  const businessTripRule = findFirstLine(lines, /Long-term Business Trip Allowance:/i)
  if (businessTripRule) {
    const businessTripTarget = findFollowingLine(lines, /Long-term Business Trip Allowance:/i)
    candidates.push({
      type: 'long_term_business_trip_allowance',
      title: '장기 출장수당',
      summary: [
        '월 기본급 포함 항목의 50% 기준으로 보이는 장기 출장수당 규칙이 감지되었습니다.',
        businessTripTarget ? `대상/기간 후보: ${businessTripTarget.replace(/^i\.\s*/i, '')}` : null,
      ].filter(Boolean).join(' '),
      evidence: [businessTripRule, businessTripTarget].filter((line): line is string => Boolean(line)),
      recommendedAction: '직원 ID 매칭, 대상 월, 월할/일할 적용 기준을 확인한 뒤 국내출장수당에 반영하세요.',
      aiReviewRecommended: true,
    })
  }

  const yearEndRule = findFirstLine(lines, /Reflecting Year-End Tax Settlement Results/i)
  if (yearEndRule) {
    const yearEndTarget = findFollowingLine(lines, /Reflecting Year-End Tax Settlement Results/i)
    candidates.push({
      type: 'year_end_tax_settlement_installment',
      title: '연말정산 분할납부',
      summary: [
        '연말정산 결과를 3개월 분할 처리하는 규칙이 감지되었습니다.',
        yearEndTarget ? `대상 후보: ${yearEndTarget}` : null,
      ].filter(Boolean).join(' '),
      evidence: [yearEndRule, yearEndTarget].filter((line): line is string => Boolean(line)),
      recommendedAction: '수당이 아닌 세액 정산/공제 항목으로 분리해 확인하세요.',
      aiReviewRecommended: true,
    })
  }

  const metadataLines = collectMetadataLines(lines)
  if (metadataLines.length > 0) {
    candidates.push({
      type: 'company_organization_metadata',
      title: '회사/조직 메타정보',
      summary: `회사명·부서·직급·작성 기준처럼 보이는 참조 정보 ${metadataLines.length}건이 감지되었습니다.`,
      evidence: metadataLines.slice(0, 5),
      recommendedAction: '급여 금액에 직접 반영하지 말고 직원 매칭, 부서 검토, 급여 기준월 확인에 필요한 참고 메모로 보존하세요.',
      aiReviewRecommended: false,
    })
  }

  return candidates
}

export function formatPayrollInternalPolicyWarning(candidate: PayrollInternalPolicyCandidate) {
  const prefix = candidate.type === 'company_organization_metadata' ? '메타정보 감지' : '사내 규정 감지'

  return [
    `${prefix}: ${candidate.title}.`,
    candidate.summary,
    candidate.recommendedAction,
    candidate.aiReviewRecommended ? '판단이 불확실하면 AI 정책 검토 후보로 분리해야 합니다.' : null,
  ].filter(Boolean).join(' ')
}

const POLICY_WARNING_TYPE_BY_TITLE: Array<{
  type: PayrollInternalPolicyCandidateType
  title: string
  pattern: RegExp
}> = [
  {
    type: 'long_term_business_trip_allowance',
    title: '장기 출장수당',
    pattern: /장기\s*출장수당|출장\s*수당/i,
  },
  {
    type: 'year_end_tax_settlement_installment',
    title: '연말정산 분할납부',
    pattern: /연말정산\s*분할납부|세액\s*정산|소급\/?기타\s*수당/i,
  },
]

export function collectPayrollPolicyReviewCandidatesFromWarnings(
  warnings: string[],
): PayrollPolicyReviewWarningCandidate[] {
  const candidates: PayrollPolicyReviewWarningCandidate[] = []

  for (const warning of warnings) {
    if (!warning.includes('사내 규정 감지')) continue
    if (!warning.includes('AI 정책 검토 후보')) continue

    const matched = POLICY_WARNING_TYPE_BY_TITLE.find((item) => item.pattern.test(warning))
    if (!matched) continue

    candidates.push({
      id: `payroll-policy:${matched.type}:${candidates.length + 1}`,
      type: matched.type,
      title: matched.title,
      summary: warning,
      evidence: [warning],
      recommendedAction: 'AI 정책 검토 결과를 참고해 담당자가 반영 여부와 대상 금액을 확인하세요.',
      aiReviewRecommended: true,
      sourceWarning: warning,
    })
  }

  return candidates
}
