import type { UsageHelpStaticAnswer } from '@/lib/usage-help/schemas'
import { USAGE_HELP_CANONICAL_SOURCE_LABELS } from '@/lib/usage-help/source-labels'

export const COMMON_SUGGESTED_QUESTIONS = [
  '이 화면에서 무엇을 보면 되나요?',
  '확인 필요는 무슨 뜻인가요?',
  '자료검토에서 제출 없음은 어떻게 처리하나요?',
  '급여 결과 엑셀은 어디서 받나요?',
] as const

export type UsageHelpRouteKey =
  | '/dashboard'
  | '/dashboard/clients'
  | '/dashboard/clients/detail'
  | '/dashboard/emails'
  | '/dashboard/reviews'
  | '/dashboard/sessions'
  | '/dashboard/payroll'
  | '/dashboard/calendar'
  | '/dashboard/direct-upload'
  | '/dashboard/other'

type RouteContextDefinition = {
  screenLabel: string
  screenRole: string
  defaultSourceLabel: string
  suggestedQuestions: readonly string[]
  screenRoleAnswer: UsageHelpStaticAnswer
}

const ROUTE_CONTEXT: Record<UsageHelpRouteKey, RouteContextDefinition> = {
  '/dashboard': {
    screenLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.dashboard,
    screenRole: '오늘 우선순위, 최근 업로드, 관리 고객사 요약을 보는 화면',
    defaultSourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.dashboard,
    suggestedQuestions: [
      '오늘 우선순위는 어디에서 보나요?',
      '최근 업로드 숫자는 무엇인가요?',
    ],
    screenRoleAnswer: {
      body: '진행 현황은 오늘 먼저 봐야 할 업무만 모아 보는 화면입니다. 처리 필요·오늘 마감·최근 업로드·관리 고객사 요약을 보고, 상세 작업은 자료 검토·메일 요청·급여정산 등 전용 화면으로 이동합니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.dashboard,
    },
  },
  '/dashboard/clients': {
    screenLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.clientList,
    screenRole: '고객사를 찾고 기본 정보·담당자·연락처를 확인하는 목록 화면',
    defaultSourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.clientList,
    suggestedQuestions: [
      '고객사 목록에서 무엇을 확인하나요?',
      '고객사 수정은 어디서 하나요?',
    ],
    screenRoleAnswer: {
      body: '고객사 관리는 고객을 찾고 기본 정보·담당자·연락처를 확인하는 화면입니다. 세부 요청·업로드·검토는 고객사 상세와 각 workspace에서 진행합니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.clientList,
    },
  },
  '/dashboard/clients/detail': {
    screenLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.clientDetail,
    screenRole: '고객사 설정, CC 그룹, 요청·일정을 관리하는 상세 화면',
    defaultSourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.clientDetail,
    suggestedQuestions: [
      'CC 그룹은 어디서 설정하나요?',
      '자료관리기준은 어디서 바꾸나요?',
    ],
    screenRoleAnswer: {
      body: '고객사 상세에서는 이름·연락처·담당자·자료관리기준, CC 그룹, 요청 일정을 설정합니다. 업로드·검토 상태는 각 workspace에서 이어서 확인합니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.clientDetail,
    },
  },
  '/dashboard/emails': {
    screenLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.emails,
    screenRole: '자료 요청 메일 작성·발송과 발송 이력을 확인하는 화면',
    defaultSourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.emails,
    suggestedQuestions: [
      '메일 일괄 발송은 어디서 하나요?',
      'CC 그룹은 어디서 설정하나요?',
    ],
    screenRoleAnswer: {
      body: '메일 요청 화면에서 자료 요청 메일을 작성·발송하고, 초안·발송 이력을 확인합니다. 보충 요청 메일 승인은 자료 검토와 연결된 흐름을 따릅니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.emails,
    },
  },
  '/dashboard/reviews': {
    screenLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews,
    screenRole: '업로드 자료, AI 판정, 제출 자료 현황을 확인하는 workspace',
    defaultSourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews,
    suggestedQuestions: [
      '제출 자료 현황은 어떻게 보내요?',
      '잘못 올린 파일은 무엇인가요?',
      '귀속기간 검토는 언제 하나요?',
    ],
    screenRoleAnswer: {
      body: '자료 검토는 업로드된 자료와 AI 판정, 제출 자료 현황, 보충 요청 초안을 확인하는 workspace입니다. 세션을 선택해 상세 상태를 봅니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews,
    },
  },
  '/dashboard/sessions': {
    screenLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.sessionDetail,
    screenRole: '한 회계 기간 세션의 제출 자료, 파일 연결, 검토 단계를 보는 상세 화면',
    defaultSourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.sessionDetail,
    suggestedQuestions: [
      '이 세션에서 무엇을 보나요?',
      '제출 자료 현황은 어떻게 보내요?',
      '사유 입력은 무엇인가요?',
    ],
    screenRoleAnswer: {
      body: '자료 검토 세션 상세에서는 제출 자료 현황, 업로드 파일 연결, 귀속기간 검토, 보충 요청 초안을 확인합니다. 목록으로 돌아가려면 자료 검토 workspace를 사용합니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.sessionDetail,
    },
  },
  '/dashboard/payroll': {
    screenLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.payroll,
    screenRole: '급여 자료 업로드, row 판정, 결과 엑셀을 확인하는 workspace',
    defaultSourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.payroll,
    suggestedQuestions: [
      '급여 엑셀 초안은 어디서 만드나요?',
      '임금명세서는 어디서 확인하나요?',
    ],
    screenRoleAnswer: {
      body: '급여정산 workspace에서 급여 자료 업로드·row 판정·결과 엑셀 초안을 확인합니다. 고객 메일 없이 테스트하려면 담당자 직접 업로드 경로를 사용할 수 있습니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.payroll,
    },
  },
  '/dashboard/calendar': {
    screenLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.calendar,
    screenRole: '제출기한과 세무 일정을 함께 보는 화면',
    defaultSourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.calendar,
    suggestedQuestions: ['세무 일정은 어떻게 확인하나요?'],
    screenRoleAnswer: {
      body: '캘린더에서 제출기한과 세무 일정을 함께 확인합니다. 특정 요청·세션으로 들어가려면 항목을 선택해 연결된 화면으로 이동합니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.calendar,
    },
  },
  '/dashboard/direct-upload': {
    screenLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.directUpload,
    screenRole: '담당자가 고객 포털 없이 파일을 직접 올리는 테스트·보조 경로',
    defaultSourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.directUpload,
    suggestedQuestions: [
      '담당자 직접 업로드는 언제 쓰나요?',
      '고객 업로드와 무엇이 다른가요?',
    ],
    screenRoleAnswer: {
      body: '담당자 직접 업로드는 고객 포털·메일 링크 없이 담당자가 파일을 올리는 경로입니다. 테스트나 긴급 보조 제출에 쓰며, 진행 현황의 최근 업로드 집계에는 포함되지 않습니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.directUpload,
    },
  },
  '/dashboard/other': {
    screenLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.workspaceFallback,
    screenRole: '설정·자료관리기준·Billing 등 보조 dashboard 화면',
    defaultSourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.workspaceFallback,
    suggestedQuestions: [],
    screenRoleAnswer: {
      body: '현재 화면의 역할은 좌측 메뉴 이름과 화면 제목을 기준으로 파악합니다. 상세 작업은 고객사·메일·자료 검토·급여정산·캘린더 workspace에서 진행합니다.',
      sourceLabel: USAGE_HELP_CANONICAL_SOURCE_LABELS.workspaceFallback,
    },
  },
}

export type UsageHelpRouteContext = {
  routeKey: UsageHelpRouteKey | null
  screenLabel: string
  screenRole: string
  defaultSourceLabel: string
  suggestedQuestions: string[]
}

export function sanitizeUsageHelpRoutePath(routePath?: string): string | null {
  if (!routePath) return null
  const trimmed = routePath.trim()
  if (!trimmed.startsWith('/dashboard')) return null
  if (trimmed.length > 200) return null
  return trimmed
}

export function matchUsageHelpRouteKey(pathname: string | null): UsageHelpRouteKey | null {
  if (!pathname) return null
  if (pathname === '/dashboard') return '/dashboard'
  if (pathname.startsWith('/dashboard/sessions')) return '/dashboard/sessions'
  if (pathname.startsWith('/dashboard/direct-upload')) return '/dashboard/direct-upload'
  if (pathname.startsWith('/dashboard/clients/')) return '/dashboard/clients/detail'
  if (pathname.startsWith('/dashboard/clients')) return '/dashboard/clients'
  if (pathname.startsWith('/dashboard/emails')) return '/dashboard/emails'
  if (pathname.startsWith('/dashboard/reviews')) return '/dashboard/reviews'
  if (pathname.startsWith('/dashboard/payroll')) return '/dashboard/payroll'
  if (pathname.startsWith('/dashboard/calendar')) return '/dashboard/calendar'
  if (pathname.startsWith('/dashboard/')) return '/dashboard/other'
  return null
}

export function resolveUsageHelpRouteContext(pathname?: string | null): UsageHelpRouteContext {
  const routeKey = matchUsageHelpRouteKey(pathname ?? null)
  const definition = routeKey ? ROUTE_CONTEXT[routeKey] : ROUTE_CONTEXT['/dashboard/other']

  return {
    routeKey,
    screenLabel: definition.screenLabel,
    screenRole: definition.screenRole,
    defaultSourceLabel: definition.defaultSourceLabel,
    suggestedQuestions: [...definition.suggestedQuestions],
  }
}

export function resolveUsageHelpScreenLabel(routePath?: string | null): string | null {
  const routeKey = matchUsageHelpRouteKey(sanitizeUsageHelpRoutePath(routePath ?? undefined))
  if (!routeKey) return null
  return ROUTE_CONTEXT[routeKey].screenLabel
}

export function resolveRouteSuggestedQuestions(pathname: string) {
  const routeContext = resolveUsageHelpRouteContext(pathname)
  const merged = [...routeContext.suggestedQuestions]

  for (const question of COMMON_SUGGESTED_QUESTIONS) {
    if (!merged.includes(question)) merged.push(question)
  }

  return merged.slice(0, 6)
}

export function resolveRouteScreenRoleAnswer(pathname: string): UsageHelpStaticAnswer {
  const routeKey = matchUsageHelpRouteKey(pathname) ?? '/dashboard/other'
  return ROUTE_CONTEXT[routeKey].screenRoleAnswer
}
