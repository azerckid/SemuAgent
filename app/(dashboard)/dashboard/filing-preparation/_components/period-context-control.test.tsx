import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PeriodContextControl } from './period-context-control'

describe('PeriodContextControl', () => {
  it('renders a read-only value without fake navigation', () => {
    const html = renderToStaticMarkup(
      <PeriodContextControl context={{ label: '귀속연도', value: '2025년' }} />,
    )

    expect(html).toContain('data-period-navigation="read-only"')
    expect(html).toContain('귀속연도')
    expect(html).toContain('2025년')
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('aria-disabled')
  })

  it('renders only real hrefs and disables a missing next period', () => {
    const html = renderToStaticMarkup(
      <PeriodContextControl
        context={{
          label: '기간',
          value: '2026년 상반기',
          previousHref: '/dashboard/filing-preparation?period=2025-H2',
        }}
      />,
    )

    expect(html).toContain('data-period-navigation="navigable"')
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).toContain('href="/dashboard/filing-preparation?period=2025-H2"')
    expect(html).toContain('aria-label="다음 기간"')
    expect(html).toContain('aria-disabled="true"')
  })

  it('renders both directions when both destinations are supplied', () => {
    const html = renderToStaticMarkup(
      <PeriodContextControl
        context={{
          label: '귀속기간',
          value: '2026년 5월',
          previousHref: '/dashboard/filing-preparation/local-income-tax?period=2026-04',
          nextHref: '/dashboard/filing-preparation/local-income-tax?period=2026-06',
        }}
      />,
    )

    expect(html.match(/<a /g)).toHaveLength(2)
    expect(html).toContain('aria-label="이전 기간"')
    expect(html).toContain('aria-label="다음 기간"')
  })
})
