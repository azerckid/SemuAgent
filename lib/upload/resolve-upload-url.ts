import { getUploadBaseUrl } from '@/lib/env'

const UPLOAD_TOKEN_PATH_RE = /^\/upload\/([^/?#]+)/

/**
 * DB에 저장된 upload_url은 세션 생성 시점의 호스트를 담을 수 있다.
 * 고객·담당자에게 노출할 때는 현재 PUBLIC_UPLOAD_BASE_URL / NEXT_PUBLIC_APP_URL 기준으로 재조립한다.
 */
export function resolveStoredUploadUrl(stored: string | null | undefined): string | null {
  if (!stored) return null

  try {
    const parsed = new URL(stored)
    const tokenMatch = parsed.pathname.match(UPLOAD_TOKEN_PATH_RE)
    if (!tokenMatch) return stored

    const resolved = `${getUploadBaseUrl()}/upload/${tokenMatch[1]}`
    return parsed.search ? `${resolved}${parsed.search}` : resolved
  } catch {
    const pathMatch = stored.match(/\/upload\/([^/?#]+)/)
    if (!pathMatch) return stored
    return `${getUploadBaseUrl()}/upload/${pathMatch[1]}`
  }
}
