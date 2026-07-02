import { redirect } from 'next/navigation'

// JC-004: 정기 요청 메일 스케줄은 회사 셀프사용 v1 노출 범위 밖이다.
export default function BlockedClientRequestSchedulesLayout() {
  redirect('/dashboard/clients')
}
