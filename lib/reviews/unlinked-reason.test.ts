import { describe, expect, it } from 'vitest'
import { resolveUnlinkedReason } from './unlinked-reason'

describe('resolveUnlinkedReason', () => {
  it('returns AI staff_unlinked_reason only', () => {
    const reason = resolveUnlinkedReason({
      parsed: {
        staff_unlinked_reason:
          '입출금 내역이 모두 포함되어 있어 지출결의서로 분류하기 어렵습니다. 요청자료 체크리스트와 연결되지 않으므로 귀속·전표 단계에서 검토하세요.',
      },
    })

    expect(reason).toContain('지출결의서')
    expect(reason).toContain('입출금')
  })

  it('returns null when staff_unlinked_reason is missing', () => {
    const reason = resolveUnlinkedReason({
      parsed: {
        unmatch_reason_code: 'journal_entry_candidate',
        explanation: '2026년 1분기 지출 내역과 카드 입금 내역이 월별 시트로 작성되어 있습니다.',
      },
    })

    expect(reason).toBeNull()
  })

  it('does not use explanation as display reason', () => {
    const reason = resolveUnlinkedReason({
      parsed: {
        routing_status: 'needs_review',
        explanation: '2026년 1분기 지출 내역과 카드 입금 내역이 월별 시트로 작성되어 있습니다.',
      },
    })

    expect(reason).toBeNull()
  })
})
