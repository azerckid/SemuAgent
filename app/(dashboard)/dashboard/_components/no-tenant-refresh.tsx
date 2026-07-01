'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { organization } from '@/lib/auth-client'

export function NoTenantRefresh() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    setLoading(true)
    const { data: orgs } = await organization.list()
    if (orgs && orgs.length > 0) {
      await organization.setActive({ organizationId: orgs[0].id })
      router.refresh()
    } else {
      setLoading(false)
      alert('아직 추가되지 않았습니다. 관리자에게 다시 확인해주세요.')
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className="w-full text-xs font-medium text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-white disabled:opacity-50"
    >
      {loading ? '확인 중…' : '추가됐는지 확인하기'}
    </button>
  )
}
