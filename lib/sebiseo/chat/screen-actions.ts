import type { SebiseoSuggestedAction } from './schemas'

// CUI-3c: 세비서 답변 아래 표시하는 화면 이동 버튼.
// 서버 고정 허용목록에서만 도출한다 — AI 출력은 화면·URL을 만들지 못한다.
// href는 sidebar.tsx의 현재 SemuAgent 화면 라우트와 일치해야 한다(드리프트 가드 테스트로 고정).
//
// 스키마 상한은 3이지만 런타임은 화면이 복잡해지지 않게 최대 2개만 노출한다.
export const SEBISEO_MAX_RENDERED_ACTIONS = 2

type ScreenActionDefinition = SebiseoSuggestedAction & {
  readonly keywords: readonly string[]
}

// 순서 = 우선순위. 명확한 세목 상세 화면을 포괄 허브보다 먼저 둔다
// (지급명세서·연말정산·지방소득세·사업장현황신고 → 상세, 포괄 연간신고 → 허브).
const SEBISEO_SCREEN_ACTIONS: readonly ScreenActionDefinition[] = [
  {
    id: 'source-collection',
    label: '자료수집 열기',
    href: '/dashboard/direct-upload',
    keywords: ['자료수집', '업로드', '첨부', '파일 올', '파일올', '파일 어떻게'],
  },
  {
    id: 'reconciliation-ledger',
    label: '자료대조원장 열기',
    href: '/dashboard/bookkeeping/reconciliation-ledger',
    keywords: ['자료대조', '대조원장', '원장', '증빙'],
  },
  {
    id: 'bookkeeping',
    label: '기장검토 열기',
    href: '/dashboard/bookkeeping',
    keywords: ['기장검토', '기장', '계정과목', '분류', '전표'],
  },
  {
    id: 'vat',
    label: '부가세 열기',
    href: '/dashboard/vat',
    keywords: ['부가세', '부가가치세', '매입세액', '매출세액', '공제', '불공제', '안분', '과세유형'],
  },
  {
    id: 'withholding',
    label: '원천세 열기',
    href: '/dashboard/filing-support',
    keywords: ['원천세', '원천징수'],
  },
  {
    id: 'payment-statements',
    label: '지급명세서 열기',
    href: '/dashboard/filing-preparation/payment-statements',
    keywords: ['지급명세서', '지급명세'],
  },
  {
    id: 'year-end-settlement',
    label: '연말정산 열기',
    href: '/dashboard/filing-preparation/year-end-settlement',
    keywords: ['연말정산'],
  },
  {
    id: 'local-income-tax',
    label: '지방소득세 열기',
    href: '/dashboard/filing-preparation/local-income-tax',
    keywords: ['지방소득세'],
  },
  {
    id: 'business-status-report',
    label: '사업장현황신고 열기',
    href: '/dashboard/filing-preparation/business-status-report',
    keywords: ['사업장현황', '현황신고'],
  },
  {
    id: 'employees',
    label: '직원 명부 열기',
    href: '/dashboard/employees',
    keywords: ['직원 명부', '직원명부', '직원'],
  },
  {
    id: 'payroll',
    label: '급여·지급 열기',
    href: '/dashboard/payroll',
    keywords: ['급여', '4대보험'],
  },
  {
    id: 'annual-filing',
    label: '연간신고 열기',
    href: '/dashboard/filing-preparation',
    keywords: ['연간신고', '법인세', '종합소득세'],
  },
]

/** 드리프트 가드·테스트용으로 고정 허용목록을 노출한다. */
export function listSebiseoScreenActions(): readonly ScreenActionDefinition[] {
  return SEBISEO_SCREEN_ACTIONS
}

/**
 * 사용자 메시지에서 관련 화면 이동 버튼을 도출한다.
 *
 * - 고정 목록 순서(명확한 세목 우선)대로 키워드가 포함되면 채택한다.
 * - 같은 href는 한 번만, 최대 SEBISEO_MAX_RENDERED_ACTIONS개까지.
 * - 일치가 없으면 빈 배열(버튼 미표시).
 */
export function resolveSebiseoScreenActions(message: string): SebiseoSuggestedAction[] {
  const matched: SebiseoSuggestedAction[] = []
  const seenHrefs = new Set<string>()

  for (const action of SEBISEO_SCREEN_ACTIONS) {
    if (matched.length >= SEBISEO_MAX_RENDERED_ACTIONS) break
    if (seenHrefs.has(action.href)) continue
    if (action.keywords.some((keyword) => message.includes(keyword))) {
      seenHrefs.add(action.href)
      matched.push({ id: action.id, label: action.label, href: action.href })
    }
  }

  return matched
}
