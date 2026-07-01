import {
  resolveRouteScreenRoleAnswer,
  resolveRouteSuggestedQuestions,
} from '@/lib/usage-help/route-context'
import { normalizeSourceLabel, USAGE_HELP_CANONICAL_SOURCE_LABELS } from '@/lib/usage-help/source-labels'
import { resolveUiTermAnswer } from '@/lib/usage-help/ui-term-answers'
import type { UsageHelpStaticAnswer } from '@/lib/usage-help/schemas'

export { COMMON_SUGGESTED_QUESTIONS } from '@/lib/usage-help/route-context'

export type { UsageHelpStaticAnswer } from '@/lib/usage-help/schemas'

const STATIC_ANSWERS: Record<string, UsageHelpStaticAnswer> = {
  '확인 필요는 무슨 뜻인가요?': {
    body: '확인 필요는 JARYO가 담당자 확인이 필요하다고 표시한 상태입니다. 지연, 승인 대기, 미배정, 참조 그룹 미설정 등 여러 신호가 있을 수 있으므로, 해당 화면에서 상세 상태를 열어 확인하세요.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.dashboard,
  },
  '자료검토에서 제출 없음은 어떻게 처리하나요?': {
    body: '제출 없음은 해당 요청자료 항목에 연결된 파일이 없다는 뜻입니다. 자료가 실제로 없을 수 있으므로 바로 보충 요청으로 판단하지 않고, 필요하면 사유 입력으로 담당자 확인 내용을 남깁니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
  },
  '급여 결과 엑셀은 어디서 받나요?': {
    body: '급여정산 workspace에서 해당 세션을 연 뒤, 결과 엑셀 초안이 준비되면 다운로드할 수 있습니다. 메뉴: 급여정산 → 세션 상세 → 결과 엑셀 영역.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.payroll,
  },
  '오늘 우선순위는 어디에서 보나요?': {
    body: '진행 현황 화면의 오늘의 우선순위 목록에서 지연, 발송 실패, 검토 대기, 급여 부적합, 오늘 마감 항목을 확인합니다. 항목을 누르면 해당 전용 화면으로 이동할 수 있습니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.dashboard,
  },
  '최근 업로드 숫자는 무엇인가요?': {
    body: '최근 7일 동안 고객 포털·메일 링크로 제출된 파일 수입니다. 담당자 직접 업로드(테스트)는 포함하지 않습니다. 상세 확인은 자료 검토 화면에서 진행합니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.dashboard,
  },
  '고객사 목록에서 무엇을 확인하나요?': {
    body: '고객사 목록은 고객을 빠르게 찾는 디렉터리입니다. 담당자, 고객사 연락처, 한 줄 상태 요약을 보고 상세로 들어갑니다. 요청·업로드·검토 세부 상태는 고객사 상세와 각 workspace에서 확인합니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.clientList,
  },
  '고객사 수정은 어디서 하나요?': {
    body: '고객사 목록 행의 작업 메뉴에서 수정을 선택하거나, 고객사 상세의 설정 영역에서 이름·연락처·담당자·자료관리기준을 변경합니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.clientList,
  },
  '메일 일괄 발송은 어디서 하나요?': {
    body: '메일 요청 화면에서 정기·비정기 요청을 작성하고, 필요하면 일괄 발송 흐름으로 여러 고객사에 보냅니다. 발송 전 초안 검토·승인 단계를 확인하세요.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.emails,
  },
  'CC 그룹은 어디서 설정하나요?': {
    body: '고객사 상세에서 참조(CC) 그룹을 설정합니다. 일반 자료 요청과 급여 요청에 각각 필요한 참조 그룹이 있는지 확인하세요.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.clientDetail,
  },
  '자료관리기준은 어디서 바꾸나요?': {
    body: '고객사 상세 설정에서 자료관리기준(체크리스트)을 연결하거나 변경합니다. 목록 화면에서는 고객사 상세로 들어가 설정합니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.clientDetail,
  },
  '제출 자료 현황은 어떻게 보내요?': {
    body: '자료 검토 workspace에서 세션을 열면 제출 자료 현황 표가 보입니다. 요청자료 항목별로 제출됨·제출 없음·확인 필요 등 상태를 확인합니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews,
  },
  '잘못 올린 파일은 무엇인가요?': {
    body: '자료항목과 연결되지 않거나 기간·유형이 맞지 않는 파일이 잘못 올린 파일 후보로 표시될 수 있습니다. 세션 상세에서 파일 연결 상태와 제출 자료 현황을 함께 확인하세요.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews,
  },
  '귀속기간 검토는 언제 하나요?': {
    body: '제출 자료가 모였거나 회계 기간 귀속 확인이 필요할 때 세션 상세의 귀속기간 검토 영역을 사용합니다. 자료 검토 workspace에서 해당 세션으로 이동해 확인합니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.sessionDetail,
  },
  '급여 엑셀 초안은 어디서 만드나요?': {
    body: '급여정산 workspace에서 세션을 연 뒤, 업로드·판정이 끝나면 결과 엑셀 초안을 생성·확인합니다. 메뉴: 급여정산 → 세션 선택 → 결과 엑셀.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.payroll,
  },
  '임금명세서는 어디서 확인하나요?': {
    body: '급여정산 workspace의 세션 상세에서 업로드된 급여 관련 파일과 row 판정 결과를 확인합니다. 파일별 상세는 세션 화면에서 열어봅니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.payroll,
  },
  '세무 일정은 어떻게 확인하나요?': {
    body: '캘린더 화면에서 세무 일정과 자료 요청 마감을 함께 봅니다. 날짜·고객사별 요청 상태는 캘린더와 고객사 상세에서 이어서 확인합니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.calendar,
  },
  '이 세션에서 무엇을 보나요?': {
    body: '세션 상세에서는 제출 자료 현황, 업로드 파일 연결, 귀속기간 검토, 보충 요청 초안을 확인합니다. 파일별 판정과 사유 입력도 이 화면에서 진행합니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.sessionDetail,
  },
  '사유 입력은 무엇인가요?': {
    body: '사유 입력은 제출 자료 현황에서 `제출 없음` 항목 옆 선택 기능입니다. 필요할 때만 버튼을 눌러 확인 메모와 `담당자 승인` 또는 `해당 없음/제외`를 기록합니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
  },
  '담당자 직접 업로드는 언제 쓰나요?': {
    body: '고객 포털·메일 링크 없이 담당자가 파일을 올려야 할 때 사용합니다. 테스트 제출이나 긴급 보조 업로드에 쓰며, 진행 현황의 최근 업로드 집계에는 포함되지 않습니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.directUpload,
  },
  '고객 업로드와 무엇이 다른가요?': {
    body: '고객 업로드는 고객 포털·메일 링크를 통한 제출이고, 담당자 직접 업로드는 내부 담당자가 올리는 경로입니다. 후자는 테스트·보조용이며 최근 업로드 메트릭에서 제외됩니다.',
    sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.directUpload,
  },
}

function withNormalizedSourceLabel(answer: UsageHelpStaticAnswer): UsageHelpStaticAnswer {
  return {
    ...answer,
    sourceLabel: normalizeSourceLabel(answer.sourceLabel),
  }
}

export function resolveSuggestedQuestions(pathname: string) {
  return resolveRouteSuggestedQuestions(pathname)
}

export function getStaticAnswer(question: string, pathname: string): UsageHelpStaticAnswer | null {
  const uiTermAnswer = resolveUiTermAnswer(question)
  if (uiTermAnswer) return withNormalizedSourceLabel(uiTermAnswer)

  if (question === '이 화면에서 무엇을 보면 되나요?') {
    return withNormalizedSourceLabel(resolveRouteScreenRoleAnswer(pathname))
  }

  const staticAnswer = STATIC_ANSWERS[question]
  return staticAnswer ? withNormalizedSourceLabel(staticAnswer) : null
}
