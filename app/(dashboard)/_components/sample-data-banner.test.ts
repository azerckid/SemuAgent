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
    expect(source).toContain('사용자가 직접 올린 실제 업로드·급여·신고 데이터는 registry에 없으면 삭제하지 않습니다.')
  })
})
