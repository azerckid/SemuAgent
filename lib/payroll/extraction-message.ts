const DISPLAY_MAX_CHARS = 900

type BuildPayrollExtractionBatchMessageInput = {
  rowCount: number
  warnings: string[]
  payrollPeriod: string
}

function extractPayrollPeriod(message: string): string | null {
  const match = message.match(/급여 기간[ (]*(\d{4}-\d{2})/)
  return match?.[1] ?? null
}

function hasTechnicalSchemaNoise(message: string): boolean {
  return message.includes('응답 스키마 검증 실패')
    || message.includes('Invalid input: expected array')
    || message.includes('"expected"')
    || message.includes('"code"')
}

export function hasPeriodMismatch(message: string): boolean {
  if (
    message.includes('급여 기간') && (
      message.includes('일치하는 행이 없어')
      || message.includes('일치하지 않아')
      || message.includes('존재하지 않습니다')
    )
  ) {
    return true
  }

  // formatPayrollNoRowsBlockerMessage/formatPayrollExtractionMessageForDisplay가
  // batch.errorMessage로 저장하는 두 가지 기간 불일치 출력 문구도 동일하게 인식한다.
  // ("급여 지급 데이터" 문구를 공유해 hasPayrollMaterialMismatch와 겹치므로 먼저 걸러내야 한다.)
  return message.includes('급여 기간')
    && (message.includes('에 해당하는') || message.includes('에 맞는'))
    && message.includes('확인되지 않았습니다')
}

export function hasPayrollMaterialMismatch(message: string): boolean {
  return message.includes('급여 지급 항목이 없습니다')
    || message.includes('급여 지급 정보')
    || message.includes('급여 지급 데이터')
}

export function hasPolicyOrMetadataOnlyContext(message: string): boolean {
  return message.includes('사내 규정 감지')
    || message.includes('메타정보 감지')
    || message.includes('사내 규칙')
    || message.includes('회사/조직 메타정보')
    || message.includes('회사 안내문')
    || message.includes('참고 메모')
}

function collectPayrollReviewItems(message: string): string[] {
  const items = new Set<string>()

  if (
    message.includes('domesticTravelAllowance')
    || message.includes('장기 출장 수당')
    || /출장\s*수당/.test(message)
  ) {
    items.add('출장수당')
  }

  if (
    message.includes('retroactive/other')
    || message.includes('retroactivePay')
    || message.includes('연말정산 분할납부')
    || message.includes('Year-End Tax Settlement')
  ) {
    items.add('연말정산 분할납부')
    items.add('소급/기타 수당')
  }

  if (message.includes('메타정보 감지')) {
    items.add('회사/조직 메타정보')
  }

  return [...items]
}

function formatPayrollReviewItemsMessage(items: string[]): string {
  if (items.includes('출장수당') && items.includes('연말정산 분할납부')) {
    const message = [
      '장기 출장수당과 연말정산 분할납부 규칙이 감지되었습니다.',
      '출장수당은 대상자·기간·계산 기준 확인 후 반영이 필요하며, 연말정산 분할납부는 수당이 아닌 세액 정산 항목으로 별도 확인이 필요합니다.',
    ]
    if (items.includes('회사/조직 메타정보')) {
      message.push('회사/조직 메타정보는 계산 row에서 제외하고 참고 메모로 보존합니다.')
    }
    return message.join('\n')
  }

  if (items.length === 1 && items[0] === '회사/조직 메타정보') {
    return [
      '회사/조직 메타정보가 감지되었습니다.',
      '급여 계산에는 직접 반영하지 않고 직원 매칭·부서 검토용 참고 메모로 보존합니다.',
    ].join('\n')
  }

  return [
    `${items.join(', ')} 항목이 감지되었습니다.`,
    '누구에게 얼마를 반영해야 하는지 정보가 부족해 담당자 확인이 필요합니다.',
  ].join('\n')
}

function collectPayrollPolicyReviewLines(message: string): string[] {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('AI 정책 검토'))
}

function isPayrollExtractionSuccessBoilerplate(line: string): boolean {
  return line === '기초자료/근태·변동자료를 구조화해 급여대장 초안 지급 항목을 계산했습니다.'
    || line === 'SampleC Master/Movement/Payroll/Input(Overtime Mar·Apr) 시트를 User ID 기준으로 구조 추출했습니다.'
    || line === 'SampleC Master/Movement/Input 시트를 User ID 기준으로 구조 추출했습니다.'
    || line === '세금/공제 기준자료 일부를 인식해 계산 가능한 공제 항목만 반영하고 부족 항목은 자료없음으로 처리했습니다.'
    || line === '세금/공제 기준자료가 없어 공제금액은 자료없음(null)으로 처리했습니다.'
    || line === '회사별 계산규칙이 명시되지 않은 항목은 기본 법정규칙을 적용했으며 담당자 확인이 필요합니다.'
    || line === '이미 계산된 변동수당/공제전합계/결과성 시트 금액은 최종값으로 사용하지 않고 검증용으로만 취급했습니다.'
}

function stripPayrollExtractionSuccessBoilerplate(message: string): string {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isPayrollExtractionSuccessBoilerplate(line))
    .join('\n')
}

function extractPayrollPolicyReviewSummary(message: string): string | null {
  const lines = message.split(/\r?\n/).map((line) => line.trimEnd())
  const startIndex = lines.findIndex((line) => (
    line.startsWith('사내 규칙') && line.includes('자동 반영하지 않았습니다')
  ))
  if (startIndex < 0) return null

  const summaryLines = [lines[startIndex]!]
  for (const line of lines.slice(startIndex + 1)) {
    const trimmed = line.trim()
    if (!trimmed) {
      summaryLines.push('')
      continue
    }
    if (trimmed.startsWith('- ')) {
      summaryLines.push(trimmed)
      continue
    }
    break
  }

  return truncateMessage(summaryLines.join('\n').trimEnd())
}

function truncateMessage(message: string): string {
  if (message.length <= DISPLAY_MAX_CHARS) return message
  return [
    message.slice(0, DISPLAY_MAX_CHARS).trimEnd(),
    '',
    '상세 추출 로그가 길어 화면 표시를 줄였습니다. 원자료 기간과 급여 지급 항목을 확인한 뒤 다시 추출해 주세요.',
  ].join('\n')
}

function formatPayrollNoRowsBlockerMessage(params: {
  payrollPeriod: string
  warnings: string[]
}): string {
  const warningText = params.warnings.join('\n')

  if (hasPolicyOrMetadataOnlyContext(warningText)) {
    return [
      '추출 불가: 업로드 파일에 회사/조직 정보 또는 사내 규칙 메모는 있지만, 직원별 급여 지급액이 확인되지 않았습니다.',
      `요청 급여 기간(${params.payrollPeriod})의 직원별 급여 지급대장 또는 급여명세서 자료를 다시 업로드해 주세요.`,
    ].join('\n')
  }

  if (hasPeriodMismatch(warningText)) {
    return [
      `추출 불가: 요청 급여 기간(${params.payrollPeriod})에 해당하는 직원별 급여 지급 데이터가 확인되지 않았습니다.`,
      '해당 기간의 급여 지급대장 또는 급여명세서 자료를 다시 업로드해 주세요.',
    ].join('\n')
  }

  if (hasPayrollMaterialMismatch(warningText)) {
    return [
      '추출 불가: 업로드 파일에서 직원별 급여 지급 항목을 확인하지 못했습니다.',
      `요청 급여 기간(${params.payrollPeriod})의 직원별 급여 지급대장 또는 급여명세서 자료를 다시 업로드해 주세요.`,
    ].join('\n')
  }

  return [
    '추출 불가: 직원별 급여 지급 데이터가 확인되지 않았습니다.',
    `요청 급여 기간(${params.payrollPeriod})의 급여 지급대장 또는 급여명세서 자료를 다시 업로드해 주세요.`,
  ].join('\n')
}

export function formatPayrollExtractionMessageForDisplay(message: string | null | undefined): string | null {
  if (!message?.trim()) return null

  const normalized = message.trim()
  const period = extractPayrollPeriod(normalized)
  const policyReviewSummary = extractPayrollPolicyReviewSummary(normalized)
  if (policyReviewSummary) return policyReviewSummary

  const policyReviewLines = collectPayrollPolicyReviewLines(normalized)
  if (policyReviewLines.length > 0) return truncateMessage(policyReviewLines.slice(0, 3).join('\n'))

  const reviewItems = collectPayrollReviewItems(normalized)
  if (reviewItems.length > 0) return formatPayrollReviewItemsMessage(reviewItems)

  const shouldSummarize = hasTechnicalSchemaNoise(normalized) || normalized.length > DISPLAY_MAX_CHARS

  if (!shouldSummarize) return normalized

  if (normalized.includes('추출된 직원 데이터가 없습니다')) {
    return formatPayrollNoRowsBlockerMessage({
      payrollPeriod: period ?? '요청 기간',
      warnings: [normalized],
    })
  }

  const lines = [
    normalized.includes('추출된 직원 데이터가 없습니다')
      ? '추출된 직원 데이터가 없습니다.'
      : '급여 추출 결과를 확정하지 못했습니다.',
  ]

  if (hasPeriodMismatch(normalized)) {
    lines.push(`요청 급여 기간${period ? `(${period})` : ''}에 맞는 직원 급여 지급 데이터가 원자료에서 확인되지 않았습니다.`)
  }

  if (hasPayrollMaterialMismatch(normalized)) {
    lines.push('일부 sheet 또는 묶음은 급여 지급 항목이 아니거나 분석 대상 기간과 맞지 않아 제외되었습니다.')
  }

  lines.push('해당 기간의 급여명세서, 지급대장 등 급여 지급 자료를 추가하거나 요청 기간을 확인한 뒤 다시 추출해 주세요.')
  lines.push('상세 추출 로그는 서버 기록에 보관됩니다.')

  return lines.join('\n')
}

export function formatPayrollExtractionReviewNoticeForDisplay(message: string | null | undefined): string | null {
  if (!message?.trim()) return null

  const normalized = message.trim()

  if (
    normalized.startsWith('추출 불가:')
    || normalized.includes('추출된 직원 데이터가 없습니다')
    || hasTechnicalSchemaNoise(normalized)
  ) {
    return formatPayrollExtractionMessageForDisplay(normalized)
  }

  const actionable = stripPayrollExtractionSuccessBoilerplate(normalized)
  if (!actionable) return null

  return formatPayrollExtractionMessageForDisplay(actionable)
}

export function buildPayrollExtractionBatchMessage({
  rowCount,
  warnings,
  payrollPeriod,
}: BuildPayrollExtractionBatchMessageInput): string | null {
  if (rowCount === 0) {
    return formatPayrollNoRowsBlockerMessage({ payrollPeriod, warnings })
  }

  if (warnings.length === 0) return null

  return truncateMessage(warnings.slice(0, 3).join('\n'))
}
