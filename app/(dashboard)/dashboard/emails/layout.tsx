import { redirect } from 'next/navigation'

// JC-004: 레거시 GIWA(세무사무소) 워크플로 라우트. 회사 셀프사용 v1 범위 밖이라
// 회사 홈으로 차단(redirect)한다. 코드/공유 컴포넌트·API는 유지(v1 일부가 재사용).
export default function BlockedLegacyRouteLayout() {
  redirect('/dashboard')
}
