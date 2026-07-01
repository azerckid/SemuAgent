'use client'

import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Minus,
  RotateCcw,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { FIELD_TEST_SCENARIOS } from './field-test-scenario-config'
import type {
  FieldTestIssue,
  FieldTestNote,
  FieldTestPriority,
  FieldTestProblemType,
  FieldTestScenario,
  FieldTestStep,
} from './field-test-types'

type ActiveMode = 'test' | 'general'
type FeedbackMode = 'idle' | 'issue' | 'note'
type PanelPosition = { left: number; top: number }
type DragSnapshot = {
  pointerId: number
  startX: number
  startY: number
  left: number
  top: number
  width: number
  height: number
}

type IssueDraft = Pick<
  FieldTestIssue,
  'expected' | 'actual' | 'priority' | 'problemType' | 'suggestion'
>

interface FieldTestConciergeProps {
  onClose: () => void
  onCollapse: () => void
}

const priorities: FieldTestPriority[] = ['High', 'Medium', 'Low']
const problemTypes: FieldTestProblemType[] = [
  'Bug',
  'confusing wording',
  'missing status',
  'workflow mismatch',
  'future idea',
]
const panelEdgeGap = 12

const emptyIssueDraft = (expected: string): IssueDraft => ({
  expected,
  actual: '',
  priority: 'Medium',
  problemType: 'workflow mismatch',
  suggestion: '',
})

function stepKey(scenario: FieldTestScenario, stepIndex: number) {
  return `${scenario.id}:${stepIndex}`
}

function stepLabel(stepIndex: number, scenario: FieldTestScenario) {
  return `Step ${stepIndex + 1}/${scenario.steps.length}`
}

function addUnique(items: string[], item: string) {
  return items.includes(item) ? items : [...items, item]
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isInteractiveDragTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button,a,input,textarea,select,[role="button"]'))
}

function getAbsoluteStepNumber(scenarioIndex: number, stepIndex: number) {
  return (
    FIELD_TEST_SCENARIOS.slice(0, scenarioIndex).reduce(
      (total, scenario) => total + scenario.steps.length,
      0,
    ) +
    stepIndex +
    1
  )
}

function CurrentStepCard({
  scenario,
  step,
  stepIndex,
}: {
  scenario: FieldTestScenario
  step: FieldTestStep
  stepIndex: number
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{stepLabel(stepIndex, scenario)}</Badge>
        {step.screen ? <Badge variant="secondary">{step.screen}</Badge> : null}
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-foreground">{step.instruction}</p>
      {step.expectedResult ? (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
          <span className="font-semibold">기대 결과: </span>
          {step.expectedResult}
        </div>
      ) : null}
    </div>
  )
}

export function FieldTestConcierge({ onClose, onCollapse }: FieldTestConciergeProps) {
  const panelRef = useRef<HTMLElement>(null)
  const dragSnapshotRef = useRef<DragSnapshot | null>(null)
  const [activeMode, setActiveMode] = useState<ActiveMode>('test')
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [skippedSteps, setSkippedSteps] = useState<string[]>([])
  const [, setIssues] = useState<FieldTestIssue[]>([])
  const [, setNotes] = useState<FieldTestNote[]>([])
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('idle')
  const [issueDraft, setIssueDraft] = useState<IssueDraft>(() => emptyIssueDraft(''))
  const [noteDraft, setNoteDraft] = useState('')
  const [finished, setFinished] = useState(false)
  const [isDesktopPanel, setIsDesktopPanel] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null)

  const scenario = FIELD_TEST_SCENARIOS[scenarioIndex]
  const currentStep = scenario.steps[stepIndex]
  const currentStepKey = stepKey(scenario, stepIndex)
  const totalSteps = useMemo(
    () => FIELD_TEST_SCENARIOS.reduce((total, item) => total + item.steps.length, 0),
    [],
  )
  const absoluteStep = getAbsoluteStepNumber(scenarioIndex, stepIndex)
  const progressPercent = Math.round(((completedSteps.length + skippedSteps.length) / totalSteps) * 100)
  const panelStyle = useMemo<CSSProperties | undefined>(() => {
    if (!isDesktopPanel || !panelPosition) {
      return undefined
    }

    return {
      bottom: 'auto',
      left: panelPosition.left,
      right: 'auto',
      top: panelPosition.top,
    }
  }, [isDesktopPanel, panelPosition])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 640px)')
    const syncPanelMode = () => {
      setIsDesktopPanel(mediaQuery.matches)
      if (!mediaQuery.matches) {
        dragSnapshotRef.current = null
        setIsDragging(false)
      }
    }

    syncPanelMode()
    mediaQuery.addEventListener('change', syncPanelMode)

    return () => mediaQuery.removeEventListener('change', syncPanelMode)
  }, [])

  const handleDragStart = (event: PointerEvent<HTMLElement>) => {
    if (!isDesktopPanel || event.button !== 0 || isInteractiveDragTarget(event.target)) {
      return
    }

    const panel = panelRef.current
    if (!panel) {
      return
    }

    const rect = panel.getBoundingClientRect()
    dragSnapshotRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }
    setPanelPosition({ left: Math.round(rect.left), top: Math.round(rect.top) })
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const handleDragMove = (event: PointerEvent<HTMLElement>) => {
    const snapshot = dragSnapshotRef.current
    if (!snapshot || snapshot.pointerId !== event.pointerId) {
      return
    }

    const maxLeft = Math.max(panelEdgeGap, window.innerWidth - snapshot.width - panelEdgeGap)
    const maxTop = Math.max(panelEdgeGap, window.innerHeight - snapshot.height - panelEdgeGap)
    const nextLeft = clampNumber(snapshot.left + event.clientX - snapshot.startX, panelEdgeGap, maxLeft)
    const nextTop = clampNumber(snapshot.top + event.clientY - snapshot.startY, panelEdgeGap, maxTop)

    setPanelPosition({
      left: Math.round(nextLeft),
      top: Math.round(nextTop),
    })
    event.preventDefault()
  }

  const handleDragEnd = (event: PointerEvent<HTMLElement>) => {
    const snapshot = dragSnapshotRef.current
    if (!snapshot || snapshot.pointerId !== event.pointerId) {
      return
    }

    dragSnapshotRef.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const advanceStep = () => {
    setFeedbackMode('idle')
    if (stepIndex < scenario.steps.length - 1) {
      setStepIndex((value) => value + 1)
      return
    }
    if (scenarioIndex < FIELD_TEST_SCENARIOS.length - 1) {
      setScenarioIndex((value) => value + 1)
      setStepIndex(0)
      return
    }
    setFinished(true)
  }

  const handleComplete = () => {
    setSkippedSteps((items) => items.filter((item) => item !== currentStepKey))
    setCompletedSteps((items) => addUnique(items, currentStepKey))
    advanceStep()
  }

  const handleSkip = () => {
    setCompletedSteps((items) => items.filter((item) => item !== currentStepKey))
    setSkippedSteps((items) => addUnique(items, currentStepKey))
    advanceStep()
  }

  const canGoBack = scenarioIndex > 0 || stepIndex > 0

  const handleBack = () => {
    setFeedbackMode('idle')

    if (stepIndex > 0) {
      setStepIndex((value) => value - 1)
      return
    }

    if (scenarioIndex > 0) {
      const previousScenarioIndex = scenarioIndex - 1
      setScenarioIndex(previousScenarioIndex)
      setStepIndex(FIELD_TEST_SCENARIOS[previousScenarioIndex].steps.length - 1)
    }
  }

  const handleNoteOpen = () => {
    setNoteDraft('')
    setFeedbackMode('note')
  }

  const handleIssueSave = () => {
    setIssues((items) => [
      ...items,
      {
        scenarioTitle: scenario.title,
        stepLabel: stepLabel(stepIndex, scenario),
        screen: currentStep.screen,
        ...issueDraft,
      },
    ])
    setFeedbackMode('idle')
  }

  const handleNoteSave = () => {
    setNotes((items) => [
      ...items,
      {
        scenarioTitle: scenario.title,
        stepLabel: stepLabel(stepIndex, scenario),
        note: noteDraft,
      },
    ])
    setFeedbackMode('idle')
  }

  const handleReset = () => {
    setActiveMode('test')
    setScenarioIndex(0)
    setStepIndex(0)
    setCompletedSteps([])
    setSkippedSteps([])
    setIssues([])
    setNotes([])
    setFeedbackMode('idle')
    setIssueDraft(emptyIssueDraft(''))
    setNoteDraft('')
    setFinished(false)
  }

  return (
    <section
      ref={panelRef}
      role="complementary"
      aria-label="테스트 안내 팝업 채팅창"
      className="fixed inset-x-3 bottom-3 z-50 flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[420px]"
      style={panelStyle}
    >
      <header
        className={cn(
          'flex shrink-0 items-start justify-between gap-3 border-b border-border bg-muted/40 p-3',
          isDesktopPanel && (isDragging ? 'cursor-grabbing touch-none select-none' : 'cursor-grab touch-none'),
        )}
        onPointerCancel={handleDragEnd}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" aria-hidden="true" />
            <h2 className="truncate text-sm font-bold text-foreground">테스트 안내</h2>
            <Badge variant="info">Beta</Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            화면을 보면서 순서대로 확인합니다.
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="테스트 안내창 접기"
            onClick={onCollapse}
          >
            <Minus aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="테스트 안내창 닫기"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 border-b border-border p-2">
        <Button
          type="button"
          variant={activeMode === 'test' ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={activeMode === 'test'}
          onClick={() => setActiveMode('test')}
        >
          테스트 안내
        </Button>
        <Button
          type="button"
          variant={activeMode === 'general' ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={activeMode === 'general'}
          onClick={() => setActiveMode('general')}
        >
          일반 상담
        </Button>
      </div>

      {activeMode === 'general' ? (
        <div className="flex min-h-72 flex-col justify-center p-4 text-center">
          <p className="text-sm font-semibold text-foreground">일반 AI 상담은 아직 준비 중입니다.</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            현재는 테스트 안내만 사용할 수 있습니다. 고객사 데이터 답변, 권한별 답변,
            공통 이슈 검색은 별도 product decision 이후에 다룹니다.
          </p>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">
                  {scenarioIndex + 1}/{FIELD_TEST_SCENARIOS.length} 시나리오
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  {absoluteStep}/{totalSteps} steps
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <h3 className="mt-3 text-sm font-bold text-foreground">{scenario.title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{scenario.purpose}</p>
            </div>

            <div className="mt-3 space-y-3">
              {finished ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    모든 테스트 단계가 끝났습니다.
                  </div>
                  <p className="mt-2 text-xs leading-5">
                    필요한 경우 다시 시작할 수 있습니다.
                  </p>
                </div>
              ) : (
                <CurrentStepCard scenario={scenario} step={currentStep} stepIndex={stepIndex} />
              )}

              {feedbackMode === 'issue' ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-sm font-bold text-foreground">문제 기록</p>
                  <div className="mt-3 space-y-3">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      기대 결과
                      <Textarea
                        value={issueDraft.expected}
                        onChange={(event) =>
                          setIssueDraft((draft) => ({ ...draft, expected: event.target.value }))
                        }
                        className="mt-1 min-h-16 bg-background"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      실제 결과
                      <Textarea
                        value={issueDraft.actual}
                        onChange={(event) =>
                          setIssueDraft((draft) => ({ ...draft, actual: event.target.value }))
                        }
                        className="mt-1 min-h-16 bg-background"
                        placeholder="어떤 점이 달랐는지 적어 주세요."
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-muted-foreground">
                        우선순위
                        <select
                          value={issueDraft.priority}
                          onChange={(event) =>
                            setIssueDraft((draft) => ({
                              ...draft,
                              priority: event.target.value as FieldTestPriority,
                            }))
                          }
                          className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {priorities.map((priority) => (
                            <option key={priority} value={priority}>
                              {priority}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-muted-foreground">
                        문제 유형
                        <select
                          value={issueDraft.problemType}
                          onChange={(event) =>
                            setIssueDraft((draft) => ({
                              ...draft,
                              problemType: event.target.value as FieldTestProblemType,
                            }))
                          }
                          className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {problemTypes.map((problemType) => (
                            <option key={problemType} value={problemType}>
                              {problemType}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      제안 문구 또는 기대 동작
                      <Input
                        value={issueDraft.suggestion}
                        onChange={(event) =>
                          setIssueDraft((draft) => ({ ...draft, suggestion: event.target.value }))
                        }
                        className="mt-1 bg-background"
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setFeedbackMode('idle')}>
                        취소
                      </Button>
                      <Button type="button" size="sm" onClick={handleIssueSave}>
                        저장
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {feedbackMode === 'note' ? (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-sm font-bold text-foreground">메모 남기기</p>
                  <Textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    className="mt-3 min-h-20 bg-background"
                    placeholder="혼란스러운 문구, 추가로 보고 싶은 정보, 현업 의견을 적어 주세요."
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFeedbackMode('idle')}>
                      취소
                    </Button>
                    <Button type="button" size="sm" onClick={handleNoteSave}>
                      저장
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <footer className="shrink-0 border-t border-border bg-background p-3">
            {finished ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" aria-label="테스트 다시 시작" onClick={handleReset}>
                  <RotateCcw aria-hidden="true" />
                  다시 시작
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" onClick={handleComplete}>
                  완료
                  <ChevronRight aria-hidden="true" />
                </Button>
                <Button type="button" variant="outline" disabled={!canGoBack} onClick={handleBack}>
                  <ChevronLeft aria-hidden="true" />
                  뒤로가기
                </Button>
                <Button type="button" variant="ghost" onClick={handleSkip}>
                  건너뛰기
                </Button>
                <Button type="button" variant="ghost" onClick={handleNoteOpen}>
                  메모 남기기
                </Button>
              </div>
            )}
          </footer>
        </>
      )}
    </section>
  )
}
