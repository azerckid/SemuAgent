import { redirect } from 'next/navigation'

// JC-004: 사업장 관리는 유지하지만 GIWA 고객 요청 이벤트 워크플로는 v1 노출 범위 밖이다.
export default function BlockedClientRequestEventsLayout() {
  redirect('/dashboard/clients')
}
