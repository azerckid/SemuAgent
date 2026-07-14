import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'app/(dashboard)/dashboard/filing-preparation/local-income-tax/_components/local-income-tax-review.tsx'),
  'utf8',
)

describe('LocalIncomeTaxReview portal guide', () => {
  it('uses the shared Wetax guide without overstating source readiness', () => {
    expect(source).toContain('FilingPortalGuide')
    expect(source).toContain("readiness: 'source_pending'")
    expect(source).toContain('확정 지방소득세')
    expect(source).toContain('위택스에서 신고·제출')
    expect(source).not.toContain('파일 다운로드')
    expect(source).not.toContain('업로드 가능')
    expect(source).not.toContain('검증 완료')
  })
})
