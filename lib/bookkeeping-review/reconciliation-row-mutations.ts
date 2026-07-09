export type ReconciliationRowPreviousState = {
  finalAccount: string | null
  staffMemo: string | null
  status: string
  linkedEvidenceRowId: string | null
}

export type ReconciliationRowMutationResult =
  | { ok: true; previous: ReconciliationRowPreviousState | null }
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

  const payload = await response.json().catch(() => null)

  if (response.ok) {
    return { ok: true, previous: payload?.previous ?? null }
  }

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

export async function saveReconciliationRowExplanation(params: {
  uploadSessionId: string
  rowId: string
  memo: string
}): Promise<ReconciliationRowMutationResult> {
  return patchClassificationRow({
    uploadSessionId: params.uploadSessionId,
    rowId: params.rowId,
    body: { staffMemo: params.memo },
    fallbackErrorMessage: '소명 메모 저장에 실패했습니다.',
  })
}

export async function saveReconciliationRowExclusion(params: {
  uploadSessionId: string
  rowId: string
  memo: string
}): Promise<ReconciliationRowMutationResult> {
  return patchClassificationRow({
    uploadSessionId: params.uploadSessionId,
    rowId: params.rowId,
    body: { status: 'excluded', staffMemo: params.memo },
    fallbackErrorMessage: '제외 처리에 실패했습니다.',
  })
}

// JC-010 2b-2: connects a bank row to a chosen tax_invoice/receipt/card row
// as its confirmed evidence. Card rows are never the target of this
// mutation — a card approval is itself the evidence, not something that
// needs a separate evidence link (2b-1 scope decision).
export async function connectReconciliationRowEvidence(params: {
  uploadSessionId: string
  rowId: string
  evidenceRowId: string
}): Promise<ReconciliationRowMutationResult> {
  return patchClassificationRow({
    uploadSessionId: params.uploadSessionId,
    rowId: params.rowId,
    body: { linkedEvidenceRowId: params.evidenceRowId },
    fallbackErrorMessage: '증빙 연결에 실패했습니다.',
  })
}

export async function disconnectReconciliationRowEvidence(params: {
  uploadSessionId: string
  rowId: string
}): Promise<ReconciliationRowMutationResult> {
  return patchClassificationRow({
    uploadSessionId: params.uploadSessionId,
    rowId: params.rowId,
    body: { linkedEvidenceRowId: null },
    fallbackErrorMessage: '증빙 연결 해제에 실패했습니다.',
  })
}

// Shallow undo (Brief 41 §0.4): PATCHes the row straight back to the
// pre-mutation snapshot the server returned. No separate audit-log store —
// callers keep `previous` in memory only for the current session/toast.
export async function revertReconciliationRowState(params: {
  uploadSessionId: string
  rowId: string
  previous: ReconciliationRowPreviousState
}): Promise<ReconciliationRowMutationResult> {
  return patchClassificationRow({
    uploadSessionId: params.uploadSessionId,
    rowId: params.rowId,
    body: {
      finalAccount: params.previous.finalAccount,
      staffMemo: params.previous.staffMemo,
      status: params.previous.status,
      linkedEvidenceRowId: params.previous.linkedEvidenceRowId,
    },
    fallbackErrorMessage: '되돌리기에 실패했습니다.',
  })
}
