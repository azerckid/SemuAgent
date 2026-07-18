import type { DateTime } from '@/lib/time'
import { expandTaxSchedulesForMonth } from '@/lib/tax-calendar'
import { sebiseoChatResponseSchema, type SebiseoChatResponse } from './schemas'

/** Returns an app-owned common schedule without involving an LLM. */
export function buildSebiseoCurrentMonthScheduleAnswer(today: DateTime): SebiseoChatResponse {
  const schedules = expandTaxSchedulesForMonth(today.year, today.month)
  const monthLabel = today.toFormat('yyyy년 M월')
  const scheduleText = schedules.length > 0
    ? schedules.map((schedule) => `${schedule.date.month}/${schedule.date.day} ${schedule.title}`).join(', ')
    : '등록된 공통 세무 일정이 없습니다'

  return sebiseoChatResponseSchema.parse({
    status: 'answered',
    answer: `${monthLabel} SemuAgent 등록 공통 세무 일정은 ${scheduleText}입니다. 회사별 해당 여부와 준비 상태는 각 신고 화면에서 확인하세요.`,
    suggestedActions: [],
  })
}
