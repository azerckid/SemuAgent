import { describe, expect, it } from 'vitest'
import { DateTime } from '@/lib/time'
import { buildSebiseoCurrentMonthScheduleAnswer } from './schedule-answer'

describe('buildSebiseoCurrentMonthScheduleAnswer', () => {
  it('answers the verified July 2026 common schedule with conditions and a calendar link', () => {
    const today = DateTime.fromISO('2026-07-19', { zone: 'Asia/Seoul' })
    const response = buildSebiseoCurrentMonthScheduleAnswer(today)

    expect(response.answer).toContain('7/27 부가가치세 확정신고')
    expect(response.answer).toContain('7/31 간이지급명세서(근로소득)')
    expect(response.answer).toContain('상반기에 근로소득을 지급한 경우')
    expect(response.answer).toContain('회사별 해당 여부와 준비 상태')
    expect(response.suggestedActions).toEqual([
      {
        id: 'calendar',
        label: '세무 일정 보기',
        href: '/dashboard/calendar?month=2026-07',
      },
    ])
  })
})
