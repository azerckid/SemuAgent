export const siteConfig = {
  name: "SemuAgent",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://semuagent.app").replace(/\/$/, ""),
  title: "SemuAgent - 작은 회사를 위한 AI 세무 에이전트",
  description:
    "작은 회사가 증빙 수집, AI 분류, 기장검토, 부가세, 급여정산, 신고자료 패키지 생성을 한 흐름으로 준비하도록 돕는 세무 업무 에이전트.",
  shortDescription:
    "작은 회사가 직접 세무신고를 준비할 수 있도록 AI가 증빙, 기장, 부가세, 급여, 신고자료를 정리합니다.",
  locale: "ko_KR",
  keywords: [
    "SemuAgent",
    "세무 에이전트",
    "AI 세무",
    "세무신고 준비",
    "홈택스 신고 보조",
    "자가 기장",
    "부가세 계산",
    "급여정산",
    "증빙 수집",
    "신고자료 생성",
    "소규모 회사 세무",
  ],
} as const

export function absoluteUrl(path = "/") {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`
}
