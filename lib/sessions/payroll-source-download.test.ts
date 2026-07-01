import { describe, expect, it } from 'vitest'
import {
  derivePayrollResultExcelDownloadState,
  derivePayrollSourceDownloadState,
  parsePayrollSourceFileIds,
} from './payroll-source-download'

describe('derivePayrollSourceDownloadState', () => {
  it('enables source download only when latest completed batch has all pass rows', () => {
    const state = derivePayrollSourceDownloadState({
      batchStatus: 'completed',
      rowVerdicts: ['pass', 'pass'],
      sourceFileCount: 2,
    })

    expect(state.enabled).toBe(true)
    expect(state.label).toBe('부합 원자료 다운로드 가능')
  })

  it('blocks source download when any row is fail', () => {
    const state = derivePayrollSourceDownloadState({
      batchStatus: 'completed',
      rowVerdicts: ['pass', 'fail'],
      sourceFileCount: 1,
    })

    expect(state.enabled).toBe(false)
    expect(state.label).toBe('부적합 row 존재')
  })

  it('blocks source download before extraction completes', () => {
    const state = derivePayrollSourceDownloadState({
      batchStatus: 'running',
      rowVerdicts: [],
      sourceFileCount: 1,
    })

    expect(state.enabled).toBe(false)
    expect(state.label).toBe('추출 완료 후 가능')
  })
})

describe('derivePayrollResultExcelDownloadState', () => {
  it('enables result Excel download only when latest completed batch has all pass rows', () => {
    const state = derivePayrollResultExcelDownloadState({
      batchStatus: 'completed',
      rowVerdicts: ['pass', 'pass'],
    })

    expect(state.enabled).toBe(true)
    expect(state.label).toBe('결과 엑셀 다운로드 가능')
  })

  it('blocks result Excel download when any row is fail', () => {
    const state = derivePayrollResultExcelDownloadState({
      batchStatus: 'completed',
      rowVerdicts: ['pass', 'fail'],
    })

    expect(state.enabled).toBe(false)
    expect(state.label).toBe('부적합 row 존재')
  })
})

describe('parsePayrollSourceFileIds', () => {
  it('returns a string array for valid source file id JSON', () => {
    expect(parsePayrollSourceFileIds('["file-a","file-b"]')).toEqual(['file-a', 'file-b'])
  })

  it('returns an empty array for invalid source file id JSON', () => {
    expect(parsePayrollSourceFileIds('not-json')).toEqual([])
  })
})
