import { describe, expect, it } from 'vitest'
import { deriveListSummaryStatus, needsClientListAttention } from './client-list-summary'
import type { ClientStatusBadge } from './client-workspace-types'

function badge(label: string, tone: ClientStatusBadge['tone'], detail = label): ClientStatusBadge {
  return { label, detail, tone }
}

const baseSignals = {
  staff: badge('배정됨', 'success'),
  latestRequest: badge('요청 없음', 'secondary'),
  upload: badge('이력 없음', 'secondary'),
  review: badge('완료', 'success'),
  payroll: badge('비대상', 'secondary'),
  cc: badge('완료', 'success'),
}

describe('deriveListSummaryStatus', () => {
  it('returns 검토필요 for warning or destructive domain signals', () => {
    expect(deriveListSummaryStatus({
      ...baseSignals,
      review: badge('승인 대기', 'warning', '보충 요청 초안이 담당자 승인을 기다립니다.'),
    })).toMatchObject({
      label: '검토필요',
      tone: 'warning',
      detail: '보충 요청 초안이 담당자 승인을 기다립니다.',
    })

    expect(deriveListSummaryStatus({
      ...baseSignals,
      latestRequest: badge('지연', 'destructive', '2026-01 기장 자료 요청 · 자료 · 정기 · 기한 6/1'),
    })).toMatchObject({
      label: '검토필요',
      tone: 'destructive',
      detail: '요청 기한 초과',
    })
  })

  it('prefers review warning over latestRequest warning', () => {
    expect(deriveListSummaryStatus({
      ...baseSignals,
      latestRequest: badge('업로드 대기', 'warning', '2026-01 기장 자료 요청 · 자료 · 정기 · 기한 6/23'),
      review: badge('승인 대기', 'warning', '보충 요청 초안이 담당자 승인을 기다립니다.'),
    })).toMatchObject({
      label: '검토필요',
      tone: 'warning',
      detail: '보충 요청 초안이 담당자 승인을 기다립니다.',
    })
  })

  it('returns 진행 중 when only info signals remain', () => {
    expect(deriveListSummaryStatus({
      ...baseSignals,
      upload: badge('분석 중', 'info', 'AI 판단 진행 중'),
    })).toMatchObject({ label: '진행 중', tone: 'info' })
  })

  it('returns 완료 when no attention or progress signals exist', () => {
    expect(deriveListSummaryStatus(baseSignals)).toMatchObject({ label: '완료', tone: 'success' })
  })
})

describe('needsClientListAttention', () => {
  it('matches warning and destructive tones only', () => {
    expect(needsClientListAttention({
      ...baseSignals,
      cc: badge('미설정', 'destructive'),
    })).toBe(true)

    expect(needsClientListAttention({
      ...baseSignals,
      review: badge('완료', 'success'),
    })).toBe(false)
  })
})
