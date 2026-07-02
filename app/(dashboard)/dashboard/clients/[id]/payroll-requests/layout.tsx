import { redirect } from 'next/navigation'

// JC-004: 급여는 회사용 /dashboard/payroll 워크스페이스에서 처리한다.
export default function BlockedClientPayrollRequestsLayout() {
  redirect('/dashboard/clients')
}
