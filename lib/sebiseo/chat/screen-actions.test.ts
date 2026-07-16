import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { sebiseoSuggestedActionSchema } from './schemas'
import {
  listSebiseoScreenActions,
  resolveSebiseoScreenActions,
  SEBISEO_MAX_RENDERED_ACTIONS,
} from './screen-actions'

describe('resolveSebiseoScreenActions', () => {
  it('returns no actions when nothing matches', () => {
    expect(resolveSebiseoScreenActions('이 화면이 뭐예요?')).toEqual([])
  })

  it('maps a screen keyword to its fixed dashboard route', () => {
    const actions = resolveSebiseoScreenActions('부가세 공제는 어디서 확인해요?')
    expect(actions).toEqual([
      { id: 'vat', label: '부가세 열기', href: '/dashboard/vat' },
    ])
  })

  it('routes specific tax types to their detail screen, not the annual hub', () => {
    expect(resolveSebiseoScreenActions('연말정산 어떻게 해요?')[0]?.href).toBe(
      '/dashboard/filing-preparation/year-end-settlement',
    )
    expect(resolveSebiseoScreenActions('지방소득세 화면 알려줘')[0]?.href).toBe(
      '/dashboard/filing-preparation/local-income-tax',
    )
    expect(resolveSebiseoScreenActions('사업장현황신고는요?')[0]?.href).toBe(
      '/dashboard/filing-preparation/business-status-report',
    )
  })

  it('sends only the generic 연간신고 keyword to the hub', () => {
    expect(resolveSebiseoScreenActions('연간신고 화면 사용법')[0]?.href).toBe(
      '/dashboard/filing-preparation',
    )
    expect(resolveSebiseoScreenActions('법인세는 어디서 봐요?')[0]?.href).toBe(
      '/dashboard/filing-preparation',
    )
  })

  it('caps rendered actions at 2 even when more screens match', () => {
    const actions = resolveSebiseoScreenActions('자료수집하고 부가세랑 급여도 알려줘')
    expect(actions.length).toBeLessThanOrEqual(SEBISEO_MAX_RENDERED_ACTIONS)
    expect(actions.length).toBe(2)
  })

  it('does not repeat the same href', () => {
    const actions = resolveSebiseoScreenActions('원장 증빙 자료대조 원장')
    const hrefs = actions.map((action) => action.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('produces actions that satisfy the response schema', () => {
    for (const action of listSebiseoScreenActions()) {
      const parsed = sebiseoSuggestedActionSchema.safeParse({
        id: action.id,
        label: action.label,
        href: action.href,
      })
      expect(parsed.success).toBe(true)
    }
  })
})

describe('screen action drift guard', () => {
  it('every allowlist href exists in the sidebar navigation', () => {
    const sidebarSource = readFileSync(
      path.join(process.cwd(), 'app/(dashboard)/_components/sidebar.tsx'),
      'utf8',
    )
    for (const action of listSebiseoScreenActions()) {
      expect(
        sidebarSource.includes(`'${action.href}'`),
        `${action.href} (${action.id}) must exist as a sidebar route`,
      ).toBe(true)
    }
  })
})
