import { describe, expect, it } from 'vitest'
import {
  isPayrollRuleDocumentContentType,
  resolvePayrollRuleExtractFileType,
  resolvePayrollRuleSourceTypeFromContentType,
} from './payroll-rule-document-types'

describe('payroll-rule-document-types', () => {
  it('txt/pdf/doc/xlsx MIME을 허용한다', () => {
    expect(isPayrollRuleDocumentContentType('text/plain')).toBe(true)
    expect(isPayrollRuleDocumentContentType('application/pdf')).toBe(true)
    expect(isPayrollRuleDocumentContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true)
    expect(isPayrollRuleDocumentContentType('application/msword')).toBe(true)
    expect(isPayrollRuleDocumentContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true)
    expect(isPayrollRuleDocumentContentType('image/jpeg')).toBe(false)
  })

  it('엑셀은 excel_embedded, 그 외는 rule_document로 분류한다', () => {
    expect(resolvePayrollRuleSourceTypeFromContentType('application/pdf')).toBe('rule_document')
    expect(resolvePayrollRuleSourceTypeFromContentType('text/plain')).toBe('rule_document')
    expect(resolvePayrollRuleSourceTypeFromContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('excel_embedded')
  })

  it('extract file type을 MIME에서 해석한다', () => {
    expect(resolvePayrollRuleExtractFileType('text/plain;charset=utf-8')).toBe('text')
    expect(resolvePayrollRuleExtractFileType('application/pdf')).toBe('pdf')
    expect(resolvePayrollRuleExtractFileType('application/msword')).toBe('word')
  })
})
