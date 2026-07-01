import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const PAYROLL_LEGAL_BASIS_ROWS = [
  {
    column: 'F',
    item: '기본급',
    law: '근로기준법 제17조, 제43조 / 최저임금법 제6조',
    aiHandling: '근로계약·원자료 금액을 사용합니다. 기본급을 임의로 만들지 않고, source가 있으면 최저임금 검토 메모만 남길 수 있습니다.',
  },
  {
    column: 'G',
    item: '상여',
    law: '근로기준법 제17조',
    aiHandling: '법정 기본 지급액이 없습니다. 사내규정·계약·월별 원자료 금액이 있을 때만 반영합니다.',
  },
  {
    column: 'H',
    item: '식대',
    law: '소득세법 제12조 / 소득세법 시행령 제17조의2',
    aiHandling: '세법은 지급 의무를 만들지 않습니다. 회사가 지급한다고 명시한 금액만 사용하고, 지급된 금액의 비과세 한도를 판단합니다.',
  },
  {
    column: 'I',
    item: '교통비',
    law: '소득세법 시행령 제12조',
    aiHandling: '지급 의무가 아니라 실비변상 판단 대상입니다. 원자료 금액이 있을 때만 사용하고, 실비변상 조건이 확인될 때 세무처리합니다.',
  },
  {
    column: 'J',
    item: '휴일근무',
    law: '근로기준법 제56조',
    aiHandling: '법정 기준은 8시간 이내 통상시급 x 휴일근로시간 x 1.5, 8시간 초과분은 통상시급 x 초과시간 x 2.0입니다. 직원별 시간 입력과 담당자 확인 없이는 자동 적용하지 않습니다.',
  },
  {
    column: 'K',
    item: '국내출장',
    law: '소득세법 시행령 제12조',
    aiHandling: '지급 의무가 아니라 실비변상 판단 대상입니다. 출장비 원자료가 있을 때만 사용하고 조건이 확인될 때 비과세/실비변상으로 봅니다.',
  },
  {
    column: 'L',
    item: '연차수당',
    law: '근로기준법 제60조, 제61조',
    aiHandling: '법정 기준은 1일 통상임금 x 미사용 연차일수입니다. 미사용 연차일수와 통상임금 또는 기본급이 없으면 자동 적용하지 않고, unrelated summary sheet에서 연차일수를 임의 추정하지 않습니다.',
  },
  {
    column: 'M',
    item: '연구개발비',
    law: '소득세법 제12조 / 소득세법 시행령 제12조',
    aiHandling: '지급 의무가 아닙니다. 회사 지급 근거와 적격 연구지원 조건이 있을 때만 원자료 금액을 사용하고 세무처리합니다.',
  },
  {
    column: 'N',
    item: '기타수당',
    law: '근로기준법 제17조',
    aiHandling: '법정 기본 지급액이 없습니다. 사내규정·계약·월별 원자료 금액이 있을 때만 반영하고, 없으면 만들지 않습니다.',
  },
  {
    column: 'O',
    item: '성과인센티브',
    law: '근로기준법 제17조',
    aiHandling: '법정 기본 지급액이 없습니다. 회사 결정·계약·원자료 금액이 있을 때만 반영합니다.',
  },
  {
    column: 'P',
    item: '심야근무',
    law: '근로기준법 제56조',
    aiHandling: '법정 기준은 통상시급 x 야간근로시간 x 0.5입니다. 직원별 야간근로시간과 통상시급 근거가 없으면 자동 적용하지 않습니다.',
  },
  {
    column: 'Q',
    item: '차량유지비',
    law: '소득세법 시행령 제12조',
    aiHandling: '지급 의무가 아니라 실비변상 판단 대상입니다. 원자료 금액과 자가운전보조 등 조건이 있을 때만 세무처리합니다.',
  },
  {
    column: 'R',
    item: '급여인상분 소급적용',
    law: '근로기준법 제17조, 제43조',
    aiHandling: '법정 기본 지급액이 없습니다. 임금 조건 변경·회사 결정·원자료 금액이 있을 때만 반영합니다.',
  },
  {
    column: 'S',
    item: '연장근무',
    law: '근로기준법 제53조, 제56조',
    aiHandling: '법정 기준은 통상시급 x 연장근로시간 x 1.5입니다. 직원별 연장근로시간과 통상시급 근거가 없으면 자동 적용하지 않습니다.',
  },
  {
    column: 'T',
    item: '보육수당',
    law: '소득세법 제12조',
    aiHandling: '세법상 비과세 판단 대상일 수 있지만 지급 의무는 아닙니다. 회사 지급 금액과 조건이 있을 때만 사용합니다.',
  },
] as const

export function ClientPayrollLegalBasisPanel() {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="font-semibold text-gray-950">법적기준</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          사내급여기준이 없거나 월별 원자료만 있는 경우 AI가 참고해야 하는 더존 F~T 지급 항목의 법령·처리 기준입니다.
        </p>
      </div>
      <div className="overflow-x-auto p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">컬럼</TableHead>
              <TableHead className="min-w-32">항목</TableHead>
              <TableHead className="min-w-56">관련법령</TableHead>
              <TableHead className="min-w-[28rem]">AI가 알아야 할 처리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PAYROLL_LEGAL_BASIS_ROWS.map((row) => (
              <TableRow key={row.column}>
                <TableCell className="font-mono text-xs font-semibold text-gray-700">{row.column}</TableCell>
                <TableCell className="font-medium text-gray-950">{row.item}</TableCell>
                <TableCell className="text-sm text-gray-700">{row.law}</TableCell>
                <TableCell className="text-sm leading-6 text-gray-700">{row.aiHandling}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
