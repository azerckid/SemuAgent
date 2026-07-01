'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitFilePasswordClient } from '@/lib/upload/submit-file-password-client'

export interface FilePasswordInputProps {
  fileId: string
  mode: 'client' | 'staff'
  rawToken?: string
  disabled?: boolean
  /** 포털(밝은 배경) vs 자료검토(shadcn) 스타일 */
  variant?: 'portal' | 'dashboard'
  className?: string
}

export function FilePasswordInput({
  fileId,
  mode,
  rawToken,
  disabled = false,
  variant = 'portal',
  className,
}: FilePasswordInputProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (disabled || isSubmitting || !password.trim()) return

    setIsSubmitting(true)
    setErrorMessage(null)

    const submittedPassword = password
    setPassword('')

    try {
      const result = await submitFilePasswordClient({
        fileId,
        password: submittedPassword,
        mode,
        rawToken,
      })

      if (result.ok) {
        router.refresh()
        return
      }

      if (result.reason === 'invalid') {
        setErrorMessage(result.message)
        return
      }

      setErrorMessage(result.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDashboard = variant === 'dashboard'

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="password"
          name="file-open-password"
          autoComplete="off"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            if (errorMessage) setErrorMessage(null)
          }}
          disabled={disabled || isSubmitting}
          placeholder="파일 비밀번호"
          aria-label="파일 비밀번호"
          className={
            isDashboard
              ? 'max-w-xs h-8 text-sm'
              : 'max-w-[200px] h-8 text-sm border-amber-200 bg-white focus-visible:border-amber-400 focus-visible:ring-amber-200/50'
          }
        />
        <Button
          type="submit"
          size="sm"
          variant={isDashboard ? 'secondary' : 'default'}
          disabled={disabled || isSubmitting || !password.trim()}
          className={isDashboard ? undefined : 'bg-amber-700 hover:bg-amber-800 text-white'}
        >
          {isSubmitting ? '확인 중' : '확인'}
        </Button>
      </div>
      {errorMessage ? (
        <p
          className={
            isDashboard
              ? 'mt-1.5 text-xs text-destructive'
              : 'mt-1.5 text-xs text-red-600'
          }
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </form>
  )
}
