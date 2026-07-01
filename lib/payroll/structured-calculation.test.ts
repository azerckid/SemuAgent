import { describe, expect, it } from 'vitest'
import { extractStructuredPayrollFromSourceTexts } from './structured-calculation'
import type { PayrollSourceText } from '@/lib/ai/payroll-extract'

describe('extractStructuredPayrollFromSourceTexts', () => {
  it('calculates a 2021 payroll draft from master and period-change sheets without AI', () => {
    const fileTexts: PayrollSourceText[] = [
      {
        filename: '급여관련테스트자료.xlsx',
        sheetName: '기초자료',
        text: [
          '## 시트: 기초자료',
          '1: 개인번호 | 성명 | 직급 | 직명 | 기본급 | 자격급 | 직책급 | 통상임금',
          '2: 118809719 | 이성기 | M급 | 지점장 | 2,253,000 | 1,128,000 | 1,557,000 | 4,938,000',
        ].join('\n'),
        summary: 'master',
      },
      {
        filename: '급여관련테스트자료.xlsx',
        sheetName: '2021-01_급여변동',
        text: [
          '## 시트: 2021-01_급여변동',
          '1: 급여기간 | 개인번호 | 이름 | 입퇴사기록 | 연장근로시간 | 주말근무시간 | 조퇴/지각 | 식대 | 비고',
          '2: 2021-01 | 118809719 | 이성기 |  | 30 | 8 |  | 200,000 |',
        ].join('\n'),
        summary: 'change',
      },
    ]

    const result = extractStructuredPayrollFromSourceTexts(fileTexts, '2021-01')

    expect(result?.success).toBe(true)
    const row = result?.data.rows[0]
    expect(row).toMatchObject({
      employeeCode: '118809719',
      employeeName: '이성기',
      baseSalary: 4938000,
      mealAllowance: 200000,
      deductionAmount: null,
      aiVerdict: 'pass',
    })
    expect(row?.otherAllowance).toBeNull()
    expect(row?.overtimeAllowance).toBe(1063206)
    expect(row?.holidayWorkAllowance).toBe(283522)
    expect(row?.memo).toContain('더존 업로드 양식')
    expect(row?.memo).toContain('고정급 합계')
    expect(row?.memo).toContain('세금/공제 기준자료')
    expect(result?.data.warnings.join('\n')).toContain('자료없음')
  })

  it('maps synonymous fixed monthly wage totals to the upload template base salary field', () => {
    const fileTexts: PayrollSourceText[] = [
      {
        filename: 'web3people_급여자료.xlsx',
        sheetName: '급여입력자료',
        text: [
          '## 시트: 급여입력자료',
          '1: 사원코드 | 사원명 | 직급 | 직명 | 본봉 | 자격수당 | 직책수당 | 월고정급',
          '2: WP-2021-001 | 김도윤 | M급 | 지점장 | 2,253,000 | 1,128,000 | 1,557,000 | 4,938,000',
        ].join('\n'),
        summary: 'input',
      },
    ]

    const result = extractStructuredPayrollFromSourceTexts(fileTexts, '2026-06')

    expect(result?.success).toBe(true)
    const row = result?.data.rows[0]
    expect(row).toMatchObject({
      employeeCode: 'WP-2021-001',
      employeeName: '김도윤',
      jobTitle: 'M급',
      jobType: '지점장',
      baseSalary: 4938000,
      aiVerdict: 'pass',
    })
    expect(row?.otherAllowance).toBeNull()
    expect(row?.memo).toContain('고정급 합계')
  })

  it('uses base input and attendance hours while ignoring precomputed variable amounts', () => {
    const fileTexts: PayrollSourceText[] = [
      {
        filename: '2026.06월 급여입력_솔메이트.xlsx',
        sheetName: '직원별급여',
        text: [
          '## 시트: 직원별급여',
          '1: 직원코드 | 성명 | 부서 | 직급 | 직종 | 입사일 | 급여일 | 기본급 | 상여 | 식대 | 식대 과세구분 | 고정연장수당 | 변동수당 | 교통비 | 공제금액 | 공제전합계 | 비고',
          '2: PAY-001 | 한은숙 | 경영지원팀 | 과장 | 상용직 | 2025-01-01 | 2026-06-25 | 3,200,000 | 0 | 200,000 | 비과세 | 300,000 | 75,000 | 100,000 | 0 | 3,875,000 | 6월 정기 급여',
        ].join('\n'),
        summary: 'input',
      },
      {
        filename: '2026.06월 변동수당_솔메이트.xlsx',
        sheetName: '변동수당',
        text: [
          '## 시트: 변동수당',
          '1: 직원코드 | 성명 | 부서 | 직급 | 직종 | 수당구분 | 기준일 | 근태대장 기준 시간 | 금액 | 과세구분 | 지급사유 | 검토포인트',
          '2: PAY-001 | 한은숙 | 경영지원팀 | 과장 | 상용직 | 연장근로수당 | 2026-06-25 | 4.00 | 75,000 | 과세 | 근태대장 기준 4시간 반영 | 급여입력 파일의 변동수당과 일치',
        ].join('\n'),
        summary: 'variable',
      },
    ]

    const result = extractStructuredPayrollFromSourceTexts(fileTexts, '2026-06')

    expect(result?.success).toBe(true)
    const row = result?.data.rows[0]
    expect(row).toMatchObject({
      employeeCode: 'PAY-001',
      employeeName: '한은숙',
      department: '경영지원팀',
      jobTitle: '과장',
      jobType: '상용직',
      baseSalary: 3200000,
      bonus: 0,
      mealAllowance: 200000,
      transportationAllowance: 100000,
      deductionAmount: null,
      aiVerdict: 'pass',
    })
    expect(row?.otherAllowance).toBeNull()
    expect(row?.overtimeAllowance).toBe(391866)
    expect(row?.memo).toContain('고정연장수당 300,000원은 연장근무 칸에 반영했습니다')
    expect(row?.memo).toContain('원본 변동수당 금액은 이미 계산된 값')
    expect(row?.memo).toContain('공제는 자료없음')
  })

  it('maps vehicle, retroactive, and childcare allowance columns to dedicated fields', () => {
    const fileTexts: PayrollSourceText[] = [
      {
        filename: '2026.06월 급여입력_수당확장.xlsx',
        sheetName: '직원별급여',
        text: [
          '## 시트: 직원별급여',
          '1: 직원코드 | 성명 | 부서 | 직급 | 직종 | 기본급 | 식대 | 차량유지비 | 급여인상분 소급적용 | 보육수당 | 비고',
          '2: PAY-010 | 김수당 | 경영지원팀 | 대리 | 상용직 | 2,800,000 | 200,000 | 200,000 | 150,000 | 100,000 | 6월 정기 급여',
        ].join('\n'),
        summary: 'input',
      },
    ]

    const result = extractStructuredPayrollFromSourceTexts(fileTexts, '2026-06')

    expect(result?.success).toBe(true)
    const row = result?.data.rows[0]
    expect(row).toMatchObject({
      employeeCode: 'PAY-010',
      employeeName: '김수당',
      baseSalary: 2800000,
      mealAllowance: 200000,
      vehicleMaintenanceAllowance: 200000,
      retroactivePay: 150000,
      childcareAllowance: 100000,
      aiVerdict: 'pass',
    })
    expect(row?.otherAllowance).toBeNull()
    expect(row?.overtimeAllowance).toBeNull()
  })

  it('extracts the requested month from a two-row monthly payroll ledger sheet', () => {
    const fileTexts: PayrollSourceText[] = [
      {
        filename: 'SampleB_급여자료입력_2603.xlsx',
        sheetName: '2026.03',
        text: [
          '## 시트: 2026.03',
          '범위: A1:U13',
          '1: 2026.03.01 ~ 2026.03.31 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |',
          '2: NO | 구분 | 성명 | 주민번호 | 입사일 | 퇴사일 | 급여일\n(입금일) | 고정급여 |  |  |  | 수습기간\n(70%) | 근무\n일수 | 제외\n일수 | 지급급여 |  |  |  | 은행명 | 계좌번호 | 비고',
          '3:  |  |  |  |  |  |  | 신고금액(합계) | 기본급 | 식대 | 고정 연장 |  |  |  | 기본급 | 식대 |  | 합계 |  |  |',
          '4: 1 | 근로 | 한은숙 |  | 2/1/26 |  | 4/5/26 | 3,500,000 | 3,500,000 |  |  | 부 | 31 |  | 3,500,000 | - |  | 3,500,000 | 하나은행 | 101-910594-78707 |',
          '5: 2 | 근로 | 박 순 |  | 2/1/26 |  | 4/5/26 | 2,816,667 | 2,816,667 |  |  | 부 | 31 |  | 2,816,667 | - |  | 2,816,667 | 중소기업은행 | 020-097282-01-014 |',
          '6: 3 | 사업 | 장혜진 |  | 3/19/26 |  | 4/5/26 | 3,500,000 | 2,860,669 | 200,000 | 439,331 | 여 | 31 | 18 | 839,745 | 128,965 |  | 968,710 |  |  | 4월 급여 계산시 1개월 잔여일수 70% 적용',
        ].join('\n'),
        summary: '2026.03 sheet',
      },
      {
        filename: 'SampleB_급여자료입력_2603.xlsx',
        sheetName: '2026.02',
        text: [
          '## 시트: 2026.02',
          '1: 2026.02.01 ~ 2026.02.28 |  |  |  |  |',
          '2: NO | 성명 | 주민번호 | 입사일 | 퇴사일 | 급여일 (입금일) | 고정급여 |  |  | 수습기간 (70%) | 근무 일수 | 제외 일수 | 지급급여 |  |  |  | 은행명 | 계좌번호 | 비고',
          '3:  |  |  |  |  |  | 신고금액(합계) | 기본급 | 식대 |  |  |  | 기본급 | 식대 |  | 합계 |  |  |',
          '4: 1 | 한은숙 | 730720-2710227 | 2/1/26 |  | 3/5/26 | 3,500,000 | 3,500,000 |  | 부 | 28 |  | 3,500,000 | - |  | 3,500,000 | 하나은행 | 101-910594-78707 |',
        ].join('\n'),
        summary: '2026.02 sheet',
      },
    ]

    const result = extractStructuredPayrollFromSourceTexts(fileTexts, '2026-03')

    expect(result?.success).toBe(true)
    expect(result?.data.rows).toHaveLength(3)
    expect(result?.data.rows.map((row) => row.employeeName)).toEqual(['한은숙', '박 순', '장혜진'])
    expect(result?.data.rows[0]).toMatchObject({
      employeeCode: null,
      employeeName: '한은숙',
      jobType: '근로',
      baseSalary: 3500000,
      deductionAmount: null,
      aiVerdict: 'pass',
    })
    expect(result?.data.rows[2]).toMatchObject({
      employeeName: '장혜진',
      jobType: '사업',
      baseSalary: 839745,
      mealAllowance: 128965,
      aiVerdict: 'pass',
    })
    expect(result?.data.rows[2]?.memo).toContain('월별 급여대장 2단 헤더')
  })

  it('calculates supported deductions when tax and deduction basis sheets are provided', () => {
    const fileTexts: PayrollSourceText[] = [
      {
        filename: '급여_기준자료.xlsx',
        sheetName: '직원별급여',
        text: [
          '## 시트: 직원별급여',
          '1: 직원코드 | 성명 | 부서 | 직급 | 직종 | 기본급 | 식대',
          '2: PAY-001 | 한은숙 | 경영지원팀 | 과장 | 상용직 | 3,000,000 | 200,000',
        ].join('\n'),
        summary: 'input',
      },
      {
        filename: '급여_기준자료.xlsx',
        sheetName: '세금공제기준',
        text: [
          '## 시트: 세금공제기준',
          '1: 항목 | 요율 | 하한 | 상한 | 적용기간',
          '2: 국민연금 | 4.5% | 390,000 | 6,170,000 | 2021',
          '3: 건강보험 | 3.545% |  |  | 2021',
          '4: 장기요양 | 12.95% |  |  | 2021',
          '5: 고용보험 | 0.9% |  |  | 2021',
          '6: 지방소득세 | 10% |  |  | 2021',
        ].join('\n'),
        summary: 'basis',
      },
      {
        filename: '급여_기준자료.xlsx',
        sheetName: '직원별세금공제',
        text: [
          '## 시트: 직원별세금공제',
          '1: 직원코드 | 성명 | 기준보수월액 | 부양가족수 | 자녀수 | 국민연금가입 | 건강보험가입 | 장기요양가입 | 고용보험가입 | 소득세 | 적용기간',
          '2: PAY-001 | 한은숙 | 3,000,000 | 1 | 0 | Y | Y | Y | Y | 50,000 | 2021-01',
        ].join('\n'),
        summary: 'profile',
      },
    ]

    const result = extractStructuredPayrollFromSourceTexts(fileTexts, '2021-01')

    expect(result?.success).toBe(true)
    const row = result?.data.rows[0]
    expect(row).toMatchObject({
      employeeCode: 'PAY-001',
      employeeName: '한은숙',
      baseSalary: 3000000,
      mealAllowance: 200000,
      nationalPension: 135000,
      healthInsurance: 106350,
      longTermCare: 13772,
      employmentInsurance: 27000,
      incomeTax: 50000,
      localIncomeTax: 5000,
      deductionAmount: 337122,
      aiVerdict: 'pass',
    })
    expect(row?.memo).toContain('국민연금')
    expect(row?.memo).toContain('건강보험')
    expect(row?.memo).toContain('장기요양')
    expect(row?.memo).toContain('고용보험')
    expect(row?.memo).toContain('소득세')
    expect(row?.memo).toContain('지방소득세')
    expect(result?.data.warnings.join('\n')).toContain('세금/공제 기준자료 일부')
  })

  it('calculates available deduction components and leaves missing components as no data', () => {
    const fileTexts: PayrollSourceText[] = [
      {
        filename: '급여_일부기준.xlsx',
        sheetName: '직원별급여',
        text: [
          '## 시트: 직원별급여',
          '1: 직원코드 | 성명 | 기본급',
          '2: PAY-001 | 한은숙 | 3,000,000',
        ].join('\n'),
        summary: 'input',
      },
      {
        filename: '급여_일부기준.xlsx',
        sheetName: '세금공제기준',
        text: [
          '## 시트: 세금공제기준',
          '1: 항목 | 요율 | 하한 | 상한 | 적용기간',
          '2: 국민연금 | 4.5% | 390,000 | 6,170,000 | 2021',
        ].join('\n'),
        summary: 'basis',
      },
    ]

    const result = extractStructuredPayrollFromSourceTexts(fileTexts, '2021-01')

    expect(result?.success).toBe(true)
    const row = result?.data.rows[0]
    expect(row).toMatchObject({
      employeeCode: 'PAY-001',
      employeeName: '한은숙',
      deductionAmount: 135000,
      aiVerdict: 'pass',
    })
    expect(row?.memo).toContain('국민연금')
    expect(row?.memo).toContain('자료없음')
    expect(row?.memo).toContain('건강보험')
  })

  it('does not apply exact-month deduction basis rows to a different payroll month', () => {
    const fileTexts: PayrollSourceText[] = [
      {
        filename: '급여_월별기준.xlsx',
        sheetName: '직원별급여',
        text: [
          '## 시트: 직원별급여',
          '1: 직원코드 | 성명 | 기본급',
          '2: PAY-001 | 한은숙 | 3,000,000',
        ].join('\n'),
        summary: 'input',
      },
      {
        filename: '급여_월별기준.xlsx',
        sheetName: '세금공제기준',
        text: [
          '## 시트: 세금공제기준',
          '1: 항목 | 요율 | 하한 | 상한 | 적용기간',
          '2: 국민연금 | 4.5% | 390,000 | 6,170,000 | 2021-01',
          '3: 국민연금 | 5% | 390,000 | 6,170,000 | 2021-02',
        ].join('\n'),
        summary: 'basis',
      },
    ]

    const result = extractStructuredPayrollFromSourceTexts(fileTexts, '2021-02')

    expect(result?.success).toBe(true)
    expect(result?.data.rows[0]?.deductionAmount).toBe(150000)
    expect(result?.data.rows[0]?.memo).toContain('요율 5%')
  })

  it('calculates statutory night, annual leave, and late/early draft amounts from source inputs', () => {
    const fileTexts: PayrollSourceText[] = [
      {
        filename: '급여_법정기본수당.xlsx',
        sheetName: '직원별급여',
        text: [
          '## 시트: 직원별급여',
          '1: 직원코드 | 성명 | 기본급 | 통상임금',
          '2: PAY-001 | 한은숙 | 3,000,000 | 3,000,000',
        ].join('\n'),
        summary: 'input',
      },
      {
        filename: '급여_법정기본수당.xlsx',
        sheetName: '2026-06_급여변동',
        text: [
          '## 시트: 2026-06_급여변동',
          '1: 급여기간 | 직원코드 | 성명 | 야간근무시간 | 미사용연차일수 | 조퇴/지각',
          '2: 2026-06 | PAY-001 | 한은숙 | 10 | 2 | 조퇴 1시간 지각 30분',
        ].join('\n'),
        summary: 'change',
      },
    ]

    const result = extractStructuredPayrollFromSourceTexts(fileTexts, '2026-06')

    expect(result?.success).toBe(true)
    const row = result?.data.rows[0]
    expect(row).toMatchObject({
      employeeCode: 'PAY-001',
      employeeName: '한은숙',
      baseSalary: 3000000,
      nightWorkAllowance: 71770,
      annualLeaveAllowance: 229665,
      deductionAmount: null,
      aiVerdict: 'pass',
    })
    expect(row?.memo).toContain('야간근무수당')
    expect(row?.memo).toContain('연차수당')
    expect(row?.memo).toContain('조퇴/지각 기본 차감 초안')
    expect(row?.memo).toContain('21,531원')
  })

  it('extracts DY-style personnel payroll sheets with wage-item two-row headers without AI', () => {
    const fileTexts: PayrollSourceText[] = [
      {
        filename: 'DY_5월 급여 TEST.xlsx',
        sheetName: '인적사항',
        text: [
          '## 시트: 인적사항',
          '6:  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | 귀속 : 2026년 5월 |  |  |  |',
          '8: 순번 | 성명 |  |  |  |  |  |  |  |  |  |  | 임금 항목(단위 : 원) |  |  |  |  |  |  |  |  |  |  |  | 공제항목 |  |  |  |  |  |  |  |  |  |  |  |',
          '9:  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | 기본급 |  |  |  | 식대 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |',
          '10: 3 | 직 위 |  |  |  |  |  |  |  |  |  |  |  |  |  | 1,234,567 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |',
          '11: 1 | 대표이사 |  |  |  |  |  |  |  |  |  |  |  |  |  | 5,000,000 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |',
          '12: 2 | 김은주 |  |  |  |  |  |  |  |  |  |  |  |  |  | 2,740,000 |  |  |  | 200,000 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |',
        ].join('\n'),
        summary: 'personnel',
      },
    ]

    const result = extractStructuredPayrollFromSourceTexts(fileTexts, '2026-05')

    expect(result?.success).toBe(true)
    expect(result?.data.rows).toHaveLength(2)
    expect(result?.data.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeName: '대표이사',
          baseSalary: 5000000,
          aiVerdict: 'pass',
        }),
        expect.objectContaining({
          employeeName: '김은주',
          baseSalary: 2740000,
          mealAllowance: 200000,
          aiVerdict: 'pass',
        }),
      ]),
    )
    expect(result?.data.rows[0]?.memo).toContain('인적사항(임금 항목) 2단 헤더')
  })

  it('returns null when no structured payroll sheet is recognized', () => {
    const result = extractStructuredPayrollFromSourceTexts([
      {
        filename: 'memo.xlsx',
        sheetName: '메모',
        text: '1: 제목 | 내용\n2: 테스트 | 급여와 무관',
        summary: 'memo',
      },
    ], '2026-06')

    expect(result).toBeNull()
  })
})
