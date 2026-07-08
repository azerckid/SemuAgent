export type ReconciliationRowMutationResult =
  | { ok: true }
  | { ok: false; message: string }

async function patchClassificationRow(params: {
  uploadSessionId: string
  rowId: string
  body: Record<string, unknown>
  fallbackErrorMessage: string
}): Promise<ReconciliationRowMutationResult> {
  const response = await fetch(
    `/api/sessions/${params.uploadSessionId}/account-classification/rows/${params.rowId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params.body),
    },
  )

  if (response.ok) {
    return { ok: true }
  }

  const payload = await response.json().catch(() => null)
  return {
    ok: false,
    message: typeof payload?.error === 'string' ? payload.error : params.fallbackErrorMessage,
  }
}

export async function confirmReconciliationRowAccount(params: {
  uploadSessionId: string
  rowId: string
  accountKey: string
}): Promise<ReconciliationRowMutationResult> {
  return patchClassificationRow({
    uploadSessionId: params.uploadSessionId,
    rowId: params.rowId,
    body: { finalAccount: params.accountKey, status: 'confirmed' },
    fallbackErrorMessage: '계정항목 확정에 실패했습니다.',
  })
}
