import { requireTenantSession } from '@/lib/auth-helpers'
import { STANDING_DISCLAIMER } from '@/lib/ai/consultation/disclaimer'
import { LawSearchChat } from './_components/law-search-chat'

export default async function LawSearchPage() {
  // 내부 직원 전용 — 레이아웃 인증에 더해 테넌트 세션을 확인한다.
  await requireTenantSession()

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-3xl flex-col px-4 py-6">
      <header className="mb-2">
        <h1 className="text-lg font-bold text-foreground">법령 검색</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          질문하면 국가법령정보센터(law.go.kr)에서 관련 법령 조문을 찾아 요약합니다. 내부 참고용입니다.
        </p>
      </header>

      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
        {STANDING_DISCLAIMER}
      </p>

      <LawSearchChat />
    </div>
  )
}
