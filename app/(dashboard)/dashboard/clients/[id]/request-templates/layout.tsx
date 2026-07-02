import { redirect } from 'next/navigation'

// JC-004: GIWA 요청 템플릿 작성 화면은 회사 셀프사용 v1 노출 범위 밖이다.
export default function BlockedClientRequestTemplatesLayout() {
  redirect('/dashboard/clients')
}
