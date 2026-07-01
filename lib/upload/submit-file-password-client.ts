import { z } from 'zod'

const consumedResponseSchema = z.object({ status: z.literal('consumed') })
const invalidResponseSchema = z.object({
  status: z.literal('invalid'),
  error: z.string(),
})
const errorResponseSchema = z.object({ error: z.string() })

export type SubmitFilePasswordClientResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; message: string }
  | { ok: false; reason: 'rejected'; message: string }

function buildEndpoint(fileId: string, mode: 'client' | 'staff'): string {
  return mode === 'client'
    ? `/api/upload/files/${fileId}/password`
    : `/api/reviews/files/${fileId}/password`
}

/**
 * Slice 3-C: 비밀번호 제출 API 클라이언트.
 * 비밀번호 값은 응답에 포함되지 않으며, 호출측에서 submit 직후 state를 비워야 한다.
 */
export async function submitFilePasswordClient(params: {
  fileId: string
  password: string
  mode: 'client' | 'staff'
  rawToken?: string
}): Promise<SubmitFilePasswordClientResult> {
  const { fileId, password, mode, rawToken } = params

  const body =
    mode === 'client'
      ? { rawToken: rawToken ?? '', password }
      : { password }

  let res: Response
  try {
    res = await fetch(buildEndpoint(fileId, mode), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, reason: 'rejected', message: '네트워크 오류가 발생했습니다. 다시 시도해 주세요.' }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, reason: 'rejected', message: '서버 응답을 처리할 수 없습니다.' }
  }

  if (res.ok) {
    const parsed = consumedResponseSchema.safeParse(json)
    if (parsed.success) return { ok: true }
    return { ok: false, reason: 'rejected', message: '서버 응답 형식이 올바르지 않습니다.' }
  }

  if (res.status === 400) {
    const invalid = invalidResponseSchema.safeParse(json)
    if (invalid.success) {
      return { ok: false, reason: 'invalid', message: invalid.data.error }
    }
  }

  const error = errorResponseSchema.safeParse(json)
  return {
    ok: false,
    reason: 'rejected',
    message: error.success ? error.data.error : '비밀번호를 확인할 수 없습니다.',
  }
}
