import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('sample data banner integration', () => {
  it('is mounted from the dashboard layout so every workspace sees it (S-72)', () => {
    const source = readFileSync(new URL('../layout.tsx', import.meta.url), 'utf8')

    expect(source).toContain('loadFirstRunSampleState')
    expect(source).toContain('<SampleDataBanner state={firstRunSampleState} />')
  })

  it('uses the first-run sample API and destructive confirmation copy (S-21/S-22)', () => {
    const source = readFileSync(new URL('./sample-data-banner.tsx', import.meta.url), 'utf8')

    expect(source).toContain("fetch('/api/first-run-sample', { method: 'DELETE' })")
    expect(source).toContain('샘플 데이터 삭제하고 실제 사용 시작')
    expect(source).toContain('샘플만 삭제되며, 직접 올린 회사 자료는 그대로 둡니다.')
    expect(source).toContain('삭제 후에는 자동으로 다시 생성되지 않습니다.')
    expect(source).not.toContain('샘플 업로드, 기장검토, 부가세, 급여')
    expect(source).not.toContain('DialogTrigger')
  })
})
