export const USAGE_HELP_CANONICAL_SOURCE_LABELS = {
  dashboard: '진행 현황 화면',
  clientList: '고객사 관리 화면',
  clientDetail: '고객사 상세',
  emails: '메일 요청 화면',
  reviews: '자료 검토 화면',
  sessionDetail: '자료 검토 세션 상세',
  submissionStatus: '자료 검토 · 제출 자료 현황',
  payroll: '급여정산 workspace',
  calendar: '캘린더 화면',
  directUpload: '담당자 직접 업로드',
  workspaceFallback: 'JARYO workspace 안내',
} as const

const CANONICAL_LABEL_SET = new Set<string>(Object.values(USAGE_HELP_CANONICAL_SOURCE_LABELS))

const SOURCE_LABEL_ALIASES: Record<string, string> = {
  '자료검토 제출 자료 현황': USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
  '자료 검토 제출 자료 현황': USAGE_HELP_CANONICAL_SOURCE_LABELS.submissionStatus,
  '자료검토 화면': USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews,
  '자료 검토 화면 역할': USAGE_HELP_CANONICAL_SOURCE_LABELS.reviews,
  '급여정산 화면 역할': USAGE_HELP_CANONICAL_SOURCE_LABELS.payroll,
  '진행 현황 화면 역할': USAGE_HELP_CANONICAL_SOURCE_LABELS.dashboard,
  '고객사 관리 화면 역할': USAGE_HELP_CANONICAL_SOURCE_LABELS.clientList,
  '메일 요청 화면 역할': USAGE_HELP_CANONICAL_SOURCE_LABELS.emails,
  '캘린더 화면 역할': USAGE_HELP_CANONICAL_SOURCE_LABELS.calendar,
  '진행 현황·목록 상태 요약': USAGE_HELP_CANONICAL_SOURCE_LABELS.dashboard,
  '진행 현황 메트릭': USAGE_HELP_CANONICAL_SOURCE_LABELS.dashboard,
  '고객사 상세 설정': USAGE_HELP_CANONICAL_SOURCE_LABELS.clientDetail,
  'JARYO 제품 기준': USAGE_HELP_CANONICAL_SOURCE_LABELS.workspaceFallback,
  'JARYO 화면·UX 기준': USAGE_HELP_CANONICAL_SOURCE_LABELS.workspaceFallback,
  '업무 흐름·메뉴 안내': USAGE_HELP_CANONICAL_SOURCE_LABELS.workspaceFallback,
  'JARYO 사용 안내': USAGE_HELP_CANONICAL_SOURCE_LABELS.workspaceFallback,
  'JARYO 기술·처리 흐름': USAGE_HELP_CANONICAL_SOURCE_LABELS.workspaceFallback,
  'JARYO 사용 안내 범위': USAGE_HELP_CANONICAL_SOURCE_LABELS.workspaceFallback,
  '고객사 목록 화면': USAGE_HELP_CANONICAL_SOURCE_LABELS.clientList,
}

export function normalizeSourceLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return USAGE_HELP_CANONICAL_SOURCE_LABELS.workspaceFallback
  if (CANONICAL_LABEL_SET.has(trimmed)) return trimmed
  return SOURCE_LABEL_ALIASES[trimmed] ?? trimmed
}

export function normalizeSourceLabels(
  labels: string[],
  fallback?: string | null,
  max = 2,
): string[] {
  const normalized = labels
    .map((label) => normalizeSourceLabel(label))
    .filter((label, index, array) => label.length > 0 && array.indexOf(label) === index)

  if (normalized.length === 0 && fallback) {
    return [normalizeSourceLabel(fallback)].slice(0, max)
  }

  return normalized.slice(0, max)
}
