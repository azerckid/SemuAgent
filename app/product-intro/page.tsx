import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  FileCheck2,
  FileSpreadsheet,
  Landmark,
  MailCheck,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'SemuAgent | 작은 회사를 위한 AI 세무 에이전트',
  description:
    'SemuAgent는 작은 회사가 증빙 수집, AI 분류, 기장검토, 부가세, 급여정산, 신고자료 생성을 직접 준비하도록 돕는 세무 업무 에이전트입니다.',
  alternates: { canonical: '/product-intro' },
}

const workflowSteps = [
  {
    title: '증빙 수집',
    description: '세금계산서, 카드, 통장, 영수증, 급여자료를 회사 내부 업로드 흐름으로 모읍니다.',
    badge: 'collect',
  },
  {
    title: 'AI 분류·기장검토',
    description: 'AI가 거래와 자료 유형을 분류하고, 담당자가 추천 계정과목과 신뢰도를 확인합니다.',
    badge: 'review',
  },
  {
    title: '부가세·급여 정산',
    description: '매출·매입세액, 공제 검토, 급여대장, 보험료 고지액 반영 상태를 한곳에서 확인합니다.',
    badge: 'calculate',
  },
  {
    title: '신고자료 패키지',
    description: '홈택스 입력에 필요한 신고자료, 첨부 패키지, 접수증 보관 체크리스트를 정리합니다.',
    badge: 'package',
  },
]

const problemCards = [
  {
    label: '자료 흩어짐',
    tone: 'red',
    title: '세무자료가 메일, 엑셀, 파일함에 흩어집니다.',
    description:
      '대표나 운영 담당자가 신고 마감 전에 무엇이 빠졌는지 다시 확인하느라 시간을 씁니다.',
  },
  {
    label: '판단 지연',
    tone: 'amber',
    title: '분류와 공제 검토가 늦어지면 신고 준비가 멈춥니다.',
    description:
      '거래 분류, 매입세액 공제, 급여 공제액 확인이 늦으면 납부 예정액과 제출 패키지를 확정하기 어렵습니다.',
  },
  {
    label: '책임 경계',
    tone: 'blue',
    title: '자동 제출보다 중요한 것은 검토 가능한 준비 흐름입니다.',
    description:
      'SemuAgent는 홈택스 계정이나 인증서를 저장하지 않고, 사용자가 직접 제출할 수 있는 자료와 가이드를 정리합니다.',
  },
]

const comparisonRows = [
  {
    label: '주 사용자',
    manual: '대표·운영 담당자가 엑셀과 파일함으로 직접 관리',
    erp: '기업 내부 회계·ERP 사용자',
    taxOffice: '외부 세무대리인 중심',
    semuAgent: '작은 회사의 대표, 재무·운영 담당자',
  },
  {
    label: '중심 업무',
    manual: '자료 모으기와 마감 체크를 수동 반복',
    erp: '전사 회계·인사·경영관리',
    taxOffice: '대리 신고와 장부 처리 위탁',
    semuAgent: '증빙 수집, AI 분류, 기장검토, 부가세, 급여, 신고자료 패키지',
  },
  {
    label: 'AI 역할',
    manual: '없음',
    erp: '업무 보조 기능 일부',
    taxOffice: '사무소 내부 자동화에 의존',
    semuAgent: '누락 확인, 자료 분류, 계산 초안, 리마인드, 신고 준비 업데이트',
  },
  {
    label: '제출 책임',
    manual: '사용자가 직접 확인·제출',
    erp: '제품별 상이',
    taxOffice: '세무대리 계약 범위에 따름',
    semuAgent: '사용자가 최종 확인하고 홈택스에서 직접 제출·납부',
  },
]

const features = [
  {
    icon: FileCheck2,
    title: '자료수집 완결성',
    description: '필요 자료, 미수집 항목, 파싱 오류, 정규화 상태를 신고 기간별로 보여줍니다.',
  },
  {
    icon: Sparkles,
    title: 'AI 기장검토',
    description: '거래별 추천 계정과목, 신뢰도, 분개 미리보기를 제공하고 사용자가 확정합니다.',
  },
  {
    icon: Landmark,
    title: '부가세 준비',
    description: '매출·매입세액, 불공제 후보, 안분 필요 항목, 부속 명세 상태를 정리합니다.',
  },
  {
    icon: FileSpreadsheet,
    title: '급여정산',
    description: '급여대장, 원천세, 4대보험, 건강보험 EDI 고지액 반영 흐름을 관리합니다.',
  },
  {
    icon: MailCheck,
    title: '내부 리마인드',
    description: '신고 마감, 미수집 자료, 급여 확인 필요 항목을 담당자에게 자가 리마인드합니다.',
  },
  {
    icon: Network,
    title: '신고지원 패키지',
    description: '업로드용 신고 준비값, 첨부 패키지, 접수증 보관, 사후 체크리스트를 연결합니다.',
  },
]

function toneClass(tone: string) {
  if (tone === 'red') return 'bg-red-50 text-red-700 border-red-100'
  if (tone === 'amber') return 'bg-amber-50 text-amber-700 border-amber-100'
  return 'bg-blue-50 text-blue-700 border-blue-100'
}

export default function ProductIntroPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid min-h-[520px] w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div>
            <div className="inline-flex h-8 items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 text-sm font-extrabold text-blue-700">
              <Building2 className="size-4" />
              작은 회사를 위한 AI 세무 에이전트
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.06] tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              SemuAgent는 세무신고 준비를 검토 가능한 AI 업무 흐름으로 정리합니다.
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-slate-600">
              작은 회사가 증빙 수집부터 기장검토, 부가세, 급여정산, 신고자료 패키지까지 직접 준비할 수 있도록 돕습니다.
              AI는 초안을 만들고 누락을 알려주며, 최종 제출과 납부는 사용자가 확인합니다.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {['증빙 수집', 'AI 분류', '기장검토', '부가세', '급여정산', '신고지원'].map((item) => (
                <span key={item} className="inline-flex min-h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl shadow-slate-900/10">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
              <div>
                <strong className="block text-base">AI-assisted tax preparation flow</strong>
                <span className="mt-1 block text-sm text-slate-500">AI가 정리하고, 회사가 검토·확정합니다.</span>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">MVP</span>
            </div>
            <div className="grid gap-3 p-5">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <span className="grid size-9 place-items-center rounded-full bg-blue-50 text-sm font-black text-blue-700">{index + 1}</span>
                  <div>
                    <strong className="block text-sm">{step.title}</strong>
                    <span className="text-xs text-slate-500">{step.description}</span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-extrabold text-slate-600">{step.badge}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <h2 className="text-3xl font-black tracking-normal">문제는 신고 버튼이 아니라, 신고 전 준비가 흩어지는 것입니다.</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            SemuAgent는 자동 세무대리가 아니라, 회사가 직접 신고하기 전에 필요한 자료·검토·계산·패키지를 한 화면 흐름으로 묶는 업무 에이전트입니다.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {problemCards.map((card) => (
            <article key={card.title} className="min-h-48 rounded-lg border border-slate-200 bg-white p-5">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${toneClass(card.tone)}`}>{card.label}</span>
              <h3 className="mt-4 text-lg font-black">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <h2 className="text-3xl font-black tracking-normal">포지션</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            SemuAgent는 범용 ERP나 세무대리 서비스가 아니라, 작은 회사의 세무신고 준비 업무를 AI로 정리하는 제품입니다.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="border-b border-slate-200 px-4 py-3">구분</th>
                <th className="border-b border-slate-200 px-4 py-3">수동 관리</th>
                <th className="border-b border-slate-200 px-4 py-3">일반 ERP/HR</th>
                <th className="border-b border-slate-200 px-4 py-3">세무대리 위탁</th>
                <th className="border-b border-slate-200 bg-blue-50/60 px-4 py-3 text-blue-800">SemuAgent</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label}>
                  <td className="border-b border-slate-100 px-4 py-4 font-black">{row.label}</td>
                  <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{row.manual}</td>
                  <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{row.erp}</td>
                  <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{row.taxOffice}</td>
                  <td className="border-b border-slate-100 bg-blue-50/40 px-4 py-4 font-extrabold text-slate-950">{row.semuAgent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <h2 className="text-3xl font-black tracking-normal">SemuAgent가 정리하는 업무</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            승인된 v1 워크스페이스를 기준으로, 자료수집부터 신고지원까지 회사 내부 사용자가 확인 가능한 흐름으로 연결합니다.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <article key={feature.title} className="grid min-h-32 grid-cols-[44px_minmax(0,1fr)] gap-4 rounded-lg border border-slate-200 bg-white p-5">
                <span className="grid size-11 place-items-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-6 py-12 lg:grid-cols-2 lg:px-8">
        <div className="rounded-xl border border-blue-200 bg-linear-to-b from-white to-blue-50 p-7">
          <p className="text-2xl font-black leading-9 text-blue-950">
            SemuAgent는 작은 회사가 세무신고를 준비하는 반복 업무를 AI-assisted 운영 흐름으로 바꾸는 세무 업무 에이전트입니다.
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <strong className="block text-amber-800">표현 기준</strong>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                SemuAgent는 자동 신고·자동 납부 제품이 아닙니다. AI는 증빙 정리, 누락 확인, 계산 초안, 신고자료 준비를 돕고,
                최종 제출·납부와 법적 판단은 사용자가 확인합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-8 text-sm text-slate-500 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <strong className="block text-slate-700">SemuAgent</strong>
            <p className="mt-1">작은 회사를 위한 AI 세무신고 준비 에이전트</p>
          </div>
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700"
          >
            홈으로
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </footer>
    </main>
  )
}
