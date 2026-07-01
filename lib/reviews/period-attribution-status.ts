import type { ReviewMaterialAttributionSummary } from './review-workspace-types'
import type { DisplayStatus } from '@/lib/status-tone'
import {
  buildRequestedPeriodGapStatusDetail,
  hasRequestedPeriodDataGap,
} from './period-scope-presentation'

// `귀속기간` 컬럼/팝업 전용. 자료 상태(derivedStatus)나 fiscal-year ledger
// 누적 상태(계정항목/전표분개)와 섞지 않고, current upload session의
// material attribution summary만 본다.
export function deriveMaterialAttributionDisplayStatus(
  summary: ReviewMaterialAttributionSummary | null,
): DisplayStatus {
  if (!summary || summary.total === 0) {
    return { label: '대기', detail: '아직 귀속기간 검토를 시작하지 않았습니다', tone: 'default' }
  }

  if (summary.unknown > 0) {
    return {
      label: '검토필요',
      detail: `귀속월 판단 불가 ${summary.unknown}건을 담당자가 확인해야 합니다`,
      tone: 'destructive',
    }
  }

  if (hasRequestedPeriodDataGap(summary)) {
    const detail = buildRequestedPeriodGapStatusDetail(summary)
    if (summary.outOfScope > 0) {
      return { label: '요청기간 불일치', detail, tone: 'destructive' }
    }
    if (summary.inCloseWindow > 0) {
      return { label: '검토필요', detail, tone: 'warning' }
    }
    return { label: '검토필요', detail, tone: 'warning' }
  }

  if (summary.possibleDuplicate > 0 || summary.hold > 0) {
    const parts: string[] = []
    if (summary.possibleDuplicate > 0) parts.push(`중복 의심 ${summary.possibleDuplicate}건`)
    if (summary.hold > 0) parts.push(`보류 ${summary.hold}건`)
    return { label: '검토필요', detail: parts.join(' · '), tone: 'warning' }
  }

  return { label: '완료', detail: `귀속기간 판단 완료 ${summary.total}건`, tone: 'success' }
}
