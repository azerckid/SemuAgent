import { describe, expect, it } from 'vitest'
import { extractAttendeeNames, resolvePastDecisionSignal } from './reclassification-evidence-resolver'

// resolveReclassificationCandidates 등 DB 조회 래퍼 자체는 이 저장소 관례상(다른
// lib/vat/*.ts와 동일) 단위 테스트 대상이 아니다 — DB 연결부는 dev 서비스
// E2E(VAI-9e)에서 검증한다. 여기서는 이 파일에 있는 순수 로직(적요 참석자 파서,
// 과거 결정 이력 판정)을 단위 테스트한다.
describe('extractAttendeeNames (JC-041 VAI-9b)', () => {
  it('"참석자: 이름, 이름" 패턴에서 이름 목록을 뽑는다', () => {
    expect(extractAttendeeNames('팀 회식 / 참석자: 김대표, 이수민, 박지훈'))
      .toEqual(['김대표', '이수민', '박지훈'])
  })

  it('전각 콜론(：)도 인식한다', () => {
    expect(extractAttendeeNames('참석자：김대표 이수민')).toEqual(['김대표', '이수민'])
  })

  it('구분자로 공백만 있어도 이름을 나눈다', () => {
    expect(extractAttendeeNames('참석자: 김대표 이수민 박지훈')).toEqual(['김대표', '이수민', '박지훈'])
  })

  it('참석자 패턴이 없으면 null을 반환한다(정보 없음으로 취급)', () => {
    expect(extractAttendeeNames('팀 회식')).toBeNull()
    expect(extractAttendeeNames('')).toBeNull()
  })

  it('"참석자:" 뒤에 실질 내용이 없으면 null을 반환한다', () => {
    expect(extractAttendeeNames('참석자: ')).toBeNull()
  })

  it('슬래시 뒤 다른 필드까지 이름으로 잘못 묶지 않는다', () => {
    expect(extractAttendeeNames('참석자: 김대표, 이수민 / 목적: 분기 회식'))
      .toEqual(['김대표', '이수민'])
  })
})

describe('resolvePastDecisionSignal (JC-041 VAI-9b, 리뷰 지적 사항 회귀 테스트)', () => {
  it('접대비 사유로 non_deductible 확정 이력이 있으면 kept_as_entertainment를 반환한다', () => {
    expect(resolvePastDecisionSignal([
      { decision: 'non_deductible', reason: '기업업무추진비 관련 매입세액' },
    ])).toBe('kept_as_entertainment')
  })

  it('접대비 사유로 deductible 확정 이력이 있으면 reclassified_as_benefit를 반환한다', () => {
    expect(resolvePastDecisionSignal([
      { decision: 'deductible', reason: '접대비로 분류됐으나 복리후생비로 재분류' },
    ])).toBe('reclassified_as_benefit')
  })

  it('행 순서와 무관하게 kept_as_entertainment가 있으면 그것을 우선한다(순서 의존 버그 회귀)', () => {
    // 배열 순서상 deductible이 먼저 나와도(예전엔 .some()이 먼저 매칭돼 순서에
    // 의존하는 버그가 있었다), 상충 이력이 있으면 보수적인 쪽을 우선해야 한다.
    const rows = [
      { decision: 'deductible', reason: '기업업무추진비' },
      { decision: 'non_deductible', reason: '기업업무추진비' },
    ]
    expect(resolvePastDecisionSignal(rows)).toBe('kept_as_entertainment')
    expect(resolvePastDecisionSignal([...rows].reverse())).toBe('kept_as_entertainment')
  })

  it('접대비가 아닌 다른 불공제 사유의 이력은 신호로 쓰지 않는다(reason 필터 누락 버그 회귀)', () => {
    expect(resolvePastDecisionSignal([
      { decision: 'non_deductible', reason: '비영업용 소형승용차 구입·유지' },
    ])).toBeNull()
    expect(resolvePastDecisionSignal([
      { decision: 'deductible', reason: '비영업용 소형승용차 구입·유지' },
    ])).toBeNull()
  })

  it('이력이 없으면 null을 반환한다', () => {
    expect(resolvePastDecisionSignal([])).toBeNull()
  })
})
