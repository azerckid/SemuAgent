import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActionBlockerList } from './action-blocker-list'

describe('ActionBlockerList', () => {
  it('hides the entire surface when there are no blockers', () => {
    expect(renderToStaticMarkup(<ActionBlockerList items={[]} />)).toBe('')
  })

  it('renders one action and the matching tone for each blocker', () => {
    const html = renderToStaticMarkup(
      <ActionBlockerList
        items={[
          {
            id: 'bookkeeping',
            title: '자료대조원장 미해결 2건',
            description: '신고값을 확정하기 전에 처리해야 합니다.',
            tone: 'danger',
            href: '/dashboard/bookkeeping/reconciliation-ledger',
            ctaLabel: '자료대조원장 열기',
          },
          {
            id: 'payroll',
            title: '급여 확인 필요 1명',
            description: '확정 급여를 확인하세요.',
            tone: 'warn',
            href: '/dashboard/payroll',
            ctaLabel: '급여 열기',
          },
        ]}
      />,
    )

    expect(html.match(/<a /g)).toHaveLength(2)
    expect(html).toContain('bg-[#dc2626]')
    expect(html).toContain('bg-[#d97706]')
    expect(html).toContain('sm:grid-cols-[10px_minmax(0,1fr)_auto]')
    expect(html).toContain('col-start-2')
  })
})
