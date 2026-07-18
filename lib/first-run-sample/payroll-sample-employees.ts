export type SampleEmploymentType = '정규직' | '프리랜서' | '일용직'

export type SampleEmployeeSpec = {
  code: string
  name: string
  department: string
  jobTitle: string
  employmentType: SampleEmploymentType
  baseSalaryKrw: number
  allowanceKrw: number
  mealAllowanceKrw?: number
  dependentCount?: number
  dailyWageKrw?: number
  workDays?: number
  needsReview?: boolean
}

// First-run sample payroll source. Kept separate from DB seeding so upload fixtures
// can render the same original payroll values without importing database code.
export const FIRST_RUN_SAMPLE_EMPLOYEES: SampleEmployeeSpec[] = [
  { code: 'E001', name: '김대표', department: '경영', jobTitle: '대표', employmentType: '정규직', baseSalaryKrw: 6_000_000, allowanceKrw: 0, mealAllowanceKrw: 200_000, dependentCount: 4 },
  { code: 'E002', name: '이수민', department: '영업', jobTitle: '팀장', employmentType: '정규직', baseSalaryKrw: 4_200_000, allowanceKrw: 200_000, mealAllowanceKrw: 200_000, dependentCount: 3 },
  { code: 'E003', name: '박지훈', department: '운영', jobTitle: '매니저', employmentType: '정규직', baseSalaryKrw: 3_400_000, allowanceKrw: 200_000, mealAllowanceKrw: 200_000, dependentCount: 2 },
  { code: 'E004', name: '최민준', department: '제품', jobTitle: '매니저', employmentType: '정규직', baseSalaryKrw: 3_000_000, allowanceKrw: 0, mealAllowanceKrw: 200_000, dependentCount: 1 },
  { code: 'E005', name: '정하늘', department: '영업', jobTitle: '사원', employmentType: '정규직', baseSalaryKrw: 2_600_000, allowanceKrw: 200_000, mealAllowanceKrw: 200_000, dependentCount: 2 },
  { code: 'E006', name: '오세린', department: '운영', jobTitle: '사원', employmentType: '정규직', baseSalaryKrw: 2_400_000, allowanceKrw: 0, mealAllowanceKrw: 200_000, dependentCount: 1 },
  { code: 'E007', name: '한유진', department: '제품', jobTitle: '외주 디자이너', employmentType: '프리랜서', baseSalaryKrw: 3_500_000, allowanceKrw: 0 },
  { code: 'E008', name: '서도윤', department: '제품', jobTitle: '외주 개발', employmentType: '프리랜서', baseSalaryKrw: 2_000_000, allowanceKrw: 0 },
  { code: 'E009', name: '문가람', department: '운영', jobTitle: '일용 작업', employmentType: '일용직', baseSalaryKrw: 2_200_000, allowanceKrw: 0, dailyWageKrw: 200_000, workDays: 11 },
  { code: 'E010', name: '장서우', department: '운영', jobTitle: '일용 작업', employmentType: '일용직', baseSalaryKrw: 2_600_000, allowanceKrw: 0, dailyWageKrw: 200_000, workDays: 13 },
  { code: 'E011', name: '윤태오', department: '물류', jobTitle: '일용 작업', employmentType: '일용직', baseSalaryKrw: 2_040_000, allowanceKrw: 0, dailyWageKrw: 170_000, workDays: 12 },
]
