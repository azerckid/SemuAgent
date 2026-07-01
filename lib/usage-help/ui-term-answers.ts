import type { UsageHelpStaticAnswer } from '@/lib/usage-help/schemas'
import { USAGE_HELP_CANONICAL_SOURCE_LABELS } from '@/lib/usage-help/source-labels'

type UiTermRule = {
  pattern: RegExp
  answer: UsageHelpStaticAnswer
}

const UI_TERM_RULES: UiTermRule[] = [
  {
    pattern: /사유\s*입력|사유입력/,
    answer: {
      body: '사유 입력은 자료 검토의 제출 자료 현황에서 `제출 없음` 항목 옆에 있는 선택 기능입니다. 필요할 때만 버튼을 눌러 확인 메모를 남기고, `담당자 승인` 또는 `해당 없음/제외`를 기록합니다. 사유를 입력하지 않아도 다음 검토 단계로 진행할 수 있습니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
    },
  },
  {
    pattern: /담당자\s*승인/,
    answer: {
      body: '`담당자 승인`은 사유 입력 패널에서 미제출·예외 상황을 담당자가 확인했음을 기록하는 버튼입니다. 자료 검토 세션의 제출 자료 현황에서 `사유 입력`을 연 뒤 사용합니다. 메일 발송 승인과는 다른 화면 동작입니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
    },
  },
  {
    pattern: /해당\s*없음\s*\/?\s*제외|해당\s*없음/,
    answer: {
      body: '`해당 없음/제외`는 사유 입력 패널에서 해당 요청자료 항목을 이번 회계 기간 검토 대상에서 제외한다는 뜻으로 기록하는 버튼입니다. 자료 검토의 제출 자료 현황에서 `사유 입력`을 연 뒤 선택합니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
    },
  },
  {
    pattern: /제출\s*없음/,
    answer: {
      body: '`제출 없음`은 해당 요청자료 항목에 연결된 파일이 없다는 뜻입니다. 자료가 실제로 없을 수 있으므로 바로 보충 요청으로 판단하지 않고, 필요하면 `사유 입력`으로 담당자 확인 내용을 남깁니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
    },
  },
  {
    pattern: /잘못\s*올린\s*파일|미연결\s*파일/,
    answer: {
      body: '잘못 올린 파일(또는 미연결 파일)은 요청자료 항목과 연결되지 않았거나 기간·유형이 맞지 않는 업로드 파일을 별도로 확인하라는 표시입니다. 자료 검토 세션 상세에서 연결 상태와 제출 자료 현황을 함께 확인합니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews,
    },
  },
]

export function isJaryoUiLabelQuestion(question: string) {
  const normalized = question.trim()
  if (!normalized) return false

  return UI_TERM_RULES.some((rule) => rule.pattern.test(normalized))
    || /무엇인가|무슨\s*뜻|뭐(?:야|예요|인가요?)|어떻게\s*쓰|어디(?:서|에)/.test(normalized)
}

export function resolveUiTermAnswer(question: string): UsageHelpStaticAnswer | null {
  const normalized = question.trim()
  if (!normalized) return null

  for (const rule of UI_TERM_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.answer
    }
  }

  return null
}
