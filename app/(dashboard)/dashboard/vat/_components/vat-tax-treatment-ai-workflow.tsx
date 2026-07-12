'use client'

import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  vatTaxTreatmentAiRunResponseSchema,
  type VatTaxTreatmentAiRunRequest,
  type VatTaxTreatmentAiWorkflowState,
} from '@/lib/validations/vat-tax-treatment-ai-workflow'

const POLL_INTERVAL_MS = 3_000
const MAX_POLL_COUNT = 20

type WorkflowContextValue = {
  states: Map<string, VatTaxTreatmentAiWorkflowState>
  recheck: (rowId: string, expectedFingerprint: string) => void
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null)

export function VatTaxTreatmentAiWorkflowProvider({
  periodKey,
  initialStates,
  children,
}: {
  readonly periodKey: string
  readonly initialStates: VatTaxTreatmentAiWorkflowState[]
  readonly children: ReactNode
}) {
  const router = useRouter()
  const [states, setStates] = useState(() => stateMap(initialStates))
  const runningRef = useRef(false)
  const statusRequestRef = useRef(false)
  const autoStartedRef = useRef(false)
  const pollCountRef = useRef(0)

  const loadStates = useCallback(async () => {
    if (statusRequestRef.current) return null
    statusRequestRef.current = true
    try {
      const response = await fetch(`/api/vat/periods/${periodKey}/tax-treatment-ai`, {
        method: 'GET',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) return null
      const parsed = vatTaxTreatmentAiRunResponseSchema.safeParse(body)
      if (!parsed.success) return null
      setStates(stateMap(parsed.data.states))
      return parsed.data.states
    } finally {
      statusRequestRef.current = false
    }
  }, [periodKey])

  const run = useCallback(async (input: VatTaxTreatmentAiRunRequest) => {
    if (runningRef.current) return
    runningRef.current = true
    pollCountRef.current = 0
    let completedSuccessfully = false
    setStates((current) => optimisticCheckingState(current, input))
    try {
      const response = await fetch(`/api/vat/periods/${periodKey}/tax-treatment-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(typeof body?.error === 'string' ? body.error : 'AI 판단을 완료하지 못했습니다.')
        await loadStates()
        return
      }
      const parsed = vatTaxTreatmentAiRunResponseSchema.safeParse(body)
      if (!parsed.success) {
        toast.error('AI 판단 상태를 확인할 수 없습니다.')
        await loadStates()
        return
      }
      setStates(stateMap(parsed.data.states))
      completedSuccessfully = true
      router.refresh()
    } catch {
      toast.error('AI 판단 연결이 지연되고 있습니다. 다른 검토는 계속할 수 있습니다.')
      await loadStates()
    } finally {
      runningRef.current = false
      if (completedSuccessfully && input.action === 'evaluate_missing') {
        autoStartedRef.current = false
      }
    }
  }, [loadStates, periodKey, router])

  useEffect(() => {
    if (autoStartedRef.current) return
    const hasMissing = [...states.values()].some((state) => (
      state.canEvaluate && (state.status === 'idle' || state.status === 'stale')
    ))
    if (!hasMissing) return
    autoStartedRef.current = true
    const timer = window.setTimeout(() => {
      void run({ action: 'evaluate_missing' })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [run, states])

  useEffect(() => {
    const hasChecking = [...states.values()].some((state) => state.status === 'checking')
    if (!hasChecking) return
    const timer = window.setInterval(() => {
      pollCountRef.current += 1
      if (pollCountRef.current > MAX_POLL_COUNT) {
        window.clearInterval(timer)
        return
      }
      void loadStates().then((nextStates) => {
        if (nextStates && nextStates.every((state) => state.status !== 'checking')) {
          window.clearInterval(timer)
          router.refresh()
        }
      })
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [loadStates, router, states])

  const value = useMemo<WorkflowContextValue>(() => ({
    states,
    recheck: (rowId, expectedFingerprint) => {
      void run({ action: 'reevaluate_row', rowId, expectedFingerprint })
    },
  }), [run, states])

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
}

export function VatTaxTreatmentAiWorkflowStatus({
  rowId,
  recommendationFingerprint,
}: {
  readonly rowId: string
  readonly recommendationFingerprint: string
}) {
  const context = useContext(WorkflowContext)
  const state = context?.states.get(rowId)
  if (!state || !state.canEvaluate || state.status === 'idle') return null

  if (state.status === 'ready') {
    return (
      <p className="mt-1 text-[11px] font-medium text-company-fg-subtle">
        판단 완료{state.completedAt ? ` · ${relativeCompletedTime(state.completedAt)}` : ''}
      </p>
    )
  }

  if (state.status === 'checking') {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-[#2563eb]">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        확인 중
      </div>
    )
  }

  const stale = state.status === 'stale'
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className={stale
        ? 'rounded-md border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-[11px] font-bold text-[#b45309]'
        : 'rounded-md border border-company-border bg-company-nav-hover px-2 py-0.5 text-[11px] font-bold text-company-fg-muted'}
      >
        {stale ? '다시 확인 필요' : 'AI 일시 중단'}
      </span>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={() => context?.recheck(rowId, recommendationFingerprint)}
      >
        <RefreshCw aria-hidden="true" />
        AI 다시 확인
      </Button>
    </div>
  )
}

function stateMap(states: VatTaxTreatmentAiWorkflowState[]) {
  return new Map(states.map((state) => [state.rowId, state]))
}

function optimisticCheckingState(
  states: Map<string, VatTaxTreatmentAiWorkflowState>,
  input: VatTaxTreatmentAiRunRequest,
) {
  const next = new Map(states)
  for (const [rowId, state] of next) {
    const selected = input.action === 'reevaluate_row'
      ? rowId === input.rowId
      : state.canEvaluate && (state.status === 'idle' || state.status === 'stale')
    if (selected) next.set(rowId, { ...state, status: 'checking' })
  }
  return next
}

function relativeCompletedTime(value: string) {
  const completedAt = new Date(value).getTime()
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - completedAt) / 60_000))
  if (elapsedMinutes < 1) return '방금'
  if (elapsedMinutes < 60) return `${elapsedMinutes}분 전`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}시간 전`
  return `${Math.floor(elapsedHours / 24)}일 전`
}
