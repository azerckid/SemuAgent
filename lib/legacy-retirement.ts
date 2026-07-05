import { NextResponse } from 'next/server'

export const RETIRED_LEGACY_EMAIL_MESSAGE =
  '레거시 고객 요청 메일 기능은 SemuAgent v1에서 제공하지 않습니다.'

export function retiredLegacyEmailResponse() {
  return NextResponse.json(
    { error: RETIRED_LEGACY_EMAIL_MESSAGE },
    { status: 410 },
  )
}
