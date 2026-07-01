function collectErrorMessages(error: unknown): string[] {
  const messages: string[] = []
  let current: unknown = error
  let depth = 0

  while (current && depth < 6) {
    if (current instanceof Error) {
      messages.push(current.message)
      current = current.cause
    } else {
      messages.push(String(current))
      break
    }
    depth += 1
  }

  return messages
}

export function isMissingReviewAttributionSavedPromptTableError(error: unknown) {
  return collectErrorMessages(error).some((value) =>
    value.includes('no such table: review_attribution_saved_prompt'),
  )
}

export const ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_MESSAGE =
  '귀속기간 저장 프롬프트 테이블이 아직 준비되지 않았습니다. drizzle/0048_add_review_attribution_saved_prompt.sql을 적용하거나 pnpm db:push를 실행해 주세요.'

export const ATTRIBUTION_SAVED_PROMPT_TABLE_NOT_READY_USER_MESSAGE =
  '저장 프롬프트 DB가 아직 준비되지 않았습니다. 마이그레이션 적용 후 아래 "다시 불러오기"를 눌러 주세요.'
