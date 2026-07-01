import { describe, expect, it } from 'vitest'
import {
  extractSupplementReasonsFromHtml,
  formatApprovalQueuePeriod,
  normalizeApprovalEmailBody,
  normalizeApprovalEmailSubject,
  summarizeApprovalEmailReason,
} from './approval-queue-format'

describe('formatApprovalQueuePeriod', () => {
  it('formats monthly, quarterly, half-year, and annual periods without NaN', () => {
    expect(formatApprovalQueuePeriod('2024-07')).toEqual({ label: '2024년 7월', isInvalid: false })
    expect(formatApprovalQueuePeriod('2024-Q1')).toEqual({ label: '2024년 1분기', isInvalid: false })
    expect(formatApprovalQueuePeriod('2024-H1')).toEqual({ label: '2024년 상반기', isInvalid: false })
    expect(formatApprovalQueuePeriod('2024-H2')).toEqual({ label: '2024년 하반기', isInvalid: false })
    expect(formatApprovalQueuePeriod('2024')).toEqual({ label: '2024년', isInvalid: false })
  })

  it('marks unknown period formats as invalid', () => {
    expect(formatApprovalQueuePeriod('2024-13')).toEqual({ label: '기간 확인 필요', isInvalid: true })
    expect(formatApprovalQueuePeriod('2024년 NaN월')).toEqual({ label: '기간 확인 필요', isInvalid: true })
  })
})

describe('normalizeApprovalEmailSubject', () => {
  it('turns legacy supplement subjects into customer-facing confirmation subjects', () => {
    expect(normalizeApprovalEmailSubject('[솔메이트] 2026년 1분기 보충 요청')).toBe(
      '[솔메이트] 2026년 1분기 제출 자료 확인',
    )
    expect(normalizeApprovalEmailSubject('[솔메이트] 2026년 1분기 기장 자료 보충 요청 안내')).toBe(
      '[솔메이트] 2026년 1분기 제출 자료 확인 안내',
    )
  })
})

describe('normalizeApprovalEmailBody', () => {
  it('normalizes legacy missing request copy before preview and approval', () => {
    const html = `
      <p>아래 업로드 링크에서 보완 자료를 추가로 제출해 주세요.</p>
      <li>
        <strong>[누락] 현금영수증 (필수): 기장 업무를 위해 확인합니다.</strong><br />
        <span style="color:#4b5563;">사유: 제출되지 않았습니다.</span><br />
        <span style="color:#c2410c;">요청: 현금영수증 일별 자료를 제출하시기 바랍니다.</span>
      </li>
    `

    const normalized = normalizeApprovalEmailBody(html)

    expect(normalized).toContain('현금영수증</strong> <span style="display:inline-block;margin-left:6px;color:#b45309;">제출 없음</span>')
    expect(normalized).toContain('해당 자료가 있으시면 기한 내 기존 업로드 링크로 추가 업로드해 주세요')
    expect(normalized).toContain('자료가 없거나 관련 거래가 없다면 현재 제출해주신 자료를 기준으로 작업을 진행하겠습니다')
    expect(normalized).not.toContain('[누락]')
    expect(normalized).not.toContain('(필수)')
    expect(normalized).not.toContain('요청:')
    expect(normalized).not.toContain('보완 자료')
  })
})

describe('summarizeApprovalEmailReason', () => {
  it('uses criteria count when available', () => {
    expect(summarizeApprovalEmailReason('제출자료 확인 안내 — 3개 항목', '')).toBe('확인 항목 3개')
  })

  it('summarizes customer-facing reasons from html body', () => {
    const html = `
      <ol>
        <li><strong>[누락] 현금영수증</strong><br /><span>요청</span></li>
        <li><strong>[불일치] 매출 세금계산서</strong><br /><span>요청</span></li>
        <li><strong>[누락] 카드 사용내역</strong><br /><span>요청</span></li>
      </ol>
    `

    expect(extractSupplementReasonsFromHtml(html)).toEqual([
      '제출 없음 현금영수증',
      '확인 필요 매출 세금계산서',
      '제출 없음 카드 사용내역',
    ])
    expect(summarizeApprovalEmailReason(null, html)).toBe('제출 없음 현금영수증 · 확인 필요 매출 세금계산서 외 1개')
  })

  it('falls back to a short generic label', () => {
    expect(summarizeApprovalEmailReason(null, '<p>본문</p>')).toBe('제출자료 확인')
  })
})
