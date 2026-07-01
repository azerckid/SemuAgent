export const PAYROLL_UPLOAD_CHECKLIST_TEMPLATE_NAME = '급여정산 자료 기준 샘플'

export const PAYROLL_UPLOAD_BASELINE_ITEMS: Array<{ name: string; required: boolean }> = [
  { name: '직원 식별/고용정보(성명/사번/생년월일 또는 식별값/입사일/퇴사일)', required: true },
  { name: '조직/업무 정보(부서/직급/직명/담당업무/고용형태)', required: true },
  { name: '임금 기준자료(기본급/통상임금/소정근로시간/고정수당)', required: true },
  { name: '근로일수·근로시간 자료', required: true },
  { name: '연장·야간·휴일/주말 근무시간 자료', required: true },
  { name: '조퇴·지각·결근·휴직 등 미근로/변동 자료', required: true },
  { name: '연차 자료(미사용 연차/연차수당 대상일수/사용촉진 여부)', required: true },
  { name: '비과세 지급자료(식대/교통비 등 비과세 금액)', required: true },
  { name: '지급 변동자료(상여/성과급/일시수당/기타 지급)', required: true },
  { name: '4대보험 요율 및 상한/하한 기준자료', required: true },
  { name: '소득세/지방소득세 기준자료(근로소득 간이세액표/지방소득세 비율)', required: true },
  { name: '직원별 공제 적용값(부양가족/자녀수/보험가입/입퇴사월 공제)', required: true },
  { name: '직원별 기준보수월액(급여와 다른 경우)', required: true },
  { name: '회사별 계산규칙/취업규칙/근로계약 기준(있으면 회사 기준 우선)', required: false },
  { name: '이미 계산된 급여대장/공제전합계/충당액(검증용)', required: false },
  { name: '기타 급여 증빙자료', required: false },
]
