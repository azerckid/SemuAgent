'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth-client'
import { PasswordVisibilityInput } from '../_components/password-visibility-input'

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }

    setLoading(true)

    const { error: signUpError } = await signUp.email({ name, email, password })
    if (signUpError) {
      setError(signUpError.message ?? '회원가입에 실패했습니다')
      setLoading(false)
      return
    }

    router.push('/dashboard/clients')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">회원가입</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="홍길동"
          />
        </div>

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
          minLength={8}
          value={password}
          onChange={setPassword}
          placeholder="8자 이상"
          autoComplete="new-password"
        />

        <PasswordVisibilityInput
          label="비밀번호 확인"
          required
          minLength={8}
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          placeholder="비밀번호를 한 번 더 입력하세요"
          autoComplete="new-password"
          error={passwordMismatch ? '비밀번호가 일치하지 않습니다' : undefined}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || passwordMismatch}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '가입 중...' : '회원가입'}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-500 text-center">
        이미 계정이 있으신가요?{' '}
        <Link href="/sign-in" className="text-blue-600 hover:underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
