import { z } from 'zod'

// docs/03_Technical_Specs/40_TRANSACTION_PURPOSE_CONFIRMATION_SPEC.md §5
// 고객-facing 거래 목적 라벨. 계정과목이 아니라 비즈니스 의도.
export const TRANSACTION_PURPOSE_CODE_LABEL = {
  business_supplies: '업무용 물품/소모품',
  employee_welfare_meal: '직원 식대/복리후생',
  client_entertainment_sales: '거래처 접대/영업',
  advertising_marketing: '광고/홍보',
  shipping_delivery: '배송/운반',
  vehicle_transport: '차량/교통',
  personal_not_company: '개인 사용/회사 비용 아님',
  other: '기타/직접 입력',
  unknown: '잘 모르겠습니다',
} as const

export const transactionPurposeCodeSchema = z.enum([
  'business_supplies',
  'employee_welfare_meal',
  'client_entertainment_sales',
  'advertising_marketing',
  'shipping_delivery',
  'vehicle_transport',
  'personal_not_company',
  'other',
  'unknown',
])

export type TransactionPurposeCode = z.infer<typeof transactionPurposeCodeSchema>

// 목적 code → 후보 계정항목 매핑은 담당자에게 "제안"만 가능, 자동 확정 금지(spec §5).
// 매핑 테이블은 v2에서 별도 도입.

export const transactionPurposeRequestStatusSchema = z.enum([
  'draft',
  'sent',
  'partially_answered',
  'submitted',
  'closed',
  'expired',
  'cancelled',
])

export const transactionPurposeRowStatusSchema = z.enum([
  'pending',
  'answered',
  'staff_confirmed',
  'skipped',
  'cancelled',
])

const MEMO_MAX = 1000
const STAFF_QUESTION_MAX = 500
const SUBJECT_MAX = 200
const BODY_MAX = 8000

// 고객이 한 row에 제출하는 답변.
// 고객-facing 화면은 계정/목적 코드를 고르게 하지 않고 사용 용도 설명만 받는다.
// purposeCode는 기존 발송 링크/저장 데이터 호환을 위해 선택값으로만 허용한다.
export const clientPurposeRowAnswerSchema = z.object({
  rowId: z.string().min(1),
  purposeCode: transactionPurposeCodeSchema.nullish(),
  memo: z.string().trim().min(1, '사용 용도 설명을 입력해 주세요.').max(MEMO_MAX),
})

// 고객 답변 제출(전체 또는 부분). 부분 저장을 허용한다(spec §6.5, 브리프 미결정 #2 디폴트).
export const clientPurposeAnswerSubmitSchema = z.object({
  token: z.string().min(1),
  purposeRequest: z.string().min(1),
  rows: z.array(clientPurposeRowAnswerSchema).min(1),
  // true면 전체 제출(submitted 전환), false면 부분 저장(partially_answered)
  submit: z.boolean(),
})

// 담당자: draft 생성. 보낼 row를 명시적으로 선택(spec §2/§6.1).
export const staffDraftCreateSchema = z.object({
  selectedClassificationRowIds: z.array(z.string().min(1)).min(1),
  dueAt: z.string().min(1).optional(), // Luxon ISO — API에서 DateTime.fromISO 검증
  staffQuestionOverride: z.string().trim().max(STAFF_QUESTION_MAX).optional(),
})

// 담당자: draft 수정(발송 전). row 추가·제거, due date, 제목/본문 스냅샷, 취소(spec §6.2).
// staff_question은 create 시에만 override 가능하며, 발송 전 per-row 편집은 후속 slice에서 다룬다.
export const staffDraftUpdateSchema = z
  .object({
    subjectSnapshot: z.string().trim().max(SUBJECT_MAX).optional(),
    bodySnapshot: z.string().trim().max(BODY_MAX).optional(),
    dueAt: z.string().min(1).nullable().optional(),
    addClassificationRowIds: z.array(z.string().min(1)).optional(),
    removeRowIds: z.array(z.string().min(1)).optional(),
    cancel: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: '수정할 필드가 없습니다',
  })
