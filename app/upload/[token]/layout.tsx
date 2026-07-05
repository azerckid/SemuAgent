import { redirect } from 'next/navigation'

// JC-031 Slice 1: 외부 고객 업로드 포털(JARYO-GIWA 잔재). SemuAgent v1은 회사
// 내부 사용자가 직접 자료를 올리는 구조(/dashboard/direct-upload)라 v1 제외로
// 확정(quarantine). 코드/공유 API(/api/upload/*)는 유지 — direct-upload가
// 여전히 참조한다. 미인증 방문자는 /dashboard를 거쳐 /sign-in으로 안내된다.
export default function LegacyUploadPortalLayout() {
  redirect('/dashboard')
}
