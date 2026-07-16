import { describe, expect, it } from 'vitest'
import { classifySebiseoScope } from './scope-classifier'

describe('classifySebiseoScope', () => {
  it('allows SemuAgent workflow and screen questions', () => {
    expect(classifySebiseoScope('자료수집에서 통장 파일 어떻게 올려요?')).toEqual({ kind: 'allowed' })
    expect(classifySebiseoScope('부가세 화면의 추가 공제 가능성은 뭐예요?')).toEqual({ kind: 'allowed' })
  })

  it('refuses off-topic, tax advice, and delegated actions', () => {
    expect(classifySebiseoScope('오늘 날씨 어때?')).toMatchObject({ kind: 'refused', reason: 'off_topic' })
    expect(classifySebiseoScope('접대비가 공제 가능한가요?')).toMatchObject({ kind: 'refused', reason: 'tax_advice' })
    expect(classifySebiseoScope('세무사처럼 부가세 확정해줘')).toMatchObject({ kind: 'refused', reason: 'action' })
  })
})
