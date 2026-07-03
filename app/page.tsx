const operatingFlow = [
  "자료 수집",
  "AI 분류·기장검토",
  "부가세 계산",
  "급여정산",
  "신고지원",
  "접수증 보관",
]

const reuseTracks = [
  {
    title: "기장 엔진",
    body: "JARYO-GIWA의 bookkeeping 모듈을 회사 단위 거래 AI 분류와 검토 가능한 전표 초안의 출발점으로 재사용합니다.",
  },
  {
    title: "급여 처리",
    body: "payroll 모듈의 엑셀 구조화, 급여자료 추출, 건강보험 고지액 반영, 명세서 초안 흐름을 회사 내부 담당자 UX로 재구성합니다.",
  },
  {
    title: "증빙·AI 검토",
    body: "AI 추출, 파일 파싱, 누락·검토 상태 모델은 유지하되 회사가 직접 신고를 준비하는 책임 경계로 바꿉니다.",
  },
]

const guardrails = [
  "홈택스 계정·공동인증서·비밀번호를 서버에 저장하지 않습니다.",
  "초기 제품은 신고 자동 제출이 아니라 신고자료 패키지와 제출 보조를 제공합니다.",
  "세무대리 표현을 피하고 회사가 직접 신고하기 위한 계산·검토 도구로 설계합니다.",
]

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 py-12 sm:px-10 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-primary">SemuAgent</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
              작은 회사의 세무신고 준비를 AI가 끝까지 정리합니다
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              SemuAgent는 증빙 수집, AI 분류, 기장검토, 부가세, 급여정산, 신고자료 패키지 생성을 한 흐름으로 묶습니다.
              회사 내부 담당자가 직접 확인하고 홈택스 제출을 준비할 수 있게 만드는 AI 세무 에이전트입니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {operatingFlow.map((step) => (
                <span
                  key={step}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground"
                >
                  {step}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground">MVP 기준</h2>
            <div className="mt-5 space-y-4">
              {guardrails.map((item) => (
                <div key={item} className="flex gap-3">
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="mt-14 grid gap-4 md:grid-cols-3">
          {reuseTracks.map((track) => (
            <article key={track.title} className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-card-foreground">{track.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{track.body}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}
