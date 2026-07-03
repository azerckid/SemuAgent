'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { organization } from '@/lib/auth-client'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // 이미 회사(조직/테넌트)가 있는 사용자가 여기로 오면(예: 활성 테넌트 미설정 상태로 진입),
  // 회사 등록 폼을 보여주지 않고 setActive 후 대시보드로 되돌린다(JC-020).
  const [checkingExisting, setCheckingExisting] = useState(true)

  useEffect(() => {
    let active = true
    organization
      .list()
      .then(async ({ data: orgs }) => {
        if (!active) return
        if (orgs && orgs.length > 0) {
          await organization.setActive({ organizationId: orgs[0].id })
          if (active) router.replace('/dashboard/clients')
          return
        }
        setCheckingExisting(false)
      })
      .catch(() => {
        if (active) setCheckingExisting(false)
      })
    return () => {
      active = false
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subdomain }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '회사 등록에 실패했습니다')
        setLoading(false)
        return
      }

      const { orgId } = await res.json()
      await organization.setActive({ organizationId: orgId })
      router.push('/dashboard/clients')
    } catch {
      setError('서버 오류가 발생했습니다')
      setLoading(false)
    }
  }

  if (checkingExisting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-sm text-gray-500">확인 중…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">회사 등록</h1>
        <p className="text-sm text-gray-500 mb-6">서비스를 시작하려면 회사 정보를 입력하세요.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 샘플컴퍼니(주)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">서브도메인</label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                required
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="sejong"
              />
              <span className="text-sm text-gray-400 shrink-0">.jaryo.kr</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">소문자, 숫자, 하이픈만 사용 가능</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '생성 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
