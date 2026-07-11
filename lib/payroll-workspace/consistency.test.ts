import { describe, expect, it } from 'vitest'
import { detectPayrollInsuranceConsistencyIssues } from './consistency'

const base = {
  id: 'line-1',
  displayName: '테스트',
  jobType: '정규직' as string | null,
  nationalPensionKrw: 0,
  healthInsuranceKrw: 0,
  longTermCareKrw: 0,
  employmentInsuranceKrw: 0,
}

describe('detectPayrollInsuranceConsistencyIssues', () => {
  it('정규직·일용직·프리랜서가 기대 범위에 맞으면 이슈가 없다', () => {
    const issues = detectPayrollInsuranceConsistencyIssues([
      { ...base, id: 'a', jobType: '정규직', nationalPensionKrw: 270_000, healthInsuranceKrw: 214_200, longTermCareKrw: 27_730, employmentInsuranceKrw: 54_000 },
      { ...base, id: 'b', jobType: '일용직', employmentInsuranceKrw: 19_800 },
      { ...base, id: 'c', jobType: '프리랜서' },
    ])
    expect(issues).toEqual([])
  })

  it('프리랜서에 4대보험이 부과되면 플래그한다(직원명부 해당없음 ↔ 급여 부과 부정합)', () => {
    const issues = detectPayrollInsuranceConsistencyIssues([
      { ...base, id: 'c', jobType: '프리랜서', employmentInsuranceKrw: 19_800 },
    ])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('프리랜서')
  })

  it('일용직에 국민연금·건강보험이 부과되면 플래그한다', () => {
    const issues = detectPayrollInsuranceConsistencyIssues([
      { ...base, id: 'b', jobType: '일용직', nationalPensionKrw: 100_000, employmentInsuranceKrw: 19_800 },
    ])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('고용보험만')
  })

  it('일용직 고용보험이 0원이면 플래그한다', () => {
    const issues = detectPayrollInsuranceConsistencyIssues([
      { ...base, id: 'b', jobType: '일용직' },
    ])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('고용보험이 0원')
  })

  it('정규직 4대보험 일부가 0원이면 플래그한다', () => {
    const issues = detectPayrollInsuranceConsistencyIssues([
      { ...base, id: 'a', jobType: '정규직', nationalPensionKrw: 270_000, healthInsuranceKrw: 0, employmentInsuranceKrw: 54_000 },
    ])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('정규직')
  })

  it('고용형태 미상(null)은 기대치가 없어 플래그하지 않는다', () => {
    const issues = detectPayrollInsuranceConsistencyIssues([
      { ...base, id: 'x', jobType: null, employmentInsuranceKrw: 19_800 },
    ])
    expect(issues).toEqual([])
  })
})
