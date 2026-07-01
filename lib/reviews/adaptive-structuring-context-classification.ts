import { parseAnalysisOutput, representativeRunForFile } from '@/lib/reviews/review-file-classification'
import type { ReviewAnalysisRun, ReviewFile } from '@/lib/reviews/review-workspace-types'

export type ReviewAdaptiveContextSignal = 'metadata_reference' | 'company_policy' | 'result_only'

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}

const METADATA_REFERENCE_PATTERN = /(회사\s*정보|조직\s*정보|담당자\s*정보|회사\s*소개|조직도|작성자\s*안내|메타\s*정보|company profile|company information)/i
const COMPANY_POLICY_PATTERN = /(사내\s*규정|사내\s*규칙|회사\s*정책|운영\s*방침|지급\s*기준\s*안내|규정\s*안내|company policy|internal rule)/i
const RESULT_ONLY_PATTERN = /(결과\s*요약|집계\s*결과|최종\s*결과|이미\s*계산된|검증용\s*자료|합계\s*표|월계\s*표|result summary|already calculated)/i

// payroll의 hasPolicyOrMetadataOnlyContext/hasPayrollMaterialMismatch에 대응한다.
// classifyReviewFile은 "요청자료에 연결되는가"만 판단하고 메타정보/정책/결과성 자료를
// 구분하지 않으므로, 구조화 제안 후보를 추리기 전에 이 신호로 한 번 더 걸러낸다.
// AI가 읽은 내용(detected_file_type/explanation/staff_unlinked_reason)만 사용하고
// 파일명은 사용하지 않는다.
export function detectReviewAdaptiveContextSignal(
  file: ReviewFile,
  analysisRuns: ReviewAnalysisRun[],
): ReviewAdaptiveContextSignal | null {
  const run = representativeRunForFile(file, analysisRuns)
  const parsed = parseAnalysisOutput(run)
  if (!parsed) return null

  const source = normalizeText([
    parsed.detected_file_type,
    parsed.explanation,
    parsed.staff_unlinked_reason,
    parsed.risk_flags?.join(' '),
  ].join('\n'))
  if (!source) return null

  if (METADATA_REFERENCE_PATTERN.test(source)) return 'metadata_reference'
  if (COMPANY_POLICY_PATTERN.test(source)) return 'company_policy'
  if (RESULT_ONLY_PATTERN.test(source)) return 'result_only'
  return null
}

export const REVIEW_ADAPTIVE_CONTEXT_SIGNAL_LABEL: Record<ReviewAdaptiveContextSignal, string> = {
  metadata_reference: '메타정보',
  company_policy: '사내 규정/정책',
  result_only: '결과 요약자료',
}

export function describeReviewAdaptiveContextSignal(signal: ReviewAdaptiveContextSignal): string {
  return `${REVIEW_ADAPTIVE_CONTEXT_SIGNAL_LABEL[signal]}로 보여 구조화 제안 대상에서 제외했습니다.`
}
