import type { ClientStatusBadge, ClientWorkspaceStatus } from './client-workspace-types'

const SUMMARY_SIGNAL_KEYS = ['staff', 'latestRequest', 'upload', 'review', 'payroll', 'cc'] as const

/** List summary picks the highest-priority attention signal, not map iteration order. */
const SUMMARY_PRIORITY: readonly (typeof SUMMARY_SIGNAL_KEYS[number])[] = [
  'review',
  'latestRequest',
  'upload',
  'cc',
  'staff',
  'payroll',
]

type StatusSignals = Pick<ClientWorkspaceStatus, typeof SUMMARY_SIGNAL_KEYS[number]>

function toListDetail(signal: ClientStatusBadge): string {
  if (!signal.detail.includes(' · ') && signal.detail.length <= 48) {
    return signal.detail
  }

  const shortByLabel: Record<string, string> = {
    '승인 대기': '보충 요청 초안 승인 대기',
    '발송 실패': '메일 발송 실패 확인 필요',
    '확인 필요': '요청자료 또는 파일 검토 필요',
    '검토필요': '요청자료 또는 파일 검토 필요',
    '미배정': '담당자를 지정해 주세요.',
    '업로드 대기': '클라이언트 업로드 대기',
    '지연': '요청 기한 초과',
    '일부 제출': '제출 자료 보완 필요',
    '대기': '업로드 대기',
    '실패': '업로드 파일 확인 필요',
    '미설정': '참조 그룹 미설정',
    '일반 없음': '일반 참조 그룹 없음',
    '급여 없음': '급여 참조 그룹 없음',
    '기본 없음': '기본 참조 그룹 없음',
    '예정': '요청 예정',
    '초안': '발송 전 초안 확인',
    '제출 확인': '제출 확인 중',
    '분석 중': 'AI 판단 진행 중',
    '제출 완료': '업로드 제출 완료',
    '엑셀 가능': '급여정산 결과 확인 가능',
    '진행 중': '급여정산 진행 중',
  }

  return shortByLabel[signal.label] ?? signal.label
}

function pickSignal(signals: StatusSignals, tones: ClientStatusBadge['tone'][]) {
  for (const key of SUMMARY_PRIORITY) {
    const signal = signals[key]
    if (tones.includes(signal.tone)) {
      return signal
    }
  }

  return null
}

export function deriveListSummaryStatus(signals: StatusSignals): ClientStatusBadge {
  const destructive = pickSignal(signals, ['destructive'])
  if (destructive) {
    return { label: '검토필요', detail: toListDetail(destructive), tone: 'destructive' }
  }

  const warning = pickSignal(signals, ['warning'])
  if (warning) {
    return { label: '검토필요', detail: toListDetail(warning), tone: 'warning' }
  }

  const inProgress = pickSignal(
    signals,
    ['info'],
  )
  if (inProgress && inProgress.label !== '비대상') {
    return { label: '진행 중', detail: toListDetail(inProgress), tone: 'info' }
  }

  return { label: '완료', detail: '별도 확인 신호가 없습니다.', tone: 'success' }
}

export function needsClientListAttention(signals: StatusSignals) {
  return SUMMARY_SIGNAL_KEYS.some((key) => {
    const tone = signals[key].tone
    return tone === 'warning' || tone === 'destructive'
  })
}
