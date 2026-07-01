import { describe, expect, it } from 'vitest'
import {
  canStartBookkeepingMaterialAttribution,
  getBookkeepingMaterialAttributionStartState,
} from './period-attribution-eligibility'

describe('canStartBookkeepingMaterialAttribution', () => {
  const analyzedFiles = [{ status: 'matched' }, { status: 'needs_review' }]

  it('allows bookkeeping attribution after file analysis even when session evaluation is not finalized', () => {
    expect(canStartBookkeepingMaterialAttribution({
      sessionStatus: 'submitted',
      workType: 'bookkeeping',
      files: analyzedFiles,
    })).toBe(true)
  })

  it('allows staff-direct bookkeeping sessions that remain active after analysis', () => {
    expect(canStartBookkeepingMaterialAttribution({
      sessionStatus: 'active',
      workType: 'bookkeeping',
      files: analyzedFiles,
    })).toBe(true)
  })

  it('blocks while any file analysis is still pending', () => {
    expect(canStartBookkeepingMaterialAttribution({
      sessionStatus: 'submitted',
      workType: 'bookkeeping',
      files: [{ status: 'matched' }, { status: 'analyzing' }],
    })).toBe(false)
  })

  it('keeps period attribution scoped to bookkeeping sessions in the UI', () => {
    expect(canStartBookkeepingMaterialAttribution({
      sessionStatus: 'completed',
      workType: 'payroll',
      files: analyzedFiles,
    })).toBe(false)
  })

  it('returns a specific reason when analyzed files are ready to start', () => {
    expect(getBookkeepingMaterialAttributionStartState({
      sessionStatus: 'needs_resubmission',
      workType: 'bookkeeping',
      files: analyzedFiles,
    })).toEqual({
      eligible: true,
      reason: '분석 완료 파일이 있어 귀속기간 검토를 시작할 수 있습니다.',
    })
  })

  it('returns a specific reason when file analysis is still pending', () => {
    expect(getBookkeepingMaterialAttributionStartState({
      sessionStatus: 'active',
      workType: 'bookkeeping',
      files: [{ status: 'matched' }, { status: 'uploaded' }],
    })).toEqual({
      eligible: false,
      reason: '파일 분석이 끝난 뒤 귀속기간 검토를 시작할 수 있습니다.',
    })
  })
})
