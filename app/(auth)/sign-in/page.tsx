'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn, organization } from '@/lib/auth-client'
import { PasswordVisibilityInput } from '../_components/password-visibility-input'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await signIn.email({ email, password })
    if (signInError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다')
      setLoading(false)
      return
    }

    const { data: orgs } = await organization.list()
    if (orgs && orgs.length > 0) {
      await organization.setActive({ organizationId: orgs[0].id })
      router.push('/dashboard/clients')
    } else {
      // 회사(조직/테넌트)가 아직 없는 계정은 회사 등록(온보딩)으로 보낸다(JC-020).
      router.push('/onboarding')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">로그인</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="name@example.com"
          />
        </div>

        <PasswordVisibilityInput
          label="비밀번호"
          required
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-500 text-center">
        계정이 없으신가요?{' '}
        <Link href="/sign-up" className="text-blue-600 hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  )
}
