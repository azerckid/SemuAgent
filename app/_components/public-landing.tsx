'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Bell,
  ClipboardCheck,
  FileSpreadsheet,
  Mail,
  Menu,
  SearchCheck,
  Send,
  ShieldCheck,
  Sparkles,
  Globe,
  Table2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'
import { PublicLandingHouseScene } from './public-landing-house-scene'

const navItems = [
  { label: '제품 소개', href: '/product-intro' },
]

type WorkUnit = {
  title: string
  description: string
  icon: LucideIcon
  footnote?: string
}

const workUnitGroups: Array<{
  stage: string
  title: string
  summary: string
  items: WorkUnit[]
}> = [
  {
    stage: '요청과 회수',
    title: '메일 발송부터 제출 상태까지',
    summary: '반복되는 자료 요청과 마감 전 확인을 고객사별 상태로 정리합니다.',
    items: [
      {
        title: '자료 요청 일괄메일 발송',
        description: '여러 고객사에 요청 메일을 한 번에 보내고, 제출 기한과 업로드 링크를 자동으로 포함합니다.',
        icon: Mail,
      },
      {
        title: '제출기한 리마인드 자동 발송',
        description: '제출 완료 전 고객사에는 기한 전에 리마인드 메일이 자동 발송됩니다.',
        icon: Bell,
      },
      {
        title: '필요자료 제출 현황 확인',
        description: '접수된 자료, 남은 항목, 해당 없음, 나중에 제출 상태를 한 화면에서 확인합니다.',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    stage: '검토와 후속',
    title: '자료를 보고 다음 메일까지',
    summary: '업로드된 파일을 검토하고, 필요한 후속 메일은 담당자 확인용 초안으로 만듭니다.',
    items: [
      {
        title: 'AI 자료 검토',
        description: '요청기간 불일치, 잘못 올린 파일, 확인이 필요한 자료를 검토 결과로 표시합니다.',
        icon: SearchCheck,
      },
      {
        title: '보충요청 메일 초안 작성',
        description: '추가 자료가 필요한 경우 담당자가 확인할 수 있는 보충요청 메일 초안을 작성합니다.',
        icon: Send,
      },
      {
        title: '고보안 처리 경로',
        description: '개인정보 민감정보 마스킹, 보안 자료는 TEE 기반 경로로 분리합니다.',
        footnote:
          'TEE(Trusted Execution Environment): 민감 데이터를 격리된 환경에서 처리하는 방식',
        icon: ShieldCheck,
      },
    ],
  },
  {
    stage: '급여정산',
    title: '급여자료에서 더존 엑셀까지',
    summary: '급여정산 자료와 고객사별 기준을 모아 업로드용 엑셀 초안으로 이어갑니다.',
    items: [
      {
        title: '급여정산 자료 요청 및 정리',
        description: '급여정산 자료를 별도 흐름으로 요청하고, 고객사별 제출 상태를 관리합니다.',
        icon: FileSpreadsheet,
      },
      {
        title: '사내급여기준 구조화',
        description: '고객사별 사내급여기준을 AI가 구조화하고, 담당자가 승인한 기준만 적용합니다.',
        icon: Table2,
      },
      {
        title: '더존 업로드용 엑셀 초안 작성',
        description: '사내급여기준 또는 법정 기준을 참고해 더존 업로드 양식에 맞는 급여정산 엑셀 초안을 작성합니다.',
        icon: FileSpreadsheet,
      },
    ],
  },
]

export function PublicLanding() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="relative isolate overflow-hidden bg-[#FAFAFA]">
        <PublicLandingHouseScene />

        <header
          className={cn(
            'fixed left-0 right-0 top-0 z-50 h-20 border-b border-transparent transition-all duration-300',
            scrolled && 'border-slate-200 bg-white/92 shadow-sm backdrop-blur-md',
          )}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-5 lg:px-8">
            <Link href="/" className="flex items-center gap-2" aria-label="JARYO 홈">
              <span className="grid size-9 place-items-center rounded-lg bg-[#1152d4] text-sm font-black text-white">
                JR
              </span>
              <span className="text-xl font-black tracking-normal text-slate-950">JARYO</span>
            </Link>

            <nav className="hidden items-center gap-7 md:flex" aria-label="공개 화면 주요 메뉴">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-sm font-bold text-slate-600 transition-colors hover:text-slate-950"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/sign-in"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'h-10 rounded-full bg-[#1152d4] px-5 text-sm font-extrabold text-white hover:bg-blue-700',
                )}
              >
                로그인
              </Link>
            </nav>

            <button
              type="button"
              className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm md:hidden"
              aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={mobileOpen}
              aria-controls="public-landing-mobile-menu"
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <nav
            id="public-landing-mobile-menu"
            aria-label="모바일 공개 메뉴"
            className="fixed inset-0 z-40 flex flex-col gap-2 bg-white px-5 pt-24 md:hidden"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg border border-slate-200 px-4 py-4 text-base font-extrabold text-slate-800"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              className="rounded-lg bg-[#1152d4] px-4 py-4 text-center text-base font-extrabold text-white"
              onClick={() => setMobileOpen(false)}
            >
              로그인
            </Link>
          </nav>
        )}

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-5 pt-36 text-center sm:pt-44 lg:px-8">
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-blue-100 bg-white/82 px-4 text-sm font-extrabold text-[#1152d4] shadow-sm">
            <Sparkles className="size-4" />
            회계사무실을 위한 AI 업무 운영 플랫폼
          </span>

          <h1 className="mt-7 max-w-5xl text-4xl font-black leading-[1.08] tracking-normal text-slate-950 sm:text-6xl lg:text-7xl">
            자료 요청부터 검토까지,
            <span className="block bg-linear-to-r from-[#1152d4] to-blue-400 bg-clip-text text-transparent">
              회계사무소 업무를 한 흐름으로
            </span>
          </h1>

          <p className="mt-6 max-w-3xl text-base font-semibold leading-7 text-slate-600 sm:text-xl sm:leading-9">
            JARYO는 고객 업로드 링크, AI 자료 검토, 보충요청 메일, 급여정산 자료 수집을
            회계사무실의 실제 업무 순서에 맞춰 정리합니다.
          </p>

          <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/sign-in"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'h-14 w-full rounded-full bg-[#1152d4] px-8 text-base font-extrabold text-white hover:bg-blue-700 sm:w-auto',
              )}
            >
              로그인하고 시작
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="h-24 sm:h-32" aria-hidden="true" />
        </div>
      </section>

      <section
        aria-labelledby="public-landing-vision-title"
        className="bg-white px-5 py-24 text-center md:py-32 lg:px-8"
      >
        <div className="mx-auto max-w-3xl">
          <h2
            id="public-landing-vision-title"
            className="text-3xl font-black tracking-normal text-slate-950 sm:text-5xl"
          >
            우리의 비전은 연결에 있습니다
          </h2>
          <p className="mt-8 text-base font-normal leading-8 text-slate-600 sm:text-xl sm:leading-9">
            메일함에 흩어진 <strong>자료 요청</strong>, 고객마다 다른{' '}
            <strong>제출 방식</strong>, 검토 후 다시 이어지는 <strong>보충요청</strong>.
            <br />
            JARYO는 AI가 이 끊어진 업무 흐름을 하나로 이을 수 있다고 믿습니다.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="public-landing-work-units-title"
        className="bg-white px-5 pb-[84px] md:pb-[88px] lg:px-6"
      >
        <div className="mx-auto max-w-[1120px]">
          <div className="grid items-center gap-9 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-4 text-sm font-extrabold text-[#1152d4] shadow-sm">
                <Sparkles className="size-4" />
                회계사무실을 위한 AI 업무 운영 플랫폼
              </span>
              <h2
                id="public-landing-work-units-title"
                className="mt-7 max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-[-0.03em] text-slate-950 sm:text-[52px]"
              >
                반복 자료 처리는 AI에게,
                <span className="block bg-linear-to-r from-[#1152d4] to-blue-400 bg-clip-text text-transparent">
                  담당자는 최종 판단에만 집중합니다.
                </span>
              </h2>
              <p className="mt-7 max-w-2xl text-base font-semibold leading-8 text-slate-600 sm:text-lg sm:leading-8">
                JARYO는 회계사무소의 반복 자료 업무를 실제 작업 단위로 나누어
                처리합니다.
              </p>

              <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'h-14 w-full rounded-full bg-[#1152d4] px-8 text-base font-extrabold text-white hover:bg-blue-700 sm:w-auto',
                  )}
                >
                  로그인하고 시작
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/product-intro"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'lg' }),
                    'h-14 w-full rounded-full border-slate-200 bg-white px-8 text-base font-extrabold text-slate-800 hover:bg-slate-50 sm:w-auto',
                  )}
                >
                  제품 소개 보기
                </Link>
              </div>

              <div className="mt-7 flex flex-col gap-3 text-sm font-semibold text-slate-500 sm:flex-row sm:flex-wrap">
                <span className="inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#1152d4]" aria-hidden="true" />
                  담당자 승인 기반 운영
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#1152d4]" aria-hidden="true" />
                  고객 커뮤니케이션 사무소 자산화
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#1152d4]" aria-hidden="true" />
                  멀티 고객사 관리
                </span>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.28)]"
              aria-label="제품 화면 미리보기"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-[13px]">
                <p className="text-[13.5px] font-bold text-slate-950">고객사 제출 현황</p>
                <span className="rounded-full bg-emerald-50 px-[9px] py-[3px] text-[11px] font-extrabold text-emerald-700">
                  Live
                </span>
              </div>
              <div className="flex flex-col gap-[9px] px-4 py-[14px]">
                <div className="flex items-center gap-3 rounded-[11px] border border-slate-200 bg-white px-[13px] py-[11px]">
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-950">
                    (주)솔메이트 · 3월 부가세
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-[9px] py-1 text-[11px] font-bold text-emerald-700">
                    제출완료
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-[11px] border border-slate-200 bg-white px-[13px] py-[11px]">
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-950">
                    웹삼피플 · 급여정산 자료
                  </span>
                  <span className="shrink-0 rounded-full bg-orange-50 px-[9px] py-1 text-[11px] font-bold text-orange-700">
                    기한 D-2
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-[11px] border border-slate-200 bg-white px-[13px] py-[11px]">
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-950">
                    대한물산 · 통장사본 누락
                  </span>
                  <span className="shrink-0 rounded-full bg-blue-50 px-[9px] py-1 text-[11px] font-bold text-[#1152d4]">
                    AI 보충요청 초안
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-[11px] border border-slate-200 bg-white px-[13px] py-[11px]">
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-950">
                    가온테크 · 사내급여기준
                  </span>
                  <span className="shrink-0 rounded-full bg-blue-50 px-[9px] py-1 text-[11px] font-bold text-[#1152d4]">
                    AI 구조화 초안
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 강조 밴드: 정확도/스트레스/처리속도 ── */}
          <div className="mt-20 rounded-3xl bg-[#1152d4] px-6 py-12 text-center sm:px-10">
            <p className="text-sm font-bold tracking-[0.2em] text-blue-200">WHY JARYO</p>
            <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              정확도는 높이고, 스트레스는 줄이고, 처리 속도는 빠르게
            </h3>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 px-6 py-8 ring-1 ring-white/15">
                <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white/15 text-white">
                  <TrendingUp className="size-6" aria-hidden="true" />
                </span>
                <p className="mt-4 text-base font-bold text-white">정확도는 높이고</p>
                <p className="mt-1 text-sm text-blue-100">AI 자료 검토로 누락·오류를 먼저 잡습니다</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-6 py-8 ring-1 ring-white/15">
                <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white/15 text-white">
                  <TrendingDown className="size-6" aria-hidden="true" />
                </span>
                <p className="mt-4 text-base font-bold text-white">스트레스는 줄이고</p>
                <p className="mt-1 text-sm text-blue-100">반복되는 요청·확인 업무를 자동으로 정리합니다</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-6 py-8 ring-1 ring-white/15">
                <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white/15 text-white">
                  <Zap className="size-6" aria-hidden="true" />
                </span>
                <p className="mt-4 text-base font-bold text-white">처리 속도는 빠르게</p>
                <p className="mt-1 text-sm text-blue-100">초안 자동 생성으로 처리 시간을 줄입니다</p>
              </div>
            </div>
          </div>

          <div className="mt-24">
            <div className="mb-10">
              <span className="text-sm font-black text-[#1152d4]">실제 작업 단위</span>
              <h3 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
                JARYO가 처리하는 업무 흐름
              </h3>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {workUnitGroups.map((group, groupIndex) => (
                <section
                  key={group.stage}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-100 px-5 py-6">
                    <p className="text-sm font-black text-[#1152d4]">
                      {String(groupIndex + 1).padStart(2, '0')} · {group.stage}
                    </p>
                    <h4 className="mt-2 text-xl font-black tracking-normal text-slate-950">
                      {group.title}
                    </h4>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                      {group.summary}
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <div key={item.title} className="flex gap-4 px-5 py-5">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1152d4]">
                            <Icon className="size-5" aria-hidden="true" />
                          </span>
                          <div>
                            <h5 className="text-base font-black tracking-normal text-slate-950">
                              {item.title}
                            </h5>
                            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                              {item.description}
                            </p>
                            {item.footnote ? (
                              <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                                {item.footnote}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="public-landing-continuity-title"
        className="bg-white px-5 pb-20 lg:px-6"
      >
        <div className="mx-auto w-full max-w-[1120px]">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50/90 via-white to-white px-7 py-7 shadow-[0_24px_60px_-38px_rgba(17,82,212,0.5)] sm:px-9 sm:py-8">
              <span className="inline-flex min-h-7 items-center rounded-full bg-blue-50 px-3 text-xs font-black text-[#1152d4]">
                업무 연속성
              </span>
              <h3
                id="public-landing-continuity-title"
                className="mt-4 text-2xl font-black tracking-normal text-slate-950 sm:text-[26px]"
              >
                담당자가 바뀌어도, 업무는 끊기지 않습니다.
              </h3>
              <p className="mt-4 text-[15px] font-semibold leading-7 text-slate-600">
                개인 메일함에 남아 있던 요청, 회신, 보충요청 이력을 <strong>업무전용 이메일</strong>과
                고객사별 기록으로 남깁니다. 퇴사자나 담당자 변경이 생겨도 다음 담당자가
                같은 흐름에서 업무를 이어받을 수 있습니다.
              </p>
              <div className="mt-6 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-black text-slate-950">이전 담당자</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">요청·회신·보충요청 이력</p>
                </div>
                <div className="text-center text-2xl font-black text-[#1152d4]" aria-hidden="true">
                  →
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-black text-slate-950">다음 담당자</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">고객사별 업무 기록 그대로 확인</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50/90 via-white to-white px-7 py-7 shadow-[0_24px_60px_-38px_rgba(17,82,212,0.5)] sm:px-9 sm:py-8">
              <span className="inline-flex min-h-7 items-center rounded-full bg-blue-50 px-3 text-xs font-black text-[#1152d4]">
                비용절감
              </span>
              <h3 className="mt-4 text-2xl font-black tracking-normal text-slate-950 sm:text-[26px]">
                사람이 반복하던 확인 업무를 줄입니다.
              </h3>
              <p className="mt-4 text-[15px] font-semibold leading-7 text-slate-600">
                자료 요청, 제출 확인, 리마인드, 보충요청, 계정항목 확인처럼 반복되는
                커뮤니케이션을 자동화해 담당자의 시간을 아낍니다. 같은 인원으로 더 많은
                고객사를 안정적으로 관리할 수 있습니다.
              </p>
              <div className="mt-6 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-black text-slate-950">반복 확인 업무</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">요청·확인·후속 메일</p>
                </div>
                <div className="text-center text-2xl font-black text-[#1152d4]" aria-hidden="true">
                  →
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-black text-slate-950">AI 초안·자동 알림</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">담당자는 최종 확인에 집중</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#F8FAFC] px-5 py-12 lg:px-6">
        <div className="mx-auto w-full max-w-[1120px]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-md bg-[#1152d4] text-[11px] font-black text-white">
                  JR
                </span>
                <span className="font-black text-slate-700">JARYO</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">회계사무실을 위한 AI 업무 운영 플랫폼</p>
              <div className="mt-4 flex items-center gap-2">
                <a
                  href="#"
                  aria-label="JARYO 블로그"
                  className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-[#1152d4]"
                >
                  <Globe className="size-[18px]" aria-hidden="true" />
                </a>
                <a
                  href="#"
                  aria-label="JARYO 링크드인"
                  className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-[#1152d4]"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden="true">
                    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
                  </svg>
                </a>
                <a
                  href="#"
                  aria-label="JARYO 유튜브"
                  className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-[#1152d4]"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden="true">
                    <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2C0 8.08 0 12 0 12s0 3.92.5 5.8a3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.8zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
                  </svg>
                </a>
                <a
                  href="mailto:contact@jaaryo.online"
                  aria-label="JARYO 이메일 문의"
                  className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-[#1152d4]"
                >
                  <Mail className="size-[18px]" aria-hidden="true" />
                </a>
              </div>
            </div>

            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-600" aria-label="푸터 링크">
              <Link href="/product-intro" className="hover:text-slate-950">제품 소개</Link>
              <Link href="/terms" className="hover:text-slate-950">이용약관</Link>
              <Link href="/privacy" className="font-bold text-slate-800 hover:text-slate-950">개인정보처리방침</Link>
              <a href="mailto:contact@jaaryo.online" className="hover:text-slate-950">문의</a>
            </nav>
          </div>

          <dl className="mt-8 grid gap-x-8 gap-y-2 text-[13px] leading-6 text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-slate-600">상호</dt>
              <dd>주식회사 자료</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-slate-600">대표이사</dt>
              <dd>홍길동</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-slate-600">사업자등록번호</dt>
              <dd>123-45-67890</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="shrink-0 font-semibold text-slate-600">주소</dt>
              <dd>서울특별시 강남구 테헤란로 123, 4층 (역삼동)</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-slate-600">이메일</dt>
              <dd>contact@jaaryo.online</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-slate-600">전화</dt>
              <dd>02-1234-5678</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-slate-600">고객지원</dt>
              <dd>평일 10:00–18:00</dd>
            </div>
          </dl>

          <p className="mt-8 border-t border-slate-200 pt-6 text-xs text-slate-400">
            © 2026 주식회사 자료(JARYO). All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  )
}
