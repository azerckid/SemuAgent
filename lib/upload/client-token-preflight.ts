type UploadTokenPreflightInput = {
  handleUploadUrl: string
  pathname: string
  clientPayload: string
}

export async function verifyUploadClientTokenAvailable({
  handleUploadUrl,
  pathname,
  clientPayload,
}: UploadTokenPreflightInput): Promise<void> {
  const res = await fetch(handleUploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: {
        pathname,
        clientPayload,
      },
    }),
  })

  if (res.ok) return

  const message = await res.text().catch(() => '')
  throw new Error(message.trim() || '업로드 토큰을 발급하지 못했습니다. 세션 상태와 Blob 설정을 확인해 주세요.')
}
