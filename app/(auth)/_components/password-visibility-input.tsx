'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordVisibilityInputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete: string
  required?: boolean
  minLength?: number
  error?: string
}

export function PasswordVisibilityInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
  minLength,
  error,
}: PasswordVisibilityInputProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          aria-label={`${label} ${visible ? '숨기기' : '보기'}`}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}
