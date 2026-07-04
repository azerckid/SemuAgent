'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X } from 'lucide-react'

const WELCOME_DISMISSED_KEY = 'jaryo-public-welcome-dismissed-v1'

export function PublicWelcomeModal() {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [doNotShowAgain, setDoNotShowAgain] = useState(false)

  const closeModal = useCallback(() => {
    if (doNotShowAgain) {
      localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    }
    setIsOpen(false)
  }, [doNotShowAgain])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsOpen(localStorage.getItem(WELCOME_DISMISSED_KEY) !== 'true')
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeModal, isOpen])

  const handleLoginClick = () => {
    if (doNotShowAgain) {
      localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    }
    setIsOpen(false)
    if (pathname !== '/sign-in') {
      router.push('/sign-in')
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-5 py-6 backdrop-blur-[5px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
    >
      <section
        className="w-full max-w-[560px] overflow-hidden rounded-[18px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-welcome-title"
      >
        <header className="flex items-start justify-between gap-4 px-7 pb-5 pt-6 max-sm:px-5">
          <div>
            <p className="mb-2.5 text-[13px] font-extrabold text-blue-600">SemuAgent 베타 안내</p>
            <h2
              id="public-welcome-title"
              className="max-w-[440px] text-2xl font-bold leading-[1.28] tracking-normal text-gray-900 max-sm:text-[21px]"
            >
              작은 회사의 세무신고 준비를 AI와 함께 정리합니다
            </h2>
          </div>
          <button
            type="button"
            aria-label="안내 닫기"
            onClick={closeModal}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="px-7 pb-6 max-sm:px-5">
          <p className="m-0 text-[15px] leading-7 text-gray-600">
            증빙 수집, AI 분류·기장검토, 부가세·급여, 신고자료 패키지 생성을 하나의 업무
            흐름으로 연결합니다. AI는 초안을 만들고 회사 담당자가 확인·승인하는 구조로
            운영됩니다.
          </p>

          <div className="my-5 grid grid-cols-3 gap-2.5 max-sm:grid-cols-1" aria-label="주요 기능">
            <div className="min-h-[92px] rounded-xl border border-gray-200 bg-slate-50 p-3.5">
              <strong className="mb-1.5 block text-[13px] text-gray-900">자료 수집</strong>
              <span className="block text-xs leading-5 text-gray-500">
                증빙·통장·카드·급여 자료를 한 화면에서 수집·정리합니다.
              </span>
            </div>
            <div className="min-h-[92px] rounded-xl border border-gray-200 bg-slate-50 p-3.5">
              <strong className="mb-1.5 block text-[13px] text-gray-900">AI 검토</strong>
              <span className="block text-xs leading-5 text-gray-500">
                기장·부가세·급여 초안을 담당자 확인 전제로 준비합니다.
              </span>
            </div>
            <div className="min-h-[92px] rounded-xl border border-gray-200 bg-slate-50 p-3.5">
              <strong className="mb-1.5 block text-[13px] text-gray-900">신고 준비</strong>
              <span className="block text-xs leading-5 text-gray-500">
                신고자료 패키지 생성과 홈택스 제출 안내를 제공합니다.
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[13px] leading-6 text-amber-800">
            현재는 베타/파일럿 검증 단계입니다. 세무 판단과 최종 신고 제출은 회사 담당자가
            확인·승인한 뒤 진행하는 것을 전제로 합니다.
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-gray-200 bg-slate-50/70 px-7 py-4 max-sm:flex-col-reverse max-sm:items-stretch max-sm:px-5">
          <label className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] text-gray-500">
            <input
              type="checkbox"
              checked={doNotShowAgain}
              onChange={(event) => setDoNotShowAgain(event.target.checked)}
              className="size-[15px] accent-blue-600"
            />
            다시 보지 않기
          </label>

          <div className="flex items-center gap-2 max-sm:[&>button]:flex-1">
            <button
              type="button"
              onClick={closeModal}
              className="h-9 rounded-lg border border-gray-300 bg-white px-4 text-[13px] font-bold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleLoginClick}
              className="h-9 rounded-lg border border-blue-600 bg-blue-600 px-4 text-[13px] font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              로그인하기
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
