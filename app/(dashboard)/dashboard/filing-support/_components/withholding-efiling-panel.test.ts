import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'app/(dashboard)/dashboard/filing-support/_components/withholding-efiling-panel.tsx'),
  'utf8',
)

describe('withholding-efiling-panel Hometax input guide (JC-030)', () => {
  it('does not reference the abandoned Path 1a conversion-upload flow', () => {
    for (const forbidden of [
      '바이너리 레이아웃',
      '변환 파일제출',
      '변환제출',
      '전자신고 파일 다운로드',
      'HOMETAX_WITHHOLDING_UPLOAD_STEPS',
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  it('maps the Hometax route, basic information, and A01 fields to live values', () => {
    for (const required of [
      '세금신고 → 원천세 신고 → 일반 신고 → 정기신고',
      '① 신고구분',
      '② 귀속연월',
      '③ 지급연월',
      '간이세액(A01) → ④ 인원',
      '간이세액(A01) → ⑤ 총지급액',
      '간이세액(A01) → ⑥ 소득세 등',
      'efiling.paymentLabel',
      'efiling.businessName',
      'efiling.representativeName',
    ]) {
      expect(source).toContain(required)
    }
  })

  it('separates local income tax into the Wetax flow', () => {
    expect(source).toContain('위택스 별도 신고')
    expect(source).toContain('홈택스 원천세 신고서에 합산하지 않습니다')
    expect(source).toContain('efiling.localIncomeTaxKrw')
  })

  it('does not exclude field-location guidance or duplicate the old summary cards', () => {
    expect(source).not.toContain('홈택스 메뉴·입력칸 위치 단계별 안내')
    expect(source).not.toContain('A01 확정 인원')
    expect(source).not.toContain('제공 경로 상태')
  })
})
