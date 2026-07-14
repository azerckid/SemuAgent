import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FilingPortalGuide } from './filing-portal-guide'

describe('FilingPortalGuide', () => {
  it('hides the surface when there are no portal items', () => {
    expect(renderToStaticMarkup(<FilingPortalGuide items={[]} />)).toBe('')
  })

  it('renders Hometax and Wetax with the same information order', () => {
    const html = renderToStaticMarkup(
      <FilingPortalGuide
        items={[
          {
            portal: 'hometax',
            scopeLabel: '원천세',
            readiness: 'ready',
            preparedValueLabel: '확정 금액과 입력 위치',
            userActionLabel: '홈택스에서 확인 후 제출',
            externalHref: 'https://www.hometax.go.kr/',
          },
          {
            portal: 'wetax',
            scopeLabel: '지방소득세 특별징수',
            readiness: 'source_pending',
            preparedValueLabel: '확정 지방소득세와 신고기간',
            userActionLabel: '위택스에서 신고·제출',
            externalHref: 'https://www.wetax.go.kr/',
          },
        ]}
      />,
    )

    expect(html.match(/<a /g)).toHaveLength(2)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('data-readiness="ready"')
    expect(html).toContain('data-readiness="source_pending"')
    expect(html).toContain('입력값 준비')
    expect(html).toContain('공식 원본 입수 대기')
    expect(html.indexOf('SemuAgent에서 준비')).toBeLessThan(html.indexOf('사용자가 수행'))
    expect(html).toContain('md:grid-cols-[minmax(150px,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto]')
  })
})
