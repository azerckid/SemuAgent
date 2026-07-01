import { describe, expect, it } from 'vitest'
import {
  buildPayrollExtractionBatchMessage,
  formatPayrollExtractionMessageForDisplay,
  formatPayrollExtractionReviewNoticeForDisplay,
} from './extraction-message'

describe('formatPayrollExtractionMessageForDisplay', () => {
  it('summarizes technical payroll extraction schema errors for staff UI', () => {
    const message = [
      '추출된 직원 데이터가 없습니다',
      '급여 원자료가 길어 3개 묶음으로 나누어 추출했습니다.',
      '묶음 1/3 추출 실패: 응답 스키마 검증 실패: [{"expected":"array","code":"invalid_type","path":["rows"],"message":"Invalid input: expected array, received undefined"}]',
      'chunk 5/13 (시트: 초년도연차전체, 행 121-240): 모든 데이터의 정산년월이 202007~202103 범위이며, 급여 기간 2026-06과 일치하는 행이 없어 전체 제외합니다. 포함 직원: 홍길동(123456), 김자료(789012)',
      'chunk 13/13 (시트: 중당액): 2021년도 연차수당충당부채 자료로 급여 지급 데이터가 존재하지 않습니다.',
    ].join('\n')

    const displayMessage = formatPayrollExtractionMessageForDisplay(message)

    expect(displayMessage).toContain('추출 불가: 요청 급여 기간(2026-06)에 해당하는 직원별 급여 지급 데이터가 확인되지 않았습니다.')
    expect(displayMessage).toContain('해당 기간의 급여 지급대장 또는 급여명세서 자료를 다시 업로드해 주세요.')
    expect(displayMessage).not.toContain('Invalid input')
    expect(displayMessage).not.toContain('"expected"')
    expect(displayMessage).not.toContain('홍길동')
  })

  it('keeps short business messages intact', () => {
    const message = '파일을 확인한 뒤 다시 추출해 주세요.'

    expect(formatPayrollExtractionMessageForDisplay(message)).toBe(message)
  })

  it('summarizes SampleC allowance review notes without internal sheet and column names', () => {
    const message = [
      'SampleC Master/Movement/Input 시트를 User ID 기준으로 구조 추출했습니다.',
      '사내 규정 감지: 장기 출장수당. 월 기본급 포함 항목의 50% 기준으로 보이는 장기 출장수당 규칙이 감지되었습니다. 대상/기간 후보: Kim : Travel to US (Apr 1, 2026 - July 10, 2026). 직원 ID 매칭, 대상 월, 월할/일할 적용 기준을 확인한 뒤 국내출장수당에 반영하세요.',
      '사내 규정 감지: 연말정산 분할납부. 연말정산 결과를 3개월 분할 처리하는 규칙이 감지되었습니다. 대상 후보: Kim, An, Shin. 수당이 아닌 세액 정산/공제 항목으로 분리해 확인하세요.',
    ].join('\n')

    const displayMessage = formatPayrollExtractionMessageForDisplay(message)

    expect(displayMessage).toBe([
      '장기 출장수당과 연말정산 분할납부 규칙이 감지되었습니다.',
      '출장수당은 대상자·기간·계산 기준 확인 후 반영이 필요하며, 연말정산 분할납부는 수당이 아닌 세액 정산 항목으로 별도 확인이 필요합니다.',
    ].join('\n'))
    expect(displayMessage).not.toContain('SampleC')
    expect(displayMessage).not.toContain('User ID')
    expect(displayMessage).not.toContain('domesticTravelAllowance')
    expect(displayMessage).not.toContain('retroactive/other')
  })

  it('summarizes metadata notes as reference context', () => {
    const message = [
      'SampleC Master/Movement/Input 시트를 User ID 기준으로 구조 추출했습니다.',
      '메타정보 감지: 회사/조직 메타정보. 회사명·부서·직급·작성 기준처럼 보이는 참조 정보 3건이 감지되었습니다. 급여 금액에 직접 반영하지 말고 직원 매칭, 부서 검토, 급여 기준월 확인에 필요한 참고 메모로 보존하세요.',
    ].join('\n')

    expect(formatPayrollExtractionMessageForDisplay(message)).toBe([
      '회사/조직 메타정보가 감지되었습니다.',
      '급여 계산에는 직접 반영하지 않고 직원 매칭·부서 검토용 참고 메모로 보존합니다.',
    ].join('\n'))
  })

  it('keeps metadata as an extra note when policy warnings are present', () => {
    const message = [
      '사내 규정 감지: 장기 출장수당. 월 기본급 포함 항목의 50% 기준으로 보이는 장기 출장수당 규칙이 감지되었습니다.',
      '사내 규정 감지: 연말정산 분할납부. 연말정산 결과를 3개월 분할 처리하는 규칙이 감지되었습니다.',
      '메타정보 감지: 회사/조직 메타정보. 회사명·부서·직급·작성 기준처럼 보이는 참조 정보 2건이 감지되었습니다.',
    ].join('\n')

    expect(formatPayrollExtractionMessageForDisplay(message)).toBe([
      '장기 출장수당과 연말정산 분할납부 규칙이 감지되었습니다.',
      '출장수당은 대상자·기간·계산 기준 확인 후 반영이 필요하며, 연말정산 분할납부는 수당이 아닌 세액 정산 항목으로 별도 확인이 필요합니다.',
      '회사/조직 메타정보는 계산 row에서 제외하고 참고 메모로 보존합니다.',
    ].join('\n'))
  })

  it('prioritizes AI policy review results over generic policy detection summaries', () => {
    const message = [
      'AI 정책 검토(OpenAI): 장기 출장수당. 장기 출장수당 규칙으로 보입니다. 국내출장수당에 영향을 줄 수 있습니다. 부족 정보: 대상자, 기간. 대상자와 기간을 확인하세요. 자동 반영하지 않았습니다.',
      '사내 규정 감지: 장기 출장수당. 월 기본급 포함 항목의 50% 기준으로 보이는 장기 출장수당 규칙이 감지되었습니다.',
    ].join('\n')

    const displayMessage = formatPayrollExtractionMessageForDisplay(message)

    expect(displayMessage).toContain('AI 정책 검토(OpenAI): 장기 출장수당')
    expect(displayMessage).toContain('자동 반영하지 않았습니다')
    expect(displayMessage).not.toContain('출장수당은 대상자·기간·계산 기준 확인 후')
  })

  it('keeps concise internal policy review summaries over generic detection text', () => {
    const message = [
      '사내 규칙 2건은 자동 반영하지 않았습니다.',
      '',
      '- 장기 출장수당: 대상 직원, 출장 기간, 계산 기준이 부족해 반영하지 않았습니다.',
      '- 연말정산 분할납부: 직원별 정산액과 월별 분할 금액이 부족해 반영하지 않았습니다.',
      '사내 규정 감지: 장기 출장수당. 월 기본급 포함 항목의 50% 기준으로 보이는 장기 출장수당 규칙이 감지되었습니다.',
    ].join('\n')

    const displayMessage = formatPayrollExtractionMessageForDisplay(message)

    expect(displayMessage).toBe([
      '사내 규칙 2건은 자동 반영하지 않았습니다.',
      '',
      '- 장기 출장수당: 대상 직원, 출장 기간, 계산 기준이 부족해 반영하지 않았습니다.',
      '- 연말정산 분할납부: 직원별 정산액과 월별 분할 금액이 부족해 반영하지 않았습니다.',
    ].join('\n'))
    expect(displayMessage).not.toContain('월 기본급 포함 항목의 50%')
  })
})

describe('formatPayrollExtractionReviewNoticeForDisplay', () => {
  it('hides structured extraction success boilerplate from the payroll result panel', () => {
    const message = [
      '기초자료/근태·변동자료를 구조화해 급여대장 초안 지급 항목을 계산했습니다.',
      '세금/공제 기준자료 일부를 인식해 계산 가능한 공제 항목만 반영하고 부족 항목은 자료없음으로 처리했습니다.',
      '회사별 계산규칙이 명시되지 않은 항목은 기본 법정규칙을 적용했으며 담당자 확인이 필요합니다.',
      '이미 계산된 변동수당/공제전합계/결과성 시트 금액은 최종값으로 사용하지 않고 검증용으로만 취급했습니다.',
    ].join('\n')

    expect(formatPayrollExtractionReviewNoticeForDisplay(message)).toBeNull()
  })

  it('keeps concise policy notes after removing success boilerplate', () => {
    const message = [
      'SampleC Master/Movement/Payroll/Input(Overtime Mar·Apr) 시트를 User ID 기준으로 구조 추출했습니다.',
      '사내 규칙 2건은 자동 반영하지 않았습니다.',
      '',
      '- 장기 출장수당: 대상 직원, 출장 기간, 계산 기준이 부족해 반영하지 않았습니다.',
      '- 연말정산 분할납부: 직원별 정산액과 월별 분할 금액이 부족해 반영하지 않았습니다.',
      '회사별 계산규칙이 명시되지 않은 항목은 기본 법정규칙을 적용했으며 담당자 확인이 필요합니다.',
    ].join('\n')

    expect(formatPayrollExtractionReviewNoticeForDisplay(message)).toBe([
      '사내 규칙 2건은 자동 반영하지 않았습니다.',
      '- 장기 출장수당: 대상 직원, 출장 기간, 계산 기준이 부족해 반영하지 않았습니다.',
      '- 연말정산 분할납부: 직원별 정산액과 월별 분할 금액이 부족해 반영하지 않았습니다.',
    ].join('\n'))
  })

  it('keeps extraction blocker messages visible', () => {
    const message = [
      '추출 불가: 업로드 파일에서 직원별 급여 지급 항목을 확인하지 못했습니다.',
      '요청 급여 기간(2026-05)의 직원별 급여 지급대장 또는 급여명세서 자료를 다시 업로드해 주세요.',
    ].join('\n')

    expect(formatPayrollExtractionReviewNoticeForDisplay(message)).toBe(message)
  })
})

describe('buildPayrollExtractionBatchMessage', () => {
  it('stores a concise no-row failure message instead of all chunk warnings', () => {
    const message = buildPayrollExtractionBatchMessage({
      rowCount: 0,
      payrollPeriod: '2026-06',
      warnings: [
        'chunk 1/2: 급여 기간 2026-06과 일치하는 행이 없어 전체 제외합니다.',
        'chunk 2/2: 급여 지급 항목이 없습니다.',
      ],
    })

    expect(message).toContain('추출 불가: 요청 급여 기간(2026-06)에 해당하는 직원별 급여 지급 데이터가 확인되지 않았습니다.')
    expect(message).toContain('해당 기간의 급여 지급대장 또는 급여명세서 자료를 다시 업로드해 주세요.')
    expect(message).not.toContain('chunk 1/2')
  })

  it('blocks result generation with a clear reason when only policy or metadata notes exist', () => {
    const message = buildPayrollExtractionBatchMessage({
      rowCount: 0,
      payrollPeriod: '2026-05',
      warnings: [
        '메타정보 감지: 회사/조직 메타정보. 회사명·부서·직급·작성 기준처럼 보이는 참조 정보 3건이 감지되었습니다.',
        '사내 규정 감지: 장기 출장수당. 판단이 불확실하면 AI 정책 검토 후보로 분리해야 합니다.',
      ],
    })

    expect(message).toBe([
      '추출 불가: 업로드 파일에 회사/조직 정보 또는 사내 규칙 메모는 있지만, 직원별 급여 지급액이 확인되지 않았습니다.',
      '요청 급여 기간(2026-05)의 직원별 급여 지급대장 또는 급여명세서 자료를 다시 업로드해 주세요.',
    ].join('\n'))
  })

  it('blocks result generation when uploaded content has no payroll payment items', () => {
    const message = buildPayrollExtractionBatchMessage({
      rowCount: 0,
      payrollPeriod: '2026-05',
      warnings: ['chunk 1/1: 급여 지급 항목이 없습니다. 회사 안내문만 확인되었습니다.'],
    })

    expect(message).toBe([
      '추출 불가: 업로드 파일에 회사/조직 정보 또는 사내 규칙 메모는 있지만, 직원별 급여 지급액이 확인되지 않았습니다.',
      '요청 급여 기간(2026-05)의 직원별 급여 지급대장 또는 급여명세서 자료를 다시 업로드해 주세요.',
    ].join('\n'))
  })

  it('returns null when rows exist without warnings', () => {
    expect(buildPayrollExtractionBatchMessage({
      rowCount: 3,
      payrollPeriod: '2026-06',
      warnings: [],
    })).toBeNull()
  })
})
