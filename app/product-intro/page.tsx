import type { Metadata } from 'next'
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
  title: 'JARYO | 회계사무실 AX 업무자동화 플랫폼',
  description: 'JARYO 제품 소개와 WEHAGO, rootHR, WORKUP 대비 포지셔닝 비교',
}

const workflowSteps = [
  {
    title: '고객사 자료 요청',
    description: '정기·비정기 요청, 업로드 링크, 제출 상태를 고객사별로 관리합니다.',
    badge: 'collect',
  },
  {
    title: 'AI 자료 검토',
    description: '누락, 기간 불일치, 잘못 올린 파일, 보충 필요 자료를 먼저 구분합니다.',
    badge: 'review',
  },
  {
    title: '구조화와 초안',
    description: '급여 row, 기장 거래, 계정항목, 전표 분개표 초안으로 이어갑니다.',
    badge: 'draft',
  },
  {
    title: '담당자 승인',
    description: 'AI가 만든 초안과 제안은 담당자가 검토하고 확정합니다.',
    badge: 'approve',
  },
]

const problemCards = [
  {
    label: '반복 업무',
    tone: 'red',
    title: '매달 같은 자료를 다시 요청합니다.',
    description: '고객사별 요청 항목, 제출 기한, 보충 요청, 완료 확인이 반복되지만 담당자 개인 메일과 엑셀에 흩어집니다.',
  },
  {
    label: '검토 부담',
    tone: 'amber',
    title: '자료가 맞는지 사람이 먼저 봅니다.',
    description: '파일명은 맞아도 내용이 틀리거나, 기간이 다르거나, 집계표만 제출되는 경우를 사람이 먼저 걸러야 합니다.',
  },
  {
    label: '인계 단절',
    tone: 'blue',
    title: '업무 맥락이 담당자에게 붙어 있습니다.',
    description: '고객사 커뮤니케이션, 보충 이력, 판단 기준이 개인 메일함과 기억에 남으면 담당자 변경 때 흐름이 끊깁니다.',
  },
]

const comparisonRows = [
  {
    label: '주 사용자',
    wehago: '기업·세무회계·경영관리 사용자',
    roothr: '기업 HR/인사 담당자',
    workup: '기업 HR/인사 담당자',
    jaryo: '회계사무실 직원. 여러 고객사를 관리하는 실무자',
  },
  {
    label: '중심 업무',
    wehago: '회계·세무·경영관리·협업',
    roothr: '인사, 근태, 급여, 평가, 전자계약',
    workup: '인사/조직, 급여, 근태, 평가, 전자계약',
    jaryo: '자료 요청, 업로드 검토, 보충 요청, 급여·기장 초안',
  },
  {
    label: '고객 구조',
    wehago: '자기 회사 또는 사업장 업무 중심',
    roothr: '자기 회사 직원 관리 중심',
    workup: '자기 회사 직원 관리 중심',
    jaryo: '회계사무실 1곳이 여러 고객사를 반복 관리',
  },
  {
    label: 'AI 역할',
    wehago: '회계·업무 기능의 보조 가능성',
    roothr: 'HR 운영 자동화 중심',
    workup: 'HR 운영 자동화 중심',
    jaryo: '자료 판별, 구조화, 실무 초안, 보충 커뮤니케이션 보조',
  },
  {
    label: '차별 메시지',
    wehago: '경영관리 통합',
    roothr: '맞춤형 올인원 HR',
    workup: '클라우드 HR 플랫폼',
    jaryo: '회계사무실 AX 업무자동화 플랫폼',
  },
]

const features = [
  {
    icon: FileCheck2,
    title: '자료 요청·업로드 관리',
    description: '고객사별 요청 세션, 업로드 링크, 제출 여부, 보충 요청 흐름을 한곳에서 관리합니다.',
  },
  {
    icon: Sparkles,
    title: 'AI 자료 검토',
    description: '자료 누락, 기간 불일치, 잘못 올린 파일, 엉뚱한 자료를 먼저 구분하고 담당자 판단을 돕습니다.',
  },
  {
    icon: FileSpreadsheet,
    title: '급여정산 초안',
    description: '다양한 급여 원자료를 구조화하고, 회계사무실이 쓰는 결과 엑셀 초안으로 이어갑니다.',
  },
  {
    icon: Landmark,
    title: '기장 누적 장부',
    description: '월별 자료를 연간 기준으로 누적하고, 계정항목 정리와 전표 분개표 초안을 확인합니다.',
  },
  {
    icon: MailCheck,
    title: '일반업무메일 보존',
    description: '업무용 메일주소, 수신함, 발신, 담당자 인계를 통해 고객사 커뮤니케이션을 사무소 자산으로 남깁니다.',
  },
  {
    icon: Network,
    title: 'Adaptive Data Structuring',
    description: '새로운 유효 자료 형식을 AI가 제안하고, 담당자 승인 후 재사용 가능한 구조화 모델로 축적합니다.',
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
              회계사무실 전용 AX 업무자동화
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.06] tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              JARYO는 회계사무실의 반복 업무를 AI 운영 흐름으로 바꿉니다.
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-slate-600">
              JARYO는 일반 기업용 HR·ERP가 아니라, 회계사무실이 여러 고객사의 자료를 요청하고,
              업로드된 파일을 검토하며, 보충 요청과 급여·기장 초안을 준비하는 흐름을 AI로 보조하는 플랫폼입니다.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {['자료 요청', '파일 검토', '급여 엑셀 초안', '기장 계정·전표 초안', '업무 메일 보존', '실무 리서치'].map((item) => (
                <span key={item} className="inline-flex min-h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl shadow-slate-900/10">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
              <div>
                <strong className="block text-base">AI-assisted accounting office flow</strong>
                <span className="mt-1 block text-sm text-slate-500">AI가 초안을 만들고, 담당자가 판단합니다.</span>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">Beta</span>
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
          <div>
            <h2 className="text-3xl font-black tracking-normal">회계사무실의 문제는 HR 관리가 아니라, 고객사 자료 흐름입니다.</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            일반 기업용 HR·ERP는 자기 회사의 인사·근태·급여·회계 처리가 중심입니다. 회계사무실은 여러 고객사의 자료를 매달 요청하고,
            확인하고, 부족분을 다시 요청해야 합니다.
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
          <h2 className="text-3xl font-black tracking-normal">비교 포지션</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            공개 자료 기준으로 rootHR과 WORKUP은 기업 HR 플랫폼 성격이 강하고, WEHAGO는 더 넓은 경영관리·회계 플랫폼에 가깝습니다.
            JARYO는 회계사무실의 고객사 업무 흐름에 집중합니다.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="border-b border-slate-200 px-4 py-3">구분</th>
                <th className="border-b border-slate-200 px-4 py-3">WEHAGO</th>
                <th className="border-b border-slate-200 px-4 py-3">rootHR</th>
                <th className="border-b border-slate-200 px-4 py-3">WORKUP</th>
                <th className="border-b border-slate-200 bg-blue-50/60 px-4 py-3 text-blue-800">JARYO</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label}>
                  <td className="border-b border-slate-100 px-4 py-4 font-black">{row.label}</td>
                  <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{row.wehago}</td>
                  <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{row.roothr}</td>
                  <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{row.workup}</td>
                  <td className="border-b border-slate-100 bg-blue-50/40 px-4 py-4 font-extrabold text-slate-950">{row.jaryo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <h2 className="text-3xl font-black tracking-normal">JARYO가 제공하는 업무 흐름</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            완전 자동 실행이 아니라, AI가 구조화와 초안을 맡고 담당자가 승인하는 안전한 운영 모델을 지향합니다.
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
            JARYO는 회계사무실의 반복적인 자료 요청, 검토, 급여, 기장, 고객 커뮤니케이션을 AI-assisted 운영 흐름으로 바꾸는 플랫폼입니다.
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <strong className="block text-amber-800">외부 소개 시 표현 기준</strong>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                현재는 &quot;완성된 AX&quot;라고 과장하기보다 &quot;회계사무실을 AX로 이동시키는 AI 업무자동화 플랫폼&quot;이라고 소개하는 것이 안전합니다.
                AI는 판단을 보조하고 초안을 만들며, 고위험 업무의 최종 승인과 고객-facing 책임은 담당자가 갖습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-8 text-sm text-slate-500 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <strong className="block text-slate-700">참고한 공개 자료</strong>
            <p className="mt-1">공개 랜딩 페이지와 제품 가이드 기준의 1차 비교입니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['WEHAGO', 'https://www.wehago.com/#/main'],
              ['rootHR', 'https://www.roothr.co.kr/roothr/index.html'],
              ['rootHR guide', 'https://roothr.co.kr/guide/getting-started/'],
              ['WORKUP', 'https://www.workup.plus/'],
              ['WORKUP guide', 'https://guide.workup.plus/155caac5-fbbb-4f89-968a-81c08f9555ad#2f5b4da6-2688-411e-b90f-909f2dd167c4'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700"
              >
                {label}
                <ArrowRight className="size-3" />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  )
}
